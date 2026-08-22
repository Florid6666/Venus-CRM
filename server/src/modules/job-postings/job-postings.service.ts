import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { JobPostingStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateJobPostingDto } from "./dto/create-job-posting.dto";
import { UpdateJobPostingDto } from "./dto/update-job-posting.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const jobPostingInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  hiringDepartment: { select: { id: true, name: true } },
  _count: { select: { candidates: true } },
} as const;

interface JobPostingFilters {
  status?: JobPostingStatus;
  hiringDepartmentId?: string;
  departmentId?: string;
}

@Injectable()
export class JobPostingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: JobPostingFilters, user: RequestUser) {
    return this.prisma.jobPosting.findMany({
      where: {
        status: filters.status,
        hiringDepartmentId: filters.hiringDepartmentId,
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: jobPostingInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // Same rationale as TasksService.visibilityScope -- non-Admins only see
  // their own department's postings (plus legacy/unscoped rows), which in
  // practice means Recruitment + Admin, matching the frontend department
  // guard. A caller-supplied departmentId narrows further for Admin only.
  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  async findOne(id: string) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id }, include: jobPostingInclude });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
    return posting;
  }

  create(dto: CreateJobPostingDto, creator: RequestUser) {
    return this.prisma.jobPosting.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        employmentType: dto.employmentType,
        status: dto.status,
        hiringDepartmentId: dto.hiringDepartmentId,
        ownerId: dto.ownerId ?? creator.id,
        departmentId: dto.departmentId ?? creator.department?.id,
      },
      include: jobPostingInclude,
    });
  }

  async update(id: string, dto: UpdateJobPostingDto, user: RequestUser) {
    const posting = await this.getOwned(id);
    this.assertCanMutate(posting, user);

    return this.prisma.jobPosting.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        employmentType: dto.employmentType,
        status: dto.status,
        hiringDepartmentId: dto.hiringDepartmentId,
        ownerId: dto.ownerId,
      },
      include: jobPostingInclude,
    });
  }

  async close(id: string, user: RequestUser) {
    const posting = await this.getOwned(id);
    this.assertCanMutate(posting, user);

    return this.prisma.jobPosting.update({
      where: { id },
      data: { status: JobPostingStatus.CLOSED },
      include: jobPostingInclude,
    });
  }

  private async getOwned(id: string) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
    return posting;
  }

  // Same pattern as DealsService/ProjectsService.assertCanMutate: ADMIN
  // unconditional, owner always, same-department MANAGER, null departmentId
  // treated as unscoped/manageable by any Manager.
  private assertCanMutate(posting: { ownerId: string; departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isOwner = posting.ownerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (posting.departmentId === null || posting.departmentId === user.department?.id);
    if (!isAdmin && !isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this job posting");
    }
  }
}
