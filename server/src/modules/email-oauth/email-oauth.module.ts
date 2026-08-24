import { Module } from "@nestjs/common";
import { EmailOAuthController } from "./email-oauth.controller";
import { EmailOAuthService } from "./email-oauth.service";
import { EmailSyncEngineService } from "./email-sync-engine.service";

@Module({
  controllers: [EmailOAuthController],
  providers: [EmailOAuthService, EmailSyncEngineService],
  exports: [EmailOAuthService],
})
export class EmailOAuthModule {}
