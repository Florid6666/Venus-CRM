import { Module } from "@nestjs/common";
import { ActivityMonitoringController } from "./activity-monitoring.controller";
import { ActivityMonitoringService } from "./activity-monitoring.service";
import { WorkSessionsModule } from "../work-sessions/work-sessions.module";

@Module({
  imports: [WorkSessionsModule],
  controllers: [ActivityMonitoringController],
  providers: [ActivityMonitoringService],
})
export class ActivityMonitoringModule {}
