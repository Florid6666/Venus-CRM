import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkSessionsService } from "../work-sessions/work-sessions.service";
import { ScreenRecordingStorageService } from "./screen-recording-storage.service";
import { canViewMonitoringData } from "../../common/utils/monitoring-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Deliberately far shorter than ScreenCapture's 30 days. A 3-minute clip is
// three orders of magnitude bigger than a JPEG still, and 27 of them per
// employee per day fills a volume fast -- see the sizing note in
// PERMISSIONS.md. Overridable so a bigger volume can hold more history.
const RETENTION_DAYS = Number(process.env.SCREEN_RECORDING_RETENTION_DAYS ?? 7);
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Recording is limited to one department for now -- the Sales team and their
// manager, nobody else. Enforced here rather than in the desktop agent on
// purpose: the agent is software running on the employee's own machine, so an
// old or modified build must not be able to record someone who isn't covered.
// A non-Sales agent gets a clean 403 and stops scheduling.
//
// Comma-separated so the rollout can widen without a code change.
const RECORDED_DEPARTMENTS = (process.env.SCREEN_RECORDING_DEPARTMENTS ?? "Sales")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

function isRecordedDepartment(user: RequestUser): boolean {
  const department = user.department?.name?.toLowerCase();
  return !!department && RECORDED_DEPARTMENTS.includes(department);
}

const recordingUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ScreenRecordingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workSessions: WorkSessionsService,
    private readonly storage: ScreenRecordingStorageService,
  ) {}

  // Called by the desktop agent, authenticated as the employee whose screen
  // this is. Only allowed while clocked in -- monitoring is explicitly scoped
  // to work hours, not the employee's personal time on the same laptop. The
  // agent treats the 409 as a dropped clip rather than a retryable failure.
  async create(user: RequestUser, file: Express.Multer.File, durationSec: number) {
    // Checked before anything is kept: a clip from a department that isn't
    // being recorded is deleted off the volume immediately, never written to
    // the database, and never viewable by anyone.
    if (!isRecordedDepartment(user)) {
      await this.storage.delete(file.filename);
      throw new ForbiddenException("Screen recording is not enabled for your department");
    }

    const activeSession = await this.workSessions.getActive(user.id);
    if (!activeSession) {
      await this.storage.delete(file.filename);
      throw new ConflictException("You must be clocked in to upload a screen recording");
    }

    const recording = await this.prisma.screenRecording.create({
      data: {
        userId: user.id,
        workSessionId: activeSession.id,
        storagePath: file.filename,
        mimeType: file.mimetype || "video/webm",
        sizeBytes: file.size,
        durationSec,
      },
    });

    // Same opportunistic 5%-of-writes sweep as the screenshot retention --
    // costs almost nothing and is bounded by the startedAt index.
    if (Math.random() < 0.05) {
      await this.sweepExpired();
    }

    return { id: recording.id, startedAt: recording.startedAt };
  }

  async list(viewer: RequestUser, filters: { userId?: string; from?: string; to?: string }) {
    const startedAt = this.dateFilter(filters);

    if (filters.userId) {
      const target = await this.getTargetOrThrow(filters.userId);
      if (!canViewMonitoringData(viewer, target)) {
        throw new ForbiddenException("You do not have permission to view this user's recordings");
      }
      return this.prisma.screenRecording.findMany({
        where: { userId: filters.userId, ...(startedAt ? { startedAt } : {}) },
        orderBy: { startedAt: "desc" },
        take: 200,
        select: this.listSelect(),
      });
    }

    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = viewer.department?.name === "HR";
    const isManager = viewer.role.name === RoleName.MANAGER;
    if (!isAdmin && !isHR && !isManager) {
      throw new ForbiddenException("You do not have permission to view screen recordings");
    }

    const scope = isAdmin || isHR ? {} : { user: { departmentId: viewer.department?.id } };
    return this.prisma.screenRecording.findMany({
      where: { ...scope, ...(startedAt ? { startedAt } : {}) },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: this.listSelect(),
    });
  }

  async getForPlayback(id: string, viewer: RequestUser) {
    const recording = await this.prisma.screenRecording.findUnique({
      where: { id },
      select: {
        storagePath: true,
        mimeType: true,
        user: { select: { department: { select: { id: true } } } },
      },
    });
    if (!recording) {
      throw new NotFoundException("Recording not found");
    }
    if (!canViewMonitoringData(viewer, recording.user)) {
      throw new ForbiddenException("You do not have permission to view this recording");
    }
    return recording;
  }

  // Same asymmetry as login photos: a department Manager can watch their
  // team's recordings but not delete them -- clearing monitoring evidence is
  // an HR/Admin action.
  async remove(id: string, viewer: RequestUser): Promise<void> {
    const recording = await this.prisma.screenRecording.findUnique({
      where: { id },
      select: { storagePath: true },
    });
    if (!recording) {
      throw new NotFoundException("Recording not found");
    }
    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = viewer.department?.name === "HR";
    if (!isAdmin && !isHR) {
      throw new ForbiddenException("Only Admin or HR can delete screen recordings");
    }
    await this.storage.delete(recording.storagePath);
    await this.prisma.screenRecording.delete({ where: { id } });
  }

  fileSize(storagePath: string): Promise<number> {
    return this.storage.size(storagePath);
  }

  fileStream(storagePath: string, start: number, end: number) {
    return this.storage.stream(storagePath, start, end);
  }

  private listSelect() {
    return {
      id: true,
      startedAt: true,
      durationSec: true,
      sizeBytes: true,
      user: { select: recordingUserSelect },
    } as const;
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
    const expired = await this.prisma.screenRecording.findMany({
      where: { startedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
      select: { id: true, storagePath: true },
      take: 200,
    });
    if (expired.length === 0) return;
    await Promise.all(expired.map((r) => this.storage.delete(r.storagePath)));
    await this.prisma.screenRecording.deleteMany({
      where: { id: { in: expired.map((r) => r.id) } },
    });
  }
}
