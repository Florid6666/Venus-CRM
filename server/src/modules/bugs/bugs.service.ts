import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BugPriority, BugSeverity, BugStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBugDto } from "./dto/create-bug.dto";
import { AddBugCommentDto, UpdateBugDto } from "./dto/update-bug.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

const bugInclude = {
  task: { select: { id: true, title: true, projectId: true, testerId: true } },
  reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  comments: {
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

@Injectable()
export class BugsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(taskId?: string, assigneeId?: string, status?: BugStatus) {
    return this.prisma.bug.findMany({
      where: {
        ...(taskId ? { taskId } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(status ? { status } : {}),
      },
      include: bugInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const bug = await this.prisma.bug.findUnique({
      where: { id },
      include: bugInclude,
    });
    if (!bug) {
      throw new NotFoundException("Bug not found");
    }
    return bug;
  }

  async create(dto: CreateBugDto, reporter: RequestUser) {
    const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
    if (!task) {
      throw new NotFoundException("Associated task not found");
    }

    const bugStatus = dto.status ?? (dto.assigneeId ? BugStatus.ASSIGNED : BugStatus.OPEN);

    const bug = await this.prisma.bug.create({
      data: {
        title: dto.title,
        description: dto.description,
        taskId: dto.taskId,
        subtaskId: dto.subtaskId,
        reporterId: reporter.id,
        assigneeId: dto.assigneeId,
        severity: dto.severity ?? BugSeverity.MEDIUM,
        priority: dto.priority ?? BugPriority.MEDIUM,
        status: bugStatus,
        attachments: dto.attachments ?? [],
      },
      include: bugInclude,
    });

    // Log Activity
    await this.prisma.bugActivityLog.create({
      data: {
        bugId: bug.id,
        userId: reporter.id,
        action: "BUG_CREATED",
        details: `Bug created with status ${bug.status}`,
      },
    });

    await this.prisma.taskActivityLog.create({
      data: {
        taskId: dto.taskId,
        userId: reporter.id,
        action: "BUG_CREATED",
        details: `Bug #${bug.bugNumber}: "${bug.title}" logged.`,
      },
    });

    // Notify assignee if assigned
    if (dto.assigneeId && dto.assigneeId !== reporter.id) {
      await this.notifications.create({
        userId: dto.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Bug Assigned to You",
        message: `Bug #${bug.bugNumber}: "${bug.title}" has been assigned to you.`,
        link: "/tasks",
      });
    }

    return bug;
  }

  async update(id: string, dto: UpdateBugDto, user: RequestUser) {
    const bug = await this.findOne(id);

    // Workflow validation: only the designated Tester/Manager/Admin may close or reopen a bug.
    // Developers (including the reporter/assignee) may only move a bug forward to TO_BE_TESTED.
    if (dto.status === BugStatus.CLOSED || dto.status === BugStatus.REOPENED) {
      const isTesterOrAdmin =
        user.role.name === RoleName.ADMIN ||
        user.role.name === RoleName.MANAGER ||
        bug.task.testerId === user.id;

      if (!isTesterOrAdmin) {
        throw new ForbiddenException(
          dto.status === BugStatus.CLOSED
            ? "Developers cannot directly close a bug. Please set status to 'To Be Tested' for Tester validation."
            : "Only the assigned Tester, Manager, or Admin can reopen a bug.",
        );
      }
    }

    // Determine new status if assignee updated
    let nextStatus = dto.status;
    if (!nextStatus && dto.assigneeId && bug.status === BugStatus.OPEN) {
      nextStatus = BugStatus.ASSIGNED;
    }

    const updated = await this.prisma.bug.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        severity: dto.severity,
        priority: dto.priority,
        status: nextStatus,
        attachments: dto.attachments,
      },
      include: bugInclude,
    });

    // Log status change if changed
    if (nextStatus && nextStatus !== bug.status) {
      await this.prisma.bugActivityLog.create({
        data: {
          bugId: bug.id,
          userId: user.id,
          action: "STATUS_CHANGED",
          details: `Status changed from ${bug.status} to ${nextStatus}`,
        },
      });

      await this.prisma.taskActivityLog.create({
        data: {
          taskId: bug.taskId,
          userId: user.id,
          action: "BUG_STATUS_CHANGED",
          details: `Bug #${bug.bugNumber} status updated to ${nextStatus}`,
        },
      });

      // Notifications based on status transitions
      if (nextStatus === BugStatus.TO_BE_TESTED) {
        const notifyTarget = bug.task.testerId || bug.reporterId;
        if (notifyTarget && notifyTarget !== user.id) {
          await this.notifications.create({
            userId: notifyTarget,
            type: "TASK_UPDATED",
            title: "Bug Ready for Testing",
            message: `Bug #${bug.bugNumber}: "${bug.title}" fix submitted. Ready for retesting.`,
            link: "/tasks",
          });
        }
      } else if (nextStatus === BugStatus.REOPENED) {
        if (updated.assigneeId && updated.assigneeId !== user.id) {
          await this.notifications.create({
            userId: updated.assigneeId,
            type: "TASK_UPDATED",
            title: "Bug Reopened",
            message: `Bug #${bug.bugNumber}: "${bug.title}" was reopened during testing.`,
            link: "/tasks",
          });
        }
      }
    }

    return updated;
  }

  async addComment(id: string, dto: AddBugCommentDto, user: RequestUser) {
    const bug = await this.findOne(id);
    const comment = await this.prisma.bugComment.create({
      data: {
        bugId: id,
        userId: user.id,
        content: dto.content,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    await this.prisma.bugActivityLog.create({
      data: {
        bugId: id,
        userId: user.id,
        action: "COMMENT_ADDED",
        details: `Comment added: "${dto.content.slice(0, 40)}..."`,
      },
    });

    return comment;
  }

  async remove(id: string, user: RequestUser) {
    const bug = await this.findOne(id);
    if (user.role.name !== RoleName.ADMIN && user.role.name !== RoleName.MANAGER && bug.reporterId !== user.id) {
      throw new ForbiddenException("Only the reporter, manager, or admin can delete a bug.");
    }
    await this.prisma.bug.delete({ where: { id } });
  }
}
