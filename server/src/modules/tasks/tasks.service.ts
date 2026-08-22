import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BugStatus, RoleName, TaskPriority, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

const taskInclude = {
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  assignees: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  tester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  project: { select: { id: true, name: true } },
  taskList: { select: { id: true, name: true } },
  timeLogs: {
    select: {
      id: true,
      minutes: true,
      date: true,
      startTime: true,
      endTime: true,
      note: true,
      userId: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  subtasks: {
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      tester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      bugs: {
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          comments: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" as const },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  updates: {
    orderBy: { createdAt: "desc" as const },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  bugs: {
    include: {
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
    },
    orderBy: { createdAt: "desc" as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  _count: { select: { updates: true, bugs: true, subtasks: true, timeLogs: true } },
} as const;

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  departmentId?: string;
  taskListId?: string;
  testerId?: string;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(filters: TaskFilters, user: RequestUser) {
    return this.prisma.task.findMany({
      where: {
        status: filters.status,
        priority: filters.priority,
        projectId: filters.projectId,
        taskListId: filters.taskListId,
        ...(filters.assigneeId
          ? {
              OR: [
                { assigneeId: filters.assigneeId },
                { assignees: { some: { userId: filters.assigneeId } } },
              ],
            }
          : {}),
        ...(filters.testerId ? { testerId: filters.testerId } : {}),
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: taskInclude,
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });
  }

  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }

    // EMPLOYEE role strict visibility scope:
    // Only assigned tasks (direct assignee, multi-assignees, subtask assignee, tester, or creator)
    return {
      OR: [
        { assigneeId: user.id },
        { assignees: { some: { userId: user.id } } },
        { testerId: user.id },
        { creatorId: user.id },
        { subtasks: { some: { assigneeId: user.id } } },
      ],
    };
  }

  async findOne(id: string, user?: RequestUser) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (user && user.role.name === RoleName.EMPLOYEE) {
      const isAssignee = task.assigneeId === user.id;
      const isMultiAssignee = task.assignees?.some((a) => a.userId === user.id);
      const isTester = task.testerId === user.id;
      const isCreator = task.creatorId === user.id;
      const isSubtaskAssignee = task.subtasks?.some((st) => st.assigneeId === user.id);

      if (!isAssignee && !isMultiAssignee && !isTester && !isCreator && !isSubtaskAssignee) {
        throw new ForbiddenException("You do not have permission to view this task.");
      }
    }

    return task;
  }

  async create(dto: CreateTaskDto, creator: RequestUser) {
    const status = dto.status ?? TaskStatus.TODO;
    if (status === TaskStatus.DONE && !this.isAdminOrManager(creator)) {
      throw new ForbiddenException("Only a manager, admin, or tester can complete a task.");
    }
    const position = await this.nextPosition(dto.projectId ?? null, status);

    // Primary assignee
    const primaryAssigneeId = dto.assigneeId ?? (dto.assigneeIds && dto.assigneeIds.length > 0 ? dto.assigneeIds[0] : undefined);

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        projectId: dto.projectId,
        assigneeId: primaryAssigneeId,
        testerId: dto.testerId,
        testingNotes: dto.testingNotes,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        position,
        creatorId: creator.id,
        departmentId: dto.departmentId ?? creator.department?.id,
        storyPoints: dto.storyPoints,
        type: dto.type,
        sprintId: dto.sprintId,
        parentId: dto.parentId,
        taskListId: dto.taskListId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        tags: dto.tags,
      },
      include: taskInclude,
    });

    // Create TaskAssignee join entries for multiple assignees
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const uniqueAssigneeIds = Array.from(new Set(dto.assigneeIds));
      await this.prisma.taskAssignee.createMany({
        data: uniqueAssigneeIds.map((uId) => ({ taskId: task.id, userId: uId })),
        skipDuplicates: true,
      });
    }

    // Log Activity
    await this.prisma.taskActivityLog.create({
      data: {
        taskId: task.id,
        userId: creator.id,
        action: dto.parentId ? "SUBTASK_CREATED" : "TASK_CREATED",
        details: `Task "${task.title}" created.`,
      },
    });

    // Notify assignees
    const assigneesToNotify = dto.assigneeIds && dto.assigneeIds.length > 0 ? dto.assigneeIds : (primaryAssigneeId ? [primaryAssigneeId] : []);
    for (const uId of assigneesToNotify) {
      if (uId !== creator.id) {
        await this.notifications.create({
          userId: uId,
          type: "TASK_ASSIGNED",
          title: "New Task Assigned",
          message: `You have been assigned: "${dto.title}" by ${creator.firstName} ${creator.lastName}.`,
          link: "/tasks",
        });
      }
    }

    return this.findOne(task.id);
  }

  async update(id: string, dto: UpdateTaskDto, user: RequestUser) {
    const task = await this.getOwned(id);
    this.assertCanMutate(task, user);

    if (dto.status !== undefined && dto.status !== task.status) {
      await this.validateStatusTransition(task, dto.status, user);
    }

    // Only the designated Tester (or Manager/Admin) may record testing approval.
    if (dto.testingApproved !== undefined) {
      const isTesterOrAdmin =
        user.role.name === RoleName.ADMIN ||
        user.role.name === RoleName.MANAGER ||
        task.testerId === user.id;
      if (!isTesterOrAdmin) {
        throw new ForbiddenException("Only the assigned Tester, Manager, or Admin can approve testing.");
      }
    }

    // Update multiple assignees if provided
    if (dto.assigneeIds !== undefined) {
      await this.prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      if (dto.assigneeIds.length > 0) {
        const uniqueIds = Array.from(new Set(dto.assigneeIds));
        await this.prisma.taskAssignee.createMany({
          data: uniqueIds.map((uId) => ({ taskId: id, userId: uId })),
          skipDuplicates: true,
        });
      }
    }

    const primaryAssigneeId = dto.assigneeId !== undefined
      ? dto.assigneeId
      : (dto.assigneeIds && dto.assigneeIds.length > 0 ? dto.assigneeIds[0] : task.assigneeId);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        projectId: dto.projectId,
        assigneeId: primaryAssigneeId,
        testerId: dto.testerId,
        testingNotes: dto.testingNotes,
        // Reaching DONE is itself gated to Tester/Manager/Admin (see validateStatusTransition),
        // so it doubles as recording testing approval even if the caller didn't pass the flag.
        testingApproved: dto.status === TaskStatus.DONE ? true : dto.testingApproved,
        testingCompletedAt:
          dto.status === TaskStatus.DONE || dto.testingApproved === true
            ? new Date()
            : dto.testingApproved === false
              ? null
              : undefined,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        position: dto.position,
        departmentId: dto.departmentId,
        storyPoints: dto.storyPoints,
        type: dto.type,
        sprintId: dto.sprintId,
        parentId: dto.parentId,
        taskListId: dto.taskListId,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        tags: dto.tags,
      },
      include: taskInclude,
    });

    // Log Activity
    if (dto.status !== undefined && dto.status !== task.status) {
      await this.prisma.taskActivityLog.create({
        data: {
          taskId: id,
          userId: user.id,
          action: "STATUS_CHANGED",
          details: `Status changed from ${task.status} to ${dto.status}.`,
        },
      });

      await this.notifyStatusChange(task, updated.title, dto.status, user, updated.testerId);
    }

    return updated;
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const task = await this.getOwned(id);
    this.assertCanMutate(task, user);
    await this.prisma.task.delete({ where: { id } });
  }

  private async validateStatusTransition(
    task: { id: string; status: TaskStatus; parentId: string | null; testerId: string | null; creatorId: string },
    nextStatus: TaskStatus,
    user: RequestUser,
  ) {
    // Only the designated Tester (or a Manager/Admin override) may approve completion.
    // Note: deliberately excludes task.creatorId — a developer who self-created/self-assigned
    // a task must not be able to bypass tester validation just by being its creator.
    const isTesterOrAdmin =
      user.role.name === RoleName.ADMIN ||
      user.role.name === RoleName.MANAGER ||
      task.testerId === user.id;

    // Strict Rule: Developer cannot directly complete a task
    if (nextStatus === TaskStatus.DONE) {
      if (!isTesterOrAdmin) {
        throw new ForbiddenException("Developers cannot directly mark a task as Completed. Please set status to 'Ready for Testing' for Tester validation.");
      }

      // Fetch task with full relation checks for completion logic
      const fullTask = await this.prisma.task.findUnique({
        where: { id: task.id },
        include: {
          updates: true,
          timeLogs: true,
          bugs: true,
          subtasks: {
            include: {
              updates: true,
              timeLogs: true,
              bugs: true,
            },
          },
        },
      });

      if (!fullTask) throw new NotFoundException("Task not found");

      // Requirement 1: Daily updates check (at least 1 update on task or subtasks)
      const totalUpdates = fullTask.updates.length + fullTask.subtasks.reduce((acc, st) => acc + st.updates.length, 0);
      if (totalUpdates === 0) {
        throw new BadRequestException("Task cannot be completed until at least one Daily Work Update is logged.");
      }

      // Requirement 2: Time logs check (at least 1 time log on task or subtasks)
      const totalTimeLogs = fullTask.timeLogs.length + fullTask.subtasks.reduce((acc, st) => acc + st.timeLogs.length, 0);
      if (totalTimeLogs === 0) {
        throw new BadRequestException("Task cannot be completed until at least one Time Log is submitted.");
      }

      // Requirement 3: Open bugs check (0 open, assigned, in_progress, to_be_tested, retesting, reopened bugs)
      const allBugs = [
        ...fullTask.bugs,
        ...fullTask.subtasks.flatMap((st) => st.bugs),
      ];
      const openBugs = allBugs.filter((b) => b.status !== BugStatus.CLOSED);

      if (openBugs.length > 0) {
        const openList = openBugs.map((b) => `Bug #${b.bugNumber} (${b.status}): "${b.title}"`).join(", ");
        throw new BadRequestException(`Cannot complete task! ${openBugs.length} unresolved bug(s) remain: ${openList}. All bugs must be CLOSED first.`);
      }

      // Requirement 4: Parent Task Completion Rule (all subtasks must be DONE)
      if (fullTask.subtasks.length > 0) {
        const unfinishedSubtasks = fullTask.subtasks.filter((st) => st.status !== TaskStatus.DONE);
        if (unfinishedSubtasks.length > 0) {
          const subList = unfinishedSubtasks.map((st) => `"${st.title}" (${st.status})`).join(", ");
          throw new BadRequestException(`Cannot complete parent task! ${unfinishedSubtasks.length} subtask(s) are incomplete: ${subList}.`);
        }
      }
    }
  }

  private async notifyStatusChange(
    before: { creatorId: string; assigneeId: string | null; testerId: string | null },
    title: string,
    nextStatus: TaskStatus,
    actor: RequestUser,
    currentTesterId?: string | null,
  ) {
    const targetTester = currentTesterId || before.testerId;

    if (nextStatus === TaskStatus.READY_FOR_TESTING) {
      if (targetTester && targetTester !== actor.id) {
        await this.notifications.create({
          userId: targetTester,
          type: "TASK_UPDATED",
          title: "Task Ready for Testing",
          message: `"${title}" has been moved to Ready for Testing by ${actor.firstName} ${actor.lastName}.`,
          link: "/tasks",
        });
      }
      if (before.creatorId && before.creatorId !== actor.id && before.creatorId !== targetTester) {
        await this.notifications.create({
          userId: before.creatorId,
          type: "TASK_UPDATED",
          title: "Task Sent to Testing Queue",
          message: `"${title}" was submitted for testing by ${actor.firstName} ${actor.lastName}.`,
          link: "/tasks",
        });
      }
    } else if (nextStatus === TaskStatus.DONE) {
      if (before.assigneeId && before.assigneeId !== actor.id) {
        await this.notifications.create({
          userId: before.assigneeId,
          type: "TASK_UPDATED",
          title: "Task Approved & Completed",
          message: `"${title}" has been marked Completed after successful validation by ${actor.firstName} ${actor.lastName}.`,
          link: "/tasks",
        });
      }
    }
  }

  private async nextPosition(projectId: string | null, status: TaskStatus): Promise<number> {
    const last = await this.prisma.task.findFirst({
      where: { projectId, status },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async getOwned(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  private isAdminOrManager(user: RequestUser): boolean {
    return user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;
  }

  private assertCanMutate(
    task: { creatorId: string; assigneeId: string | null; departmentId: string | null; testerId?: string | null },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isOwner = task.creatorId === user.id || task.assigneeId === user.id || task.testerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (task.departmentId === null || task.departmentId === user.department?.id);
    if (!isAdmin && !isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this task");
    }
  }
}
