import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class WorkSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Start a new work session for the requesting user.
   * Fails if the user already has an active (un-clocked-out) session.
   */
  async clockIn(user: RequestUser) {
    const active = await this.findActiveSession(user.id);
    if (active) {
      throw new BadRequestException(
        "You already have an active session. Clock out first.",
      );
    }

    const now = new Date();
    // Store date at midnight UTC of the clock-in day for grouping
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);

    return this.prisma.workSession.create({
      data: {
        userId: user.id,
        clockInAt: now,
        date,
      },
    });
  }

  /**
   * End the user's active session.
   * durationMin is stored so reports never need to re-calculate.
   * Night-shift safe: clockOutAt can be on any day after clockInAt.
   */
  async clockOut(user: RequestUser) {
    const active = await this.findActiveSession(user.id);
    if (!active) {
      throw new BadRequestException("No active session to clock out from.");
    }

    const now = new Date();
    const durationMin = Math.round(
      (now.getTime() - active.clockInAt.getTime()) / 60000,
    );

    return this.prisma.workSession.update({
      where: { id: active.id },
      data: { clockOutAt: now, durationMin },
    });
  }

  /** Get the currently active (open) session for the user, or null. */
  getActive(userId: string) {
    return this.findActiveSession(userId);
  }

  /**
   * List sessions for a user.
   * Admins can query any userId; employees only see their own.
   */
  list(userId: string, requestingUser: RequestUser) {
    const targetId =
      requestingUser.role.name === RoleName.ADMIN
        ? userId
        : requestingUser.id;

    return this.prisma.workSession.findMany({
      where: { userId: targetId },
      orderBy: { clockInAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  /** Admin: list all sessions across all users (for HR/payroll view). */
  listAll(requestingUser: RequestUser) {
    if (requestingUser.role.name !== RoleName.ADMIN &&
        requestingUser.department?.name !== "HR") {
      // Non-admin/HR: only own sessions
      return this.list(requestingUser.id, requestingUser);
    }
    return this.prisma.workSession.findMany({
      orderBy: { clockInAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  private findActiveSession(userId: string) {
    return this.prisma.workSession.findFirst({
      where: { userId, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });
  }
}
