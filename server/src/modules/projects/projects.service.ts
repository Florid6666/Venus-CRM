import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { GithubService } from "../github-integration/github.service";
import type { RequestUser } from "../../common/types/request-user.type";

const projectInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  _count: { select: { tasks: true } },
} as const;

const memberSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  githubUsername: true,
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
  ) {}

  findAll(filters: { status?: ProjectStatus; ownerId?: string; departmentId?: string }, user: RequestUser) {
    return this.prisma.project.findMany({
      where: {
        status: filters.status,
        ownerId: filters.ownerId,
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: projectInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // Same rationale as TasksService.visibilityScope -- non-Admins only see
  // their own department's projects (plus legacy/unscoped rows). A
  // caller-supplied departmentId narrows further for Admin only -- it must
  // never let a non-Admin see another department's projects.
  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }

    // EMPLOYEE role strict visibility scope:
    // Only projects where employee is owner, member, or has tasks assigned
    return {
      OR: [
        { ownerId: user.id },
        { members: { some: { id: user.id } } },
        {
          tasks: {
            some: {
              OR: [
                { assigneeId: user.id },
                { assignees: { some: { userId: user.id } } },
                { testerId: user.id },
                { subtasks: { some: { assigneeId: user.id } } },
              ],
            },
          },
        },
      ],
    };
  }

  async findOne(id: string, user?: RequestUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        ...projectInclude,
        members: { select: memberSelect, orderBy: { firstName: "asc" } },
        tasks: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            assignees: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
            tester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            subtasks: { select: { id: true, assigneeId: true } },
            taskList: { select: { id: true, name: true } },
            timeLogs: { select: { minutes: true } },
            updates: {
              take: 1,
              orderBy: { createdAt: "desc" },
              include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
            },
          },
          orderBy: { position: "asc" },
        },
        taskLists: { include: { _count: { select: { tasks: true } } }, orderBy: { position: "asc" } },
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    if (user && user.role.name === RoleName.EMPLOYEE) {
      const isOwner = project.ownerId === user.id;
      const isMember = project.members.some((m) => m.id === user.id);
      const hasAssignedTask = project.tasks.some(
        (t) =>
          t.assigneeId === user.id ||
          t.assignees?.some((a) => a.userId === user.id) ||
          t.testerId === user.id ||
          t.creatorId === user.id ||
          t.subtasks?.some((st) => st.assigneeId === user.id)
      );

      if (!isOwner && !isMember && !hasAssignedTask) {
        throw new ForbiddenException("You do not have permission to view this project.");
      }

      // Scoped view: Filter tasks so employee only sees tasks assigned to them / shared with them
      project.tasks = project.tasks.filter(
        (t) =>
          t.assigneeId === user.id ||
          t.assignees?.some((a) => a.userId === user.id) ||
          t.testerId === user.id ||
          t.creatorId === user.id ||
          t.subtasks?.some((st) => st.assigneeId === user.id)
      );
    }

    return project;
  }

  async create(dto: CreateProjectDto, owner: RequestUser) {
    if (owner.role.name !== RoleName.ADMIN && owner.role.name !== RoleName.MANAGER) {
      throw new ForbiddenException("Only managers and admins can create projects");
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status ?? ProjectStatus.ACTIVE,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        ownerId: owner.id,
        departmentId: dto.departmentId ?? owner.department?.id,
        // githubUrl is intentionally NOT taken from the DTO -- it's set below
        // from the repo the app actually creates, not free-text client input.
        projectPassword: dto.projectPassword,
      },
      include: projectInclude,
    });

    // Best-effort: if GitHub is connected, auto-create a private repo and
    // store its URL. Any GitHub failure is swallowed inside the service and
    // returns null -- the project already exists and must not be rolled back.
    const repo = await this.githubService.createRepoForProject(project.name, project.description);
    if (repo) {
      return this.prisma.project.update({
        where: { id: project.id },
        data: { githubUrl: repo.htmlUrl },
        include: projectInclude,
      });
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: RequestUser) {
    const project = await this.getOwned(id);
    this.assertCanMutate(project, user);

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        ownerId: dto.ownerId,
        departmentId: dto.departmentId,
        githubUrl: dto.githubUrl,
        projectPassword: dto.projectPassword,
      },
      include: projectInclude,
    });
  }

  // Soft-archive rather than delete -- keeps task history intact.
  async archive(id: string, user: RequestUser) {
    const project = await this.getOwned(id);
    this.assertCanMutate(project, user);

    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.ARCHIVED },
      include: projectInclude,
    });
  }

  // Adds a Venus CRM user as a project member, and -- if the project has a repo
  // and the member has linked their GitHub username -- invites them to the
  // repo as a collaborator (best-effort). githubInvited reflects whether that
  // invite call succeeded so the UI can show it.
  async addMember(projectId: string, userId: string, actor: RequestUser) {
    const project = await this.getOwned(projectId);
    this.assertCanMutate(project, actor);

    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: memberSelect,
    });
    if (!member) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { members: { connect: { id: userId } } },
    });

    let githubInvited = false;
    const repoName = this.githubService.repoNameFromUrl(project.githubUrl);
    if (repoName && member.githubUsername) {
      githubInvited = await this.githubService.inviteCollaborator(repoName, member.githubUsername);
    }

    return { githubInvited, project: await this.findOne(projectId) };
  }

  async removeMember(projectId: string, userId: string, actor: RequestUser) {
    const project = await this.getOwned(projectId);
    this.assertCanMutate(project, actor);

    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: memberSelect,
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { members: { disconnect: { id: userId } } },
    });

    const repoName = this.githubService.repoNameFromUrl(project.githubUrl);
    if (repoName && member?.githubUsername) {
      await this.githubService.removeCollaborator(repoName, member.githubUsername);
    }

    return this.findOne(projectId);
  }

  private async getOwned(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  // TODO: revisit ACL model -- owner, ADMIN, or a same-department MANAGER
  // only, for now. See TasksService.assertCanMutate for the full rationale
  // (phase 6): MANAGER privilege is scoped to their own department; ADMIN
  // stays a global override; departmentId === null (legacy/unscoped) is
  // manageable by any MANAGER.
  private assertCanMutate(project: { ownerId: string; departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isOwner = project.ownerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (project.departmentId === null || project.departmentId === user.department?.id);
    if (!isAdmin && !isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this project");
    }
  }
}
