import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateChannelDto } from "./dto/create-channel.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const channelInclude = {
  department: { select: { id: true, name: true } },
  dmUser1: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  dmUser2: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

const messageInclude = {
  sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllChannels(user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = user.department?.id;

    // Retrieve channels that matches:
    // 1. Is not DM and is either public (departmentId == null), belongs to user's department, or user is Admin
    // 2. Is DM and user is one of the participants
    const channels = await this.prisma.chatChannel.findMany({
      where: {
        OR: [
          {
            isDM: false,
            OR: [
              { departmentId: null },
              ...(departmentId ? [{ departmentId }] : []),
              ...(isAdmin ? [{}] : []), // Admin sees all channels
            ],
          },
          {
            isDM: true,
            OR: [
              { dmUserId1: user.id },
              { dmUserId2: user.id },
            ],
          },
        ],
      },
      include: channelInclude,
      orderBy: { updatedAt: "desc" },
    });

    return channels;
  }

  async createChannel(dto: CreateChannelDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    
    // If locked to a department, verify user is in that department or is admin
    if (dto.departmentId) {
      const isDeptMember = user.department?.id === dto.departmentId;
      if (!isAdmin && !isDeptMember) {
        throw new ForbiddenException("You cannot create a channel for another department");
      }
    }

    return this.prisma.chatChannel.create({
      data: {
        name: dto.name,
        description: dto.description,
        isDM: false,
        departmentId: dto.departmentId ?? null,
      },
      include: channelInclude,
    });
  }

  async getOrCreateDM(recipientId: string, user: RequestUser) {
    if (recipientId === user.id) {
      throw new ForbiddenException("You cannot start a direct message with yourself");
    }

    // Assert recipient exists
    const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      throw new NotFoundException("Recipient user not found");
    }

    // Order IDs lexicographically for uniqueness
    const u1 = user.id < recipientId ? user.id : recipientId;
    const u2 = user.id < recipientId ? recipientId : user.id;

    let channel = await this.prisma.chatChannel.findUnique({
      where: {
        dmUserId1_dmUserId2: {
          dmUserId1: u1,
          dmUserId2: u2,
        },
      },
      include: channelInclude,
    });

    if (!channel) {
      channel = await this.prisma.chatChannel.create({
        data: {
          isDM: true,
          dmUserId1: u1,
          dmUserId2: u2,
        },
        include: channelInclude,
      });
    }

    return channel;
  }

  // Real-data backing for the sidebar's Team Chat badge: for every channel
  // the user can access, count messages from OTHERS created after their
  // last-read marker for that channel (or the channel's own createdAt if
  // they've never read it), then sum. Small channel counts at this app's
  // scale, so N+1-ish per-channel counts are fine -- no need for a single
  // fancy aggregate query.
  async getUnreadCount(user: RequestUser): Promise<number> {
    const channels = await this.findAllChannels(user);
    if (channels.length === 0) return 0;

    const reads = await this.prisma.chatChannelRead.findMany({
      where: { userId: user.id, channelId: { in: channels.map((c) => c.id) } },
    });
    const lastReadByChannel = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));

    const counts = await Promise.all(
      channels.map((channel) =>
        this.prisma.chatMessage.count({
          where: {
            channelId: channel.id,
            senderId: { not: user.id },
            createdAt: { gt: lastReadByChannel.get(channel.id) ?? channel.createdAt },
          },
        }),
      ),
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }

  // Called when the user opens/views a channel -- marks everything up to
  // now as read for them.
  async markChannelRead(channelId: string, user: RequestUser): Promise<void> {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }
    this.assertCanAccess(channel, user);

    await this.prisma.chatChannelRead.upsert({
      where: { userId_channelId: { userId: user.id, channelId } },
      create: { userId: user.id, channelId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }

  async findMessages(channelId: string, user: RequestUser, q?: string) {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    this.assertCanAccess(channel, user);

    const where: any = { channelId };
    if (q) {
      where.content = { contains: q, mode: "insensitive" };
    }

    return this.prisma.chatMessage.findMany({
      where,
      include: messageInclude,
      orderBy: { createdAt: "asc" },
      take: 100, // Return recent 100 messages
    });
  }

  async togglePinMessage(messageId: string, user: RequestUser) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }

    this.assertCanAccess(message.channel, user);

    const pinnedAt = message.pinnedAt ? null : new Date();

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { pinnedAt },
      include: messageInclude,
    });
  }

  async sendMessage(channelId: string, content: string, user: RequestUser) {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    this.assertCanAccess(channel, user);

    const message = await this.prisma.chatMessage.create({
      data: {
        content,
        channelId,
        senderId: user.id,
      },
      include: messageInclude,
    });

    // Touch the channel to update its updatedAt timestamp (helps list ordering)
    await this.prisma.chatChannel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  private assertCanAccess(
    channel: { isDM: boolean; departmentId: string | null; dmUserId1: string | null; dmUserId2: string | null },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;

    if (channel.isDM) {
      const isParticipant = channel.dmUserId1 === user.id || channel.dmUserId2 === user.id;
      if (!isParticipant) {
        throw new ForbiddenException("You do not have access to this direct message thread");
      }
    } else {
      if (channel.departmentId) {
        const isDeptMember = user.department?.id === channel.departmentId;
        if (!isAdmin && !isDeptMember) {
          throw new ForbiddenException("You do not have access to this department channel");
        }
      }
    }
  }
}
