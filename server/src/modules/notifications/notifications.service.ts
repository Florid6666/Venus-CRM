import { Injectable } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a notification for a specific user. Called by other services. */
  create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      },
    });
  }

  /** List all notifications for the requesting user, newest first. */
  findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /** Count unread notifications for the requesting user. */
  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  /** Mark a single notification as read. Silently ignores wrong owner. */
  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  /** Mark ALL unread notifications for a user as read. */
  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
