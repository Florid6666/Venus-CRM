import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ActivityMonitoringService } from "./activity-monitoring.service";
import { CreateActivityPingDto } from "./dto/create-activity-ping.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("activity-monitoring")
export class ActivityMonitoringController {
  constructor(private readonly service: ActivityMonitoringService) {}

  // Sent by the desktop agent, authenticated as the employee whose idle
  // time this is -- userId always comes from the token, never the body.
  @Post("pings")
  create(@Body() dto: CreateActivityPingDto, @CurrentUser() user: RequestUser) {
    return this.service.create(user, dto.idleSeconds);
  }

  @Get("summary")
  summary(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.summary(user, { userId, from, to });
  }
}
