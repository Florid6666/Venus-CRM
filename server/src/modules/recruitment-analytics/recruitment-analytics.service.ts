import { Injectable } from "@nestjs/common";
import { CandidateStage, InterviewStatus, JobPostingStatus, OfferStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class RecruitmentAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Same rationale as TasksService.visibilityScope -- a non-Admin's hiring
  // analytics reflect only their own department's data (in practice,
  // Recruitment); Admin keeps seeing company-wide totals.
  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  async getSummary(user: RequestUser) {
    const scope = this.visibilityScope(user);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      openPositions,
      totalCandidates,
      stageGroups,
      hiresThisMonth,
      hiredWithDates,
      offerGroups,
      upcomingInterviews,
      openPostingsByHiringDept,
    ] = await Promise.all([
      this.prisma.jobPosting.count({ where: { status: JobPostingStatus.OPEN, ...scope } }),
      this.prisma.candidate.count({ where: scope }),
      this.prisma.candidate.groupBy({ by: ["stage"], where: scope, _count: true }),
      this.prisma.candidate.count({
        where: { stage: CandidateStage.HIRED, closedAt: { gte: startOfMonth }, ...scope },
      }),
      // Only the (small) set of already-hired candidates -- not a full-table
      // scan -- to compute average time-to-hire.
      this.prisma.candidate.findMany({
        where: { stage: CandidateStage.HIRED, closedAt: { not: null }, ...scope },
        select: { appliedAt: true, closedAt: true },
      }),
      this.prisma.offer.groupBy({ by: ["status"], where: scope, _count: true }),
      this.prisma.interview.count({
        where: { status: InterviewStatus.SCHEDULED, scheduledAt: { gte: now }, ...scope },
      }),
      this.prisma.jobPosting.groupBy({
        by: ["hiringDepartmentId"],
        where: { status: JobPostingStatus.OPEN, ...scope },
        _count: true,
      }),
    ]);

    const stageCounts = Object.values(CandidateStage).reduce(
      (acc, stage) => {
        acc[stage] = stageGroups.find((g) => g.stage === stage)?._count ?? 0;
        return acc;
      },
      {} as Record<CandidateStage, number>,
    );

    const avgTimeToHireDays =
      hiredWithDates.length > 0
        ? Math.round(
            hiredWithDates.reduce((sum, c) => sum + (c.closedAt!.getTime() - c.appliedAt.getTime()), 0) /
              hiredWithDates.length /
              (1000 * 60 * 60 * 24),
          )
        : null;

    const offerCounts = Object.values(OfferStatus).reduce(
      (acc, status) => {
        acc[status] = offerGroups.find((g) => g.status === status)?._count ?? 0;
        return acc;
      },
      {} as Record<OfferStatus, number>,
    );
    const respondedOffers = offerCounts.ACCEPTED + offerCounts.DECLINED;
    const offerAcceptanceRate =
      respondedOffers > 0 ? Math.round((offerCounts.ACCEPTED / respondedOffers) * 100) : null;

    // groupBy only returns hiring-department ids, not names.
    const hiringDeptIds = openPostingsByHiringDept
      .map((g) => g.hiringDepartmentId)
      .filter((id): id is string => !!id);
    const departments = hiringDeptIds.length
      ? await this.prisma.department.findMany({
          where: { id: { in: hiringDeptIds } },
          select: { id: true, name: true },
        })
      : [];
    const openPositionsByDepartment = openPostingsByHiringDept.map((g) => ({
      departmentId: g.hiringDepartmentId,
      departmentName: departments.find((d) => d.id === g.hiringDepartmentId)?.name ?? "Unassigned",
      count: g._count,
    }));

    return {
      openPositions,
      totalCandidates,
      stageCounts,
      hiresThisMonth,
      avgTimeToHireDays,
      offerCounts,
      offerAcceptanceRate,
      upcomingInterviews,
      openPositionsByDepartment,
    };
  }
}
