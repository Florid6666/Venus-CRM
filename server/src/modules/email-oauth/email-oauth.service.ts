import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { EmailConnectionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { encryptSecret, decryptSecret } from "../../common/utils/token-crypto";
import { generateOAuthState, verifyOAuthState } from "../../common/utils/oauth-state";

// Plain fetch against each provider's REST endpoints -- no googleapis/
// microsoft-graph-client/msal-node dependency, matching this codebase's
// existing style for third-party HTTP APIs (see common/utils/mailer.ts's
// Resend/SendGrid calls). Both Gmail and Microsoft Graph are ordinary
// REST/JSON APIs; a full SDK buys nothing here that a few fetch calls don't
// already cover, and it's one less large dependency to install/trust.

export type OAuthProvider = "GOOGLE" | "MICROSOFT";

const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
const MICROSOFT_SCOPES = "Mail.Read Mail.Send offline_access";

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

@Injectable()
export class EmailOAuthService {
  private readonly logger = new Logger(EmailOAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Env vars are read lazily (per-request), not at module load, so the app
  // still boots fine before GOOGLE_CLIENT_ID/SECRET (etc.) are configured --
  // only actually starting a connect flow fails, with a clear message,
  // until those are set.
  isConfigured(provider: OAuthProvider): boolean {
    try {
      this.getProviderConfig(provider);
      return true;
    } catch {
      return false;
    }
  }

  private redirectBase(): string {
    return (process.env.OAUTH_REDIRECT_BASE_URL || "http://localhost:4001").replace(/\/$/, "");
  }

  private redirectUri(provider: OAuthProvider): string {
    const path = provider === "GOOGLE" ? "google" : "microsoft";
    return `${this.redirectBase()}/email-oauth/${path}/callback`;
  }

  private getProviderConfig(provider: OAuthProvider): ProviderConfig {
    if (provider === "GOOGLE") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new ServiceUnavailableException(
          "Google mailbox connect isn't configured yet -- GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set.",
        );
      }
      return {
        clientId,
        clientSecret,
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scope: GOOGLE_SCOPES,
      };
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "Microsoft mailbox connect isn't configured yet -- MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET are not set.",
      );
    }
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    return {
      clientId,
      clientSecret,
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      scope: MICROSOFT_SCOPES,
    };
  }

  // Builds the consent-screen URL the frontend redirects the browser to.
  buildAuthorizeUrl(provider: OAuthProvider, userId: string): string {
    const config = this.getProviderConfig(provider);
    const state = generateOAuthState(userId, provider);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: this.redirectUri(provider),
      response_type: "code",
      scope: config.scope,
      state,
      access_type: "offline",
      prompt: "consent",
    });
    // access_type/prompt are Google-only params; Microsoft's v2.0 endpoint
    // ignores unrecognized ones harmlessly, and offline_access is already in
    // its scope list instead.
    return `${config.authorizeUrl}?${params.toString()}`;
  }

  // Exchanges the authorization code for tokens, fetches the connected
  // mailbox's address, and upserts UserEmailConnection. Called from the
  // callback route (public -- see EmailOAuthController).
  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    const payload = verifyOAuthState(state);
    if (!payload || payload.provider !== provider) {
      throw new BadRequestException(
        "This connect link is invalid or has expired -- try connecting again.",
      );
    }

    const config = this.getProviderConfig(provider);
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri(provider),
      }),
    });
    if (!tokenRes.ok) {
      this.logger.error(
        `${provider} token exchange failed (${tokenRes.status}): ${await safeBody(tokenRes)}`,
      );
      throw new BadRequestException(
        "Couldn't complete the connection -- the provider rejected the exchange.",
      );
    }
    const tokens = (await tokenRes.json()) as TokenResponse;
    if (!tokens.refresh_token) {
      // Google omits this on a re-auth unless prompt=consent forced it (we
      // always pass that); Microsoft always issues one when offline_access
      // is granted. Surfacing this clearly beats a connection that silently
      // stops working the moment the short-lived access token expires.
      throw new BadRequestException(
        "The provider didn't grant offline access -- disconnect any existing app authorization and try again.",
      );
    }

    const accountEmail = await this.fetchAccountEmail(provider, tokens.access_token);
    const encryptedRefresh = encryptSecret(tokens.refresh_token);

    await this.prisma.userEmailConnection.upsert({
      where: { userId: payload.userId },
      create: {
        userId: payload.userId,
        connectionType:
          provider === "GOOGLE"
            ? EmailConnectionType.OAUTH_GOOGLE
            : EmailConnectionType.OAUTH_MICROSOFT,
        oauthAccessToken: tokens.access_token,
        encryptedRefreshToken: encryptedRefresh.ciphertext,
        refreshTokenIv: encryptedRefresh.iv,
        refreshTokenAuthTag: encryptedRefresh.authTag,
        oauthExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        oauthScope: tokens.scope ?? config.scope,
        providerAccountEmail: accountEmail,
        fromEmail: accountEmail,
        verified: true,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
      update: {
        connectionType:
          provider === "GOOGLE"
            ? EmailConnectionType.OAUTH_GOOGLE
            : EmailConnectionType.OAUTH_MICROSOFT,
        oauthAccessToken: tokens.access_token,
        encryptedRefreshToken: encryptedRefresh.ciphertext,
        refreshTokenIv: encryptedRefresh.iv,
        refreshTokenAuthTag: encryptedRefresh.authTag,
        oauthExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        oauthScope: tokens.scope ?? config.scope,
        providerAccountEmail: accountEmail,
        fromEmail: accountEmail,
        verified: true,
        lastVerifiedAt: new Date(),
        lastError: null,
        // Switching from a previous SMTP connection -- those fields are now
        // stale for this row.
        smtpHost: null,
        smtpPort: null,
        smtpSecure: null,
        smtpUsername: null,
        encryptedPassword: null,
        passwordIv: null,
        passwordAuthTag: null,
        // A fresh connection re-syncs from scratch.
        syncCursor: null,
        lastSyncedAt: null,
      },
    });

    return { userId: payload.userId };
  }

  // Refreshes the access token if it's near/past expiry, persists the new
  // one (and a rotated refresh token if the provider issued one), and
  // returns a token guaranteed usable right now. Called before every Gmail/
  // Graph API call.
  async resolveAccessToken(connection: {
    id: string;
    connectionType: EmailConnectionType;
    oauthAccessToken: string | null;
    encryptedRefreshToken: string | null;
    refreshTokenIv: string | null;
    refreshTokenAuthTag: string | null;
    oauthExpiresAt: Date | null;
  }): Promise<string> {
    const provider =
      connection.connectionType === EmailConnectionType.OAUTH_GOOGLE ? "GOOGLE" : "MICROSOFT";
    const stillValid =
      connection.oauthAccessToken &&
      connection.oauthExpiresAt &&
      connection.oauthExpiresAt.getTime() - Date.now() > 60_000; // 1 min buffer
    if (stillValid) {
      return connection.oauthAccessToken!;
    }

    if (
      !connection.encryptedRefreshToken ||
      !connection.refreshTokenIv ||
      !connection.refreshTokenAuthTag
    ) {
      throw new BadRequestException(
        "This mailbox connection is missing its refresh token -- reconnect it.",
      );
    }
    const refreshToken = decryptSecret({
      ciphertext: connection.encryptedRefreshToken,
      iv: connection.refreshTokenIv,
      authTag: connection.refreshTokenAuthTag,
    });

    const config = this.getProviderConfig(provider);
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const body = await safeBody(res);
      this.logger.error(`${provider} token refresh failed (${res.status}): ${body}`);
      await this.prisma.userEmailConnection.update({
        where: { id: connection.id },
        data: { verified: false, lastError: `Token refresh failed: ${body.slice(0, 200)}` },
      });
      throw new BadRequestException("This mailbox connection has expired -- reconnect it.");
    }
    const tokens = (await res.json()) as TokenResponse;

    const updateData: {
      oauthAccessToken: string;
      oauthExpiresAt: Date;
      encryptedRefreshToken?: string;
      refreshTokenIv?: string;
      refreshTokenAuthTag?: string;
    } = {
      oauthAccessToken: tokens.access_token,
      oauthExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };
    // Google may rotate the refresh token; Microsoft always does.
    if (tokens.refresh_token) {
      const encrypted = encryptSecret(tokens.refresh_token);
      updateData.encryptedRefreshToken = encrypted.ciphertext;
      updateData.refreshTokenIv = encrypted.iv;
      updateData.refreshTokenAuthTag = encrypted.authTag;
    }
    await this.prisma.userEmailConnection.update({
      where: { id: connection.id },
      data: updateData,
    });

    return tokens.access_token;
  }

  private async fetchAccountEmail(provider: OAuthProvider, accessToken: string): Promise<string> {
    if (provider === "GOOGLE") {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok)
        throw new BadRequestException("Couldn't read the connected Gmail account's address.");
      const body = (await res.json()) as { emailAddress: string };
      return body.emailAddress;
    }

    const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok)
      throw new BadRequestException("Couldn't read the connected Microsoft account's address.");
    const body = (await res.json()) as { mail: string | null; userPrincipalName: string };
    return body.mail || body.userPrincipalName;
  }

  // Sends one email via Gmail's send endpoint (raw base64url MIME) or
  // Graph's sendMail endpoint -- called by EmailConnectionsService.
  // requireSendable()'s "oauth" branch consumers (the bulk-email/sequence
  // engines and DealFollowUpsService).
  async sendMail(
    provider: OAuthProvider,
    accessToken: string,
    msg: { to: string; subject: string; html: string; from: string },
  ): Promise<void> {
    if (provider === "GOOGLE") {
      const mime = [
        `From: ${msg.from}`,
        `To: ${msg.to}`,
        `Subject: ${msg.subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        "",
        msg.html,
      ].join("\r\n");
      const raw = Buffer.from(mime).toString("base64url");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        throw new Error(`Gmail send failed (${res.status}): ${await safeBody(res)}`);
      }
      return;
    }

    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: msg.subject,
          body: { contentType: "HTML", content: msg.html },
          toRecipients: [{ emailAddress: { address: msg.to } }],
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Graph sendMail failed (${res.status}): ${await safeBody(res)}`);
    }
  }
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return res.statusText;
  }
}
