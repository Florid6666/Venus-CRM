import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkSessionsService } from "../work-sessions/work-sessions.service";
import { canViewMonitoringData } from "../../common/utils/monitoring-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Same 30-day window + opportunistic-sweep-on-write pattern as ScreenCapture.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Below this many seconds of OS-reported idle time, a ping counts as
// "active" -- a short away-from-keyboard moment (reading something on
// screen) shouldn't register as idle. idleSeconds itself comes from
// Electron's powerMonitor.getSystemIdleTime() on the desktop agent -- an
// OS-level "seconds since last input" signal, never individual key/click
// events.
const ACTIVE_THRESHOLD_SECONDS = 90;

const summaryUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
} as const;

type SummaryUser = { id: string } & Record<string, unknown>;

@Injectable()
export class ActivityMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workSessions: WorkSessionsService,
  ) {}

  // Called by the desktop agent, authenticated as the employee being
  // measured -- same "must be clocked in" gate as screen captures.
  async create(user: RequestUser, idleSeconds: number) {
    const activeSession = await this.workSessions.getActive(user.id);
    if (!activeSession) {
      throw new ConflictException("You must be clocked in to send an activity ping");
    }

    const active = idleSeconds < ACTIVE_THRESHOLD_SECONDS;
    const ping = await this.prisma.activityPing.create({
      data: { userId: user.id, workSessionId: activeSession.id, idleSeconds, active },
    });

    if (Math.random() < 0.05) {
      await this.sweepExpired();
    }

    return { id: ping.id, active, capturedAt: ping.capturedAt };
  }

  async summary(viewer: RequestUser, filters: { userId?: string; from?: string; to?: string }) {
    const capturedAt = this.dateFilter(filters);

    if (filters.userId) {
      const target = await this.getTargetOrThrow(filters.userId);
      if (!canViewMonitoringData(viewer, target)) {
        throw new ForbiddenException("You do not have permission to view this user's activity");
      }
      return this.aggregateFor([filters.userId], capturedAt);
    }

    // No specific user requested -- same broad-visibility rule as
    // ScreenMonitoringService.list: Admin/HR see the company, a Manager
    // sees their own department, anyone else gets nothing.
    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = viewer.department?.name === "HR";
    const isManager = viewer.role.name === RoleName.MANAGER;
    if (!isAdmin && !isHR && !isManager) {
      throw new ForbiddenException("You do not have permission to view activity data");
    }

    const scope = isAdmin || isHR ? {} : { departmentId: viewer.department?.id };
    const users = await this.prisma.user.findMany({ where: scope, select: summaryUserSelect });
    return this.aggregateFor(
      users.map((u) => u.id),
      capturedAt,
      users,
    );
  }

  private async aggregateFor(
    userIds: string[],
    capturedAt: { gte?: Date; lte?: Date } | undefined,
    knownUsers?: SummaryUser[],
  ) {
    if (userIds.length === 0) return [];

    const grouped = await this.prisma.activityPing.groupBy({
      by: ["userId", "active"],
      where: { userId: { in: userIds }, ...(capturedAt ? { capturedAt } : {}) },
      _count: true,
    });

    const users =
      knownUsers ?? (await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: summaryUserSelect }));
    const usersById = new Map(users.map((u) => [u.id, u]));

    const countsByUser = new Map<string, { active: number; total: number }>();
    for (const row of grouped) {
      const existing = countsByUser.get(row.userId) ?? { active: 0, total: 0 };
      existing.total += row._count;
      if (row.active) existing.active += row._count;
      countsByUser.set(row.userId, existing);
    }

    return userIds
      .map((id) => {
        const counts = countsByUser.get(id);
        const user = usersById.get(id);
        if (!counts || !user) return null;
        return {
          user,
          totalPings: counts.total,
          activePings: counts.active,
          activePercent: Math.round((counts.active / counts.total) * 100),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.activePercent - a.activePercent);
  }

  private dateFilter(filters: { from?: string; to?: string }) {
    if (!filters.from && !filters.to) return undefined;
    return {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  private async getTargetOrThrow(userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { department: { select: { id: true } } },
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    return target;
  }

  private async sweepExpired() {
    await this.prisma.activityPing.deleteMany({
      where: { capturedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    });
  }
}
