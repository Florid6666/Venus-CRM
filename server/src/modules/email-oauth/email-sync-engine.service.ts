import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EmailConnectionType, EmailDirection } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailOAuthService } from "./email-oauth.service";

// Polling sync (v1) rather than push (Gmail Pub/Sub watch / Graph
// subscriptions) -- push needs a GCP Pub/Sub topic + IAM setup beyond just
// the OAuth app, plus its own renewal cron (Gmail watches expire after 7
// days, Graph subscriptions after ~3), for latency gains that don't matter
// much for a synced-inbox view. See the approved plan for the full
// reasoning; push sync is a clean v2 that slots into modules/webhooks
// without touching this model.

const BACKFILL_DAYS = 30;
const BATCH_SIZE = 25; // connections processed per tick, not messages

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: GmailHeader[] };
}

interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
  ccRecipients?: { emailAddress?: { address?: string } }[];
  "@removed"?: unknown;
}

interface MicrosoftCursor {
  inboxDelta?: string;
  sentDelta?: string;
}

@Injectable()
export class EmailSyncEngineService {
  private readonly logger = new Logger(EmailSyncEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: EmailOAuthService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.runOnce();
  }

  async runOnce(): Promise<{ processed: number }> {
    const connections = await this.prisma.userEmailConnection.findMany({
      where: { connectionType: { not: EmailConnectionType.SMTP }, verified: true },
      take: BATCH_SIZE,
    });

    for (const connection of connections) {
      try {
        if (connection.connectionType === EmailConnectionType.OAUTH_GOOGLE) {
          await this.syncGoogle(connection);
        } else {
          await this.syncMicrosoft(connection);
        }
      } catch (err) {
        this.logger.error(
          `Sync failed for connection ${connection.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { processed: connections.length };
  }

  // --- Gmail: a single historyId cursor covers the whole mailbox ---

  private async syncGoogle(
    connection: Parameters<EmailOAuthService["resolveAccessToken"]>[0] & {
      id: string;
      providerAccountEmail: string | null;
      syncCursor: string | null;
    },
  ) {
    const accessToken = await this.oauth.resolveAccessToken(connection);

    if (!connection.syncCursor) {
      await this.backfillGoogle(connection.id, accessToken, connection.providerAccountEmail);
      return;
    }

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${connection.syncCursor}&historyTypes=messageAdded`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 404) {
      // historyId too old / expired -- Gmail's own guidance is to fall back
      // to a fresh backfill rather than error out.
      await this.backfillGoogle(connection.id, accessToken, connection.providerAccountEmail);
      return;
    }
    if (!res.ok) {
      this.logger.error(
        `Gmail history.list failed (${res.status}) for connection ${connection.id}`,
      );
      return;
    }
    const body = (await res.json()) as {
      history?: { messagesAdded?: { message: { id: string } }[] }[];
      historyId?: string;
    };
    const messageIds = new Set<string>();
    for (const h of body.history ?? []) {
      for (const added of h.messagesAdded ?? []) {
        messageIds.add(added.message.id);
      }
    }
    for (const id of messageIds) {
      await this.ingestGoogleMessage(
        connection.id,
        accessToken,
        id,
        connection.providerAccountEmail,
      );
    }

    await this.prisma.userEmailConnection.update({
      where: { id: connection.id },
      data: { syncCursor: body.historyId ?? connection.syncCursor, lastSyncedAt: new Date() },
    });
  }

  private async backfillGoogle(
    connectionId: string,
    accessToken: string,
    accountEmail: string | null,
  ) {
    const afterEpoch = Math.floor((Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000) / 1000);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${afterEpoch}&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      this.logger.error(
        `Gmail messages.list (backfill) failed (${listRes.status}) for connection ${connectionId}`,
      );
      return;
    }
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    for (const m of list.messages ?? []) {
      await this.ingestGoogleMessage(connectionId, accessToken, m.id, accountEmail);
    }

    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = profileRes.ok ? ((await profileRes.json()) as { historyId?: string }) : {};
    await this.prisma.userEmailConnection.update({
      where: { id: connectionId },
      data: { syncCursor: profile.historyId ?? null, lastSyncedAt: new Date() },
    });
  }

  private async ingestGoogleMessage(
    connectionId: string,
    accessToken: string,
    messageId: string,
    accountEmail: string | null,
  ) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return;
    const msg = (await res.json()) as GmailMessage;
    const headers = msg.payload?.headers ?? [];
    const header = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    const direction = msg.labelIds?.includes("SENT")
      ? EmailDirection.SENT
      : EmailDirection.RECEIVED;
    const fromAddress = extractAddress(header("From")) || accountEmail || "";
    const toAddresses = extractAddresses(header("To"));
    const ccAddresses = extractAddresses(header("Cc"));

    await this.upsertSyncedEmail({
      connectionId,
      providerMessageId: msg.id,
      threadId: msg.threadId,
      direction,
      fromAddress,
      toAddresses,
      ccAddresses,
      subject: header("Subject"),
      bodyPreview: msg.snippet ?? "",
      occurredAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
    });
  }

  // --- Microsoft Graph: delta is folder-scoped, so Inbox and Sent Items
  // each carry their own cursor packed into syncCursor as JSON ---

  private async syncMicrosoft(
    connection: Parameters<EmailOAuthService["resolveAccessToken"]>[0] & {
      id: string;
      syncCursor: string | null;
    },
  ) {
    const accessToken = await this.oauth.resolveAccessToken(connection);
    const cursor: MicrosoftCursor = connection.syncCursor
      ? safeJsonParse(connection.syncCursor)
      : {};

    const [inboxResult, sentResult] = await Promise.all([
      this.syncGraphFolder(
        accessToken,
        "inbox",
        cursor.inboxDelta,
        EmailDirection.RECEIVED,
        connection.id,
      ),
      this.syncGraphFolder(
        accessToken,
        "sentitems",
        cursor.sentDelta,
        EmailDirection.SENT,
        connection.id,
      ),
    ]);

    const nextCursor: MicrosoftCursor = {
      inboxDelta: inboxResult ?? cursor.inboxDelta,
      sentDelta: sentResult ?? cursor.sentDelta,
    };
    await this.prisma.userEmailConnection.update({
      where: { id: connection.id },
      data: { syncCursor: JSON.stringify(nextCursor), lastSyncedAt: new Date() },
    });
  }

  // Returns the new delta link (to persist) or undefined on failure.
  private async syncGraphFolder(
    accessToken: string,
    folder: "inbox" | "sentitems",
    existingDeltaLink: string | undefined,
    direction: EmailDirection,
    connectionId: string,
  ): Promise<string | undefined> {
    let url =
      existingDeltaLink ??
      `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages/delta?$select=subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId` +
        (existingDeltaLink
          ? ""
          : `&$filter=receivedDateTime ge ${new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString()}`);

    let deltaLink: string | undefined;
    // Graph paginates via @odata.nextLink until the final page carries
    // @odata.deltaLink -- follow the whole chain in one tick so a large
    // backfill doesn't silently stall mid-way.

    while (true) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.status === 410) {
        // Delta token expired -- Graph's guidance is to restart without a
        // token (a fresh backfill for this folder).
        return this.syncGraphFolder(accessToken, folder, undefined, direction, connectionId);
      }
      if (!res.ok) {
        this.logger.error(
          `Graph ${folder} delta failed (${res.status}) for connection ${connectionId}`,
        );
        return undefined;
      }
      const body = (await res.json()) as {
        value?: GraphMessage[];
        "@odata.nextLink"?: string;
        "@odata.deltaLink"?: string;
      };
      for (const m of body.value ?? []) {
        if (m["@removed"]) continue;
        await this.upsertSyncedEmail({
          connectionId,
          providerMessageId: m.id,
          threadId: m.conversationId,
          direction,
          fromAddress: m.from?.emailAddress?.address ?? "",
          toAddresses: (m.toRecipients ?? [])
            .map((r) => r.emailAddress?.address)
            .filter((a): a is string => !!a),
          ccAddresses: (m.ccRecipients ?? [])
            .map((r) => r.emailAddress?.address)
            .filter((a): a is string => !!a),
          subject: m.subject ?? "",
          bodyPreview: m.bodyPreview ?? "",
          occurredAt: new Date(m.receivedDateTime ?? m.sentDateTime ?? Date.now()),
        });
      }
      if (body["@odata.deltaLink"]) {
        deltaLink = body["@odata.deltaLink"];
        break;
      }
      if (body["@odata.nextLink"]) {
        url = body["@odata.nextLink"];
        continue;
      }
      break;
    }
    return deltaLink;
  }

  // --- Shared: idempotent upsert + Contact/Deal address-match linkage ---

  private async upsertSyncedEmail(input: {
    connectionId: string;
    providerMessageId: string;
    threadId?: string;
    direction: EmailDirection;
    fromAddress: string;
    toAddresses: string[];
    ccAddresses: string[];
    subject: string;
    bodyPreview: string;
    occurredAt: Date;
  }) {
    // Match by the "other party": whoever isn't the connection's own
    // mailbox. For RECEIVED that's the sender; for SENT that's the
    // recipient(s). Leaves dealId unset -- inferring which of a contact's
    // several deals an email is "about" from an address match alone risks
    // silent misattribution (see the approved plan).
    const otherPartyAddresses =
      input.direction === EmailDirection.RECEIVED ? [input.fromAddress] : input.toAddresses;
    const contact =
      otherPartyAddresses.length > 0
        ? await this.prisma.contact.findFirst({
            where: { email: { in: otherPartyAddresses.filter(Boolean), mode: "insensitive" } },
            select: { id: true },
          })
        : null;

    await this.prisma.syncedEmail.upsert({
      where: {
        connectionId_providerMessageId: {
          connectionId: input.connectionId,
          providerMessageId: input.providerMessageId,
        },
      },
      create: {
        connectionId: input.connectionId,
        providerMessageId: input.providerMessageId,
        threadId: input.threadId,
        direction: input.direction,
        fromAddress: input.fromAddress,
        toAddresses: input.toAddresses,
        ccAddresses: input.ccAddresses,
        subject: input.subject,
        bodyPreview: input.bodyPreview,
        occurredAt: input.occurredAt,
        contactId: contact?.id,
      },
      // Re-syncing an already-seen message is a no-op beyond the linkage --
      // provider content for a given messageId doesn't change after the
      // fact.
      update: { contactId: contact?.id },
    });
  }
}

function extractAddress(headerValue: string): string {
  const match = /<([^>]+)>/.exec(headerValue);
  return (match ? match[1] : headerValue).trim();
}

function extractAddresses(headerValue: string): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(",")
    .map((part) => extractAddress(part))
    .filter(Boolean);
}

function safeJsonParse(value: string): MicrosoftCursor {
  try {
    return JSON.parse(value) as MicrosoftCursor;
  } catch {
    return {};
  }
}
