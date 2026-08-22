import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BulkSendStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBulkEmailDto } from "./dto/create-bulk-email.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import { followUpColdSince } from "../../common/utils/follow-up";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import type { RequestUser } from "../../common/types/request-user.type";

const campaignInclude = {
  template: { select: { id: true, name: true, subject: true } },
  creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  _count: { select: { recipients: true } },
} as const;

const recipientInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class BulkEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailConnections: EmailConnectionsService,
  ) {}

  async findAll(user: RequestUser) {
    this.assertCanUse(user);
    const campaigns = await this.prisma.bulkEmailCampaign.findMany({
      include: campaignInclude,
      orderBy: { createdAt: "desc" },
    });

    const counts = await this.prisma.bulkEmailRecipient.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
      _count: true,
    });
    const countsByCampaign = new Map<string, Record<string, number>>();
    for (const row of counts) {
      const existing = countsByCampaign.get(row.campaignId) ?? {};
      existing[row.status] = row._count;
      countsByCampaign.set(row.campaignId, existing);
    }

    return campaigns.map((c) => ({
      ...c,
      statusCounts: countsByCampaign.get(c.id) ?? {},
    }));
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const campaign = await this.prisma.bulkEmailCampaign.findUnique({
      where: { id },
      include: {
        ...campaignInclude,
        recipients: { include: recipientInclude, orderBy: { createdAt: "asc" } },
      },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }

  // Resolves contactIds + rawEmails into a deduped recipient set (by
  // lowercased email) and creates the campaign + PENDING recipient rows in
  // one go. The engine (bulk-email-engine.service.ts) picks them up from
  // there -- this method never sends anything itself.
  async create(dto: CreateBulkEmailDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.assertSenderConnected(user);

    const content = await this.resolveContent(dto);

    const recipients = new Map<string, { email: string; contactId: string | null }>();

    if (dto.contactIds && dto.contactIds.length > 0) {
      const contacts = await this.prisma.contact.findMany({
        where: { id: { in: dto.contactIds } },
        select: { id: true, email: true },
      });
      for (const contact of contacts) {
        if (!contact.email) continue;
        recipients.set(normalizeEmail(contact.email), {
          email: normalizeEmail(contact.email),
          contactId: contact.id,
        });
      }
    }

    for (const raw of dto.rawEmails ?? []) {
      const email = normalizeEmail(raw);
      if (!recipients.has(email)) {
        recipients.set(email, { email, contactId: null });
      }
    }

    if (recipients.size === 0) {
      throw new BadRequestException(
        "No valid recipients -- selected contacts must have an email on file, or provide at least one raw email.",
      );
    }

    return this.prisma.bulkEmailCampaign.create({
      data: {
        name: dto.name,
        ...content,
        appendSignature: dto.appendSignature ?? false,
        creatorId: user.id,
        recipients: {
          create: Array.from(recipients.values()).map((r) => ({
            email: r.email,
            contactId: r.contactId,
            status: BulkSendStatus.PENDING,
          })),
        },
      },
      include: campaignInclude,
    });
  }

  async findFollowUps(user: RequestUser) {
    this.assertCanUse(user);
    const coldDate = followUpColdSince();

    return this.prisma.bulkEmailRecipient.findMany({
      where: {
        status: BulkSendStatus.SENT,
        openCount: 0,
        sentAt: { lte: coldDate },
        contactId: { not: null },
        campaign: user.role.name === RoleName.EMPLOYEE ? { creatorId: user.id } : undefined,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });
  }

  // Enforces the templateId-XOR-(subject+bodyHtml) rule the DTO can't, and
  // returns the exact column set to write. An inline email is stored on the
  // campaign itself rather than as a hidden EmailTemplate row, so writing a
  // one-off for twenty recipients never clutters the team's shared template
  // library.
  private async resolveContent(dto: CreateBulkEmailDto) {
    const hasInline = !!dto.subject || !!dto.bodyHtml;

    if (dto.templateId && hasInline) {
      throw new BadRequestException(
        "Choose either a saved template or a one-off email written here -- not both.",
      );
    }

    if (dto.templateId) {
      const template = await this.prisma.emailTemplate.findUnique({
        where: { id: dto.templateId },
        select: { id: true },
      });
      if (!template) {
        throw new BadRequestException("Email template not found");
      }
      return { templateId: dto.templateId, subject: null, bodyHtml: null };
    }

    if (!dto.subject || !dto.bodyHtml) {
      throw new BadRequestException(
        "Pick a saved template, or write this email's subject and body here.",
      );
    }
    return { templateId: null, subject: dto.subject, bodyHtml: dto.bodyHtml };
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Bulk email is only available to the Sales department");
    }
  }

  // Campaigns send from the creator's own mailbox (see EmailConnectionsService),
  // so there's no point creating one until that's actually connected and
  // verified -- fail fast here instead of silently queuing recipients that
  // the engine can never send. The shared HTTP stopgap also counts as
  // "ready to send" -- see EmailConnectionsService.requireSendable.
  private async assertSenderConnected(user: RequestUser) {
    const status = await this.emailConnections.getStatus(user);
    if (status.connected && status.verified) return;
    if (this.emailConnections.hasHttpFallback()) return;
    throw new BadRequestException(
      "Connect and verify your email account in your profile before sending a bulk campaign.",
    );
  }
}
