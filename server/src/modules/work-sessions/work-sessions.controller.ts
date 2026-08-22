import { Controller, Get, Post, Query } from "@nestjs/common";
import { WorkSessionsService } from "./work-sessions.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("work-sessions")
export class WorkSessionsController {
  constructor(private readonly workSessionsService: WorkSessionsService) {}

  /** GET /work-sessions — own sessions (or all, for Admin/HR) */
  @Get()
  list(@CurrentUser() user: RequestUser, @Query("userId") userId?: string) {
    if (userId) {
      return this.workSessionsService.list(userId, user);
    }
    return this.workSessionsService.listAll(user);
  }

  /** GET /work-sessions/active — returns the user's open session or null */
  @Get("active")
  getActive(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.getActive(user.id);
  }

  /** POST /work-sessions/clock-in — start a new session */
  @Post("clock-in")
  clockIn(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.clockIn(user);
  }

  /** POST /work-sessions/clock-out — end the active session */
  @Post("clock-out")
  clockOut(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.clockOut(user);
  }
}
