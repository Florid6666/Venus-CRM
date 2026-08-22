import { Module } from "@nestjs/common";
import { TaskUpdatesController } from "./task-updates.controller";
import { TaskUpdatesService } from "./task-updates.service";

@Module({
  controllers: [TaskUpdatesController],
  providers: [TaskUpdatesService],
  exports: [TaskUpdatesService],
})
export class TaskUpdatesModule {}
