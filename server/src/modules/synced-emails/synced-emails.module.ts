import { Module } from "@nestjs/common";
import { SyncedEmailsController } from "./synced-emails.controller";
import { SyncedEmailsService } from "./synced-emails.service";

@Module({
  controllers: [SyncedEmailsController],
  providers: [SyncedEmailsService],
})
export class SyncedEmailsModule {}
