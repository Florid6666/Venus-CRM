import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const activityInclude = {
  creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: { dealId?: string }) {
    return this.prisma.activity.findMany({
      where: { dealId: filters.dealId },
      include: activityInclude,
      orderBy: { occurredAt: "desc" },
    });
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id }, include: activityInclude });
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  async create(dto: CreateActivityDto, creatorId: string) {
    await this.assertDealExists(dto.dealId);

    return this.prisma.activity.create({
      data: {
        dealId: dto.dealId,
        type: dto.type,
        content: dto.content,
        contactId: dto.contactId ?? null,
        outcome: dto.outcome?.trim() || null,
        durationMin: dto.durationMin ?? null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        creatorId,
      },
      include: activityInclude,
    });
  }

  async update(id: string, dto: UpdateActivityDto, user: RequestUser) {
    const activity = await this.getOwned(id);
    this.assertCanMutate(activity, user);

    return this.prisma.activity.update({
      where: { id },
      data: {
        type: dto.type,
        content: dto.content,
        ...(dto.contactId !== undefined ? { contactId: dto.contactId } : {}),
        ...(dto.outcome !== undefined ? { outcome: dto.outcome?.trim() || null } : {}),
        ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
      include: activityInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const activity = await this.getOwned(id);
    this.assertCanMutate(activity, user);
    await this.prisma.activity.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  private async assertDealExists(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
  }

  // TODO: revisit ACL model -- creator or ADMIN/MANAGER only, for now.
  private assertCanMutate(activity: { creatorId: string }, user: RequestUser) {
    const isPrivileged = user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;
    if (!isPrivileged && activity.creatorId !== user.id) {
      throw new ForbiddenException("You do not have permission to modify this activity");
    }
  }
}
