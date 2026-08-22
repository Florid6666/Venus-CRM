import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskUpdateDto } from "./dto/create-task-update.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const taskUpdateInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class TaskUpdatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForTask(taskId: string, user: RequestUser) {
    const task = await this.getOwned(taskId);
    this.assertCanView(task, user);

    return this.prisma.taskUpdate.findMany({
      where: { taskId },
      include: taskUpdateInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // Recent updates across every task in a sprint, for the sprint board's
  // activity feed -- same department-scoped visibility as Task/Sprint reads.
  async findForSprint(sprintId: string, user: RequestUser) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, departmentId: true },
    });
    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    const inScope = sprint.departmentId === null || sprint.departmentId === user.department?.id;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.taskUpdate.findMany({
      where: { task: { sprintId } },
      include: {
        ...taskUpdateInclude,
        task: { select: { id: true, taskNumber: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  // Recent updates across every task in a project, for the project detail
  // page's own "Daily Updates" feed -- same shape/scoping as findForSprint.
  async findForProject(projectId: string, user: RequestUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, departmentId: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    const inScope = project.departmentId === null || project.departmentId === user.department?.id;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.taskUpdate.findMany({
      where: { task: { projectId } },
      include: {
        ...taskUpdateInclude,
        task: { select: { id: true, taskNumber: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  // Recent updates across every task in a department, for the /tasks "Daily
  // Updates" tab -- same department-scoped visibility as findForSprint, but
  // scoped directly by department (no parent entity to resolve first) and
  // following this app's standard "Admin unscoped by default" convention
  // (same shape as TasksService's own visibilityScope).
  async findForDepartment(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;

    if (isAdmin && !departmentId) {
      return this.prisma.taskUpdate.findMany({
        include: { ...taskUpdateInclude, task: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }

    const targetDepartmentId = departmentId ?? user.department?.id;
    if (!isAdmin && targetDepartmentId !== user.department?.id) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.taskUpdate.findMany({
      where: { task: { OR: [{ departmentId: null }, { departmentId: targetDepartmentId }] } },
      include: { ...taskUpdateInclude, task: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async create(dto: CreateTaskUpdateDto, user: RequestUser) {
    const task = await this.getOwned(dto.taskId);
    this.assertCanPost(task, user);

    return this.prisma.taskUpdate.create({
      data: {
        taskId: dto.taskId,
        userId: user.id,
        content: dto.content,
      },
      include: taskUpdateInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const update = await this.prisma.taskUpdate.findUnique({
      where: { id },
      include: { task: { select: { departmentId: true } } },
    });
    if (!update) {
      throw new NotFoundException("Task update not found");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    const isAuthor = update.userId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (update.task.departmentId === null || update.task.departmentId === user.department?.id);

    if (!isAdmin && !isAuthor && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to delete this update");
    }

    await this.prisma.taskUpdate.delete({ where: { id } });
  }

  private async getOwned(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, departmentId: true, assigneeId: true, creatorId: true },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  // Same department-scoped read visibility as Task itself -- anyone in the
  // task's department (or a legacy unscoped task) can see its update log.
  private assertCanView(
    task: { departmentId: string | null },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const inScope = task.departmentId === null || task.departmentId === user.department?.id;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("Access denied");
    }
  }

  // Posting is narrower than viewing: only the people who could also edit
  // the task itself (assignee/creator, same-department Manager, or Admin) --
  // mirrors TasksService.assertCanMutate.
  private assertCanPost(
    task: { assigneeId: string | null; creatorId: string; departmentId: string | null },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isOwner = task.creatorId === user.id || task.assigneeId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (task.departmentId === null || task.departmentId === user.department?.id);
    if (!isAdmin && !isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to post updates on this task");
    }
  }
}
