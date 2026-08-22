import { Module } from "@nestjs/common";
import { ScreenRecordingsController } from "./screen-recordings.controller";
import { ScreenRecordingsService } from "./screen-recordings.service";
import { ScreenRecordingStorageService } from "./screen-recording-storage.service";
import { WorkSessionsModule } from "../work-sessions/work-sessions.module";

@Module({
  imports: [WorkSessionsModule],
  controllers: [ScreenRecordingsController],
  providers: [ScreenRecordingsService, ScreenRecordingStorageService],
})
export class ScreenRecordingsModule {}
