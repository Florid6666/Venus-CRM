import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

// Read-side API over SyncedEmail (written by EmailSyncEngineService, see
// modules/email-oauth). Scoped strictly to the requesting user's own
// connected mailbox -- this is someone's personal Gmail/Outlook, not a
// shared company inbox, so there's no "Manager can see a rep's synced mail"
// path here (unlike Deal/Contact visibility elsewhere in this app).
@Injectable()
export class SyncedEmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser, filters: { contactId?: string; dealId?: string }) {
    const connection = await this.prisma.userEmailConnection.findUnique({
      where: { userId: user.id },
    });
    if (!connection) return [];

    return this.prisma.syncedEmail.findMany({
      where: {
        connectionId: connection.id,
        contactId: filters.contactId,
        dealId: filters.dealId,
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
  }

  async markRead(id: string, user: RequestUser) {
    const message = await this.prisma.syncedEmail.findUnique({
      where: { id },
      include: { connection: { select: { userId: true } } },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (message.connection.userId !== user.id) {
      throw new ForbiddenException("This isn't your connected mailbox");
    }
    return this.prisma.syncedEmail.update({ where: { id }, data: { isRead: true } });
  }
}
