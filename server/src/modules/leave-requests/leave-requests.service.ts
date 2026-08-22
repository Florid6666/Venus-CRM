import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LeaveStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

const leaveInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Admins and HR members see all; everyone else only sees their own.
  findAll(user: RequestUser, filters: { userId?: string; status?: LeaveStatus }) {
    const canSeeAll =
      user.role.name === RoleName.ADMIN || user.department?.name === "HR";

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (canSeeAll) {
      // HR/Admin can optionally filter by employee
      if (filters.userId) {
        where.userId = filters.userId;
      }
    } else {
      // Regular employees only see their own
      where.userId = user.id;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: leaveInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude,
    });
    if (!leave) throw new NotFoundException("Leave request not found");

    const canSeeAll =
      user.role.name === RoleName.ADMIN || user.department?.name === "HR";

    if (!canSeeAll && leave.userId !== user.id) {
      throw new ForbiddenException("Access denied");
    }
    return leave;
  }

  async create(dto: CreateLeaveRequestDto, user: RequestUser) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException("End date must be after start date");
    }

    return this.prisma.leaveRequest.create({
      data: {
        userId: user.id,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
      include: leaveInclude,
    });
  }

  // HR/Admin only: approve or reject; employees can cancel their own pending requests.
  async update(id: string, dto: UpdateLeaveRequestDto, user: RequestUser) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException("Leave request not found");

    const canReview =
      user.role.name === RoleName.ADMIN || user.department?.name === "HR";

    // Employees can only cancel their own pending requests
    if (!canReview) {
      if (leave.userId !== user.id) throw new ForbiddenException("Access denied");
      if (dto.status && dto.status !== LeaveStatus.CANCELLED) {
        throw new ForbiddenException("Employees can only cancel their own requests");
      }
      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException("Only pending requests can be cancelled");
      }
    }

    const isReviewAction =
      dto.status === LeaveStatus.APPROVED || dto.status === LeaveStatus.REJECTED;

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote,
        ...(isReviewAction
          ? { reviewedById: user.id, reviewedAt: new Date() }
          : {}),
      },
      include: leaveInclude,
    });

    // Fire notification to the leave owner on approve/reject
    if (dto.status === LeaveStatus.APPROVED) {
      await this.notifications.create({
        userId: leave.userId,
        type: "LEAVE_APPROVED",
        title: "Leave Approved ✓",
        message: dto.reviewNote
          ? `Your leave request was approved. Note: ${dto.reviewNote}`
          : "Your leave request has been approved.",
        link: "/hr",
      });
    } else if (dto.status === LeaveStatus.REJECTED) {
      await this.notifications.create({
        userId: leave.userId,
        type: "LEAVE_REJECTED",
        title: "Leave Request Rejected",
        message: dto.reviewNote
          ? `Your leave request was rejected. Reason: ${dto.reviewNote}`
          : "Your leave request has been rejected.",
        link: "/hr",
      });
    }

    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException("Leave request not found");

    const canSeeAll =
      user.role.name === RoleName.ADMIN || user.department?.name === "HR";

    if (!canSeeAll && leave.userId !== user.id) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.leaveRequest.delete({ where: { id } });
  }

  // HR/Admin only: stats overview for the admin panel
  async getStats(user: RequestUser) {
    const canSeeAll =
      user.role.name === RoleName.ADMIN || user.department?.name === "HR";
    if (!canSeeAll) {
      throw new ForbiddenException("Access denied");
    }

    const [total, pending, approved, rejected, byType] = await Promise.all([
      this.prisma.leaveRequest.count(),
      this.prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      this.prisma.leaveRequest.count({ where: { status: "APPROVED" } }),
      this.prisma.leaveRequest.count({ where: { status: "REJECTED" } }),
      this.prisma.leaveRequest.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      byType: byType.map((b) => ({ type: b.type, count: b._count.id })),
    };
  }
}
