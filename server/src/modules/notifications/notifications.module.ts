import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Export so other modules (LeaveRequests, Tasks) can inject NotificationsService
  exports: [NotificationsService],
})
export class NotificationsModule {}
