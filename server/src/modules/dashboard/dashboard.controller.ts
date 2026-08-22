import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("sales")
  getSalesStats(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getSalesStats(user);
  }
}
