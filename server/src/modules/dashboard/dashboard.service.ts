import { Injectable } from "@nestjs/common";
import { DealStage, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

const dealInclude = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

const OPEN_STAGES_EXCLUDED: DealStage[] = [DealStage.WON, DealStage.LOST, DealStage.ARCHIVED];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesStats(user: RequestUser) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const months = this.getLastSixMonths(now);
    const startOfWindow = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const scope = this.visibilityScope(user);

    const [pipelineAgg, wonAgg, lostAgg, topOpenDeals, wonDealsInWindow] = await Promise.all([
      this.prisma.deal.aggregate({
        where: { stage: { notIn: OPEN_STAGES_EXCLUDED }, ...scope },
        _sum: { value: true },
      }),
      this.prisma.deal.aggregate({
        where: { stage: DealStage.WON, closedAt: { gte: startOfMonth }, ...scope },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.deal.aggregate({
        where: { stage: DealStage.LOST, closedAt: { gte: startOfMonth }, ...scope },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.deal.findMany({
        where: { stage: { notIn: OPEN_STAGES_EXCLUDED }, ...scope },
        orderBy: { value: "desc" },
        take: 5,
        include: dealInclude,
      }),
      this.prisma.deal.findMany({
        where: { stage: DealStage.WON, closedAt: { gte: startOfWindow }, ...scope },
        select: { value: true, closedAt: true },
      }),
    ]);

    const wonCount = wonAgg._count;
    const lostCount = lostAgg._count;
    const totalClosed = wonCount + lostCount;

    const valueByMonth = new Map<string, number>(months.map((m) => [m, 0]));
    for (const deal of wonDealsInWindow) {
      if (!deal.closedAt) continue;
      const key = this.monthKey(deal.closedAt);
      if (valueByMonth.has(key)) {
        valueByMonth.set(key, (valueByMonth.get(key) ?? 0) + deal.value);
      }
    }

    return {
      openPipelineValue: pipelineAgg._sum.value ?? 0,
      wonThisMonth: { count: wonCount, value: wonAgg._sum.value ?? 0 },
      lostThisMonth: { count: lostCount, value: lostAgg._sum.value ?? 0 },
      winRateThisMonth: totalClosed > 0 ? (wonCount / totalClosed) * 100 : null,
      topOpenDeals,
      revenueByMonth: months.map((month) => ({ month, value: valueByMonth.get(month) ?? 0 })),
    };
  }

  // Same rationale as TasksService.visibilityScope -- a non-Admin's dashboard
  // reflects only their own department's deals (plus legacy/unscoped ones);
  // Admin keeps seeing company-wide totals.
  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private getLastSixMonths(now: Date): string[] {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(this.monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    return months;
  }
}
