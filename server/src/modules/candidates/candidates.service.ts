import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CandidateStage, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const candidateInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  jobPosting: { select: { id: true, title: true } },
} as const;

interface CandidateFilters {
  jobPostingId?: string;
  stage?: CandidateStage;
  ownerId?: string;
  departmentId?: string;
}

// Candidate.closedAt marks when a candidate's process actually ended --
// same rationale as Deal.closedAt (updatedAt changes on any edit and can't
// answer "when did this stop being an open candidacy" for hiring analytics).
const CLOSED_STAGES: CandidateStage[] = [CandidateStage.HIRED, CandidateStage.REJECTED];

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: CandidateFilters, user: RequestUser) {
    return this.prisma.candidate.findMany({
      where: {
        jobPostingId: filters.jobPostingId,
        stage: filters.stage,
        ownerId: filters.ownerId,
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: candidateInclude,
      orderBy: [{ stage: "asc" }, { position: "asc" }],
    });
  }

  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  async findOne(id: string, user: RequestUser) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        ...candidateInclude,
        interviews: {
          include: {
            interviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { scheduledAt: "asc" },
        },
        offers: {
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    this.assertCanAccess(candidate, user);
    return candidate;
  }

  async create(dto: CreateCandidateDto, creator: RequestUser) {
    await this.assertJobPostingExists(dto.jobPostingId);
    const stage = dto.stage ?? CandidateStage.APPLIED;
    const position = dto.position ?? (await this.nextPosition(dto.jobPostingId, stage));

    return this.prisma.candidate.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        resumeUrl: dto.resumeUrl,
        source: dto.source,
        stage,
        position,
        rejectionReason: dto.rejectionReason,
        jobPostingId: dto.jobPostingId,
        ownerId: dto.ownerId ?? creator.id,
        departmentId: dto.departmentId ?? creator.department?.id,
        closedAt: CLOSED_STAGES.includes(stage) ? new Date() : undefined,
      },
      include: candidateInclude,
    });
  }

  async update(id: string, dto: UpdateCandidateDto, user: RequestUser) {
    const candidate = await this.getOwned(id);
    this.assertCanMutate(candidate, user);

    return this.prisma.candidate.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        resumeUrl: dto.resumeUrl,
        source: dto.source,
        stage: dto.stage,
        position: dto.position,
        rejectionReason: dto.rejectionReason,
        ownerId: dto.ownerId,
        closedAt: this.resolveClosedAt(dto.stage),
      },
      include: candidateInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const candidate = await this.getOwned(id);
    this.assertCanMutate(candidate, user);
    await this.prisma.candidate.delete({ where: { id } });
  }

  // undefined = stage not changing, don't touch closedAt. HIRED/REJECTED =
  // just closed, stamp now. Anything else = moved back to an open stage,
  // clear it (e.g. reopened from Rejected).
  private resolveClosedAt(newStage: CandidateStage | undefined): Date | null | undefined {
    if (newStage === undefined) {
      return undefined;
    }
    return CLOSED_STAGES.includes(newStage) ? new Date() : null;
  }

  private async nextPosition(jobPostingId: string, stage: CandidateStage): Promise<number> {
    const last = await this.prisma.candidate.findFirst({
      where: { jobPostingId, stage },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async getOwned(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    return candidate;
  }

  private async assertJobPostingExists(jobPostingId: string) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
  }

  private assertCanAccess(candidate: { departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && candidate.departmentId !== null && candidate.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this candidate");
    }
  }

  // Deliberately broader than the owner-scoped pattern used for Deals/Projects:
  // a candidate pipeline is a shared team artifact, so ANY member of the
  // candidate's own department (not just the creator) can move/edit/remove it.
  // Recruiters routinely work each other's candidates. Admin is a global
  // override; departmentId === null (legacy/unscoped) is manageable by anyone.
  private assertCanMutate(candidate: { departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isSameDepartment =
      candidate.departmentId === null || candidate.departmentId === user.department?.id;
    if (!isAdmin && !isSameDepartment) {
      throw new ForbiddenException("You do not have permission to modify this candidate");
    }
  }
}
