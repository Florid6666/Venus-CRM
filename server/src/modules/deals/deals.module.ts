import { Module } from "@nestjs/common";
import { DealsController } from "./deals.controller";
import { DealsService } from "./deals.service";
import { DealFollowUpsService } from "./deal-follow-ups.service";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [EmailConnectionsModule, EmailOAuthModule, NotificationsModule],
  controllers: [DealsController],
  providers: [DealsService, DealFollowUpsService],
  exports: [DealsService],
})
export class DealsModule {}
