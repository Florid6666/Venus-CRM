import { Controller, Get } from "@nestjs/common";
import { RecruitmentAnalyticsService } from "./recruitment-analytics.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("recruitment-analytics")
export class RecruitmentAnalyticsController {
  constructor(private readonly recruitmentAnalyticsService: RecruitmentAnalyticsService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: RequestUser) {
    return this.recruitmentAnalyticsService.getSummary(user);
  }
}
