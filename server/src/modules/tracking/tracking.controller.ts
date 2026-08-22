import { Controller, Get, Param, Res, Logger } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../common/decorators/public.decorator";

// 1x1 transparent GIF buffer
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

@Controller("tracking")
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get("open/bulk/:recipientId")
  async trackBulkOpen(
    @Param("recipientId") recipientId: string,
    @Res() res: Response
  ) {
    try {
      const recipient = await this.prisma.bulkEmailRecipient.findUnique({
        where: { id: recipientId },
        select: { contactId: true, campaign: { select: { name: true, creatorId: true } } }
      });

      if (recipient) {
        // Conditional update (WHERE openedAt IS NULL) rather than a
        // read-then-write -- under concurrent pixel fetches (mail-client
        // prescanning + the recipient actually opening it), Postgres
        // serializes these on the row lock and only one update's WHERE
        // clause still matches after the lock is released, so `count` here
        // is a race-safe "was this truly the first open" signal.
        const firstOpen = await this.prisma.bulkEmailRecipient.updateMany({
          where: { id: recipientId, openedAt: null },
          data: { openedAt: new Date() },
        });
        await this.prisma.bulkEmailRecipient.update({
          where: { id: recipientId },
          data: { openCount: { increment: 1 } },
        });

        // Notify the campaign's sender (not a nonexistent contact "owner" --
        // Contacts are a shared team resource with no owner/assignee concept
        // in this schema) on the recipient's first open only.
        if (firstOpen.count > 0 && recipient.contactId) {
          const contact = await this.prisma.contact.findUnique({
            where: { id: recipient.contactId },
            select: { firstName: true, lastName: true }
          });
          if (contact) {
            await this.prisma.notification.create({
              data: {
                userId: recipient.campaign.creatorId,
                type: "GENERAL",
                title: "Email Opened",
                message: `${contact.firstName} ${contact.lastName} opened your email from campaign "${recipient.campaign.name}"`,
                link: `/crm`
              }
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to track bulk open for ${recipientId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.sendPixel(res);
  }

  @Public()
  @Get("open/sequence/:sendId")
  async trackSequenceOpen(
    @Param("sendId") sendId: string,
    @Res() res: Response
  ) {
    try {
      const send = await this.prisma.sequenceSend.findUnique({
        where: { id: sendId },
        select: { enrollment: { select: { contactId: true, enrolledById: true, sequence: { select: { name: true } } } } }
      });

      if (send) {
        // Same race-safe conditional-update pattern as trackBulkOpen above.
        const firstOpen = await this.prisma.sequenceSend.updateMany({
          where: { id: sendId, openedAt: null },
          data: { openedAt: new Date() },
        });
        await this.prisma.sequenceSend.update({
          where: { id: sendId },
          data: { openCount: { increment: 1 } },
        });

        if (firstOpen.count > 0) {
          const contact = await this.prisma.contact.findUnique({
            where: { id: send.enrollment.contactId },
            select: { firstName: true, lastName: true }
          });
          if (contact) {
            await this.prisma.notification.create({
              data: {
                userId: send.enrollment.enrolledById,
                type: "GENERAL",
                title: "Sequence Email Opened",
                message: `${contact.firstName} ${contact.lastName} opened step in sequence "${send.enrollment.sequence.name}"`,
                link: `/crm`
              }
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to track sequence open for ${sendId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.sendPixel(res);
  }

  private sendPixel(res: Response) {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.status(200).send(TRACKING_PIXEL);
  }
}
