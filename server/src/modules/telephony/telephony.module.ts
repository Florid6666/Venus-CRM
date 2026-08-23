import { Module } from "@nestjs/common";
import { JustCallConnectionController } from "./justcall-connection.controller";
import { JustCallConnectionService } from "./justcall-connection.service";
import { JustCallProviderService } from "./justcall-provider.service";
import { JustCallWebhookController } from "./justcall-webhook.controller";
import { JustCallWebhookService } from "./justcall-webhook.service";
import { PhoneNumbersController } from "./phone-numbers.controller";
import { PhoneNumbersService } from "./phone-numbers.service";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";
import { CallCampaignsController } from "./call-campaigns.controller";
import { CallCampaignsService } from "./call-campaigns.service";

@Module({
  controllers: [
    JustCallConnectionController,
    JustCallWebhookController,
    PhoneNumbersController,
    CallsController,
    CallCampaignsController,
  ],
  providers: [
    JustCallConnectionService,
    JustCallProviderService,
    JustCallWebhookService,
    PhoneNumbersService,
    CallsService,
    CallCampaignsService,
  ],
  exports: [JustCallConnectionService, CallsService, CallCampaignsService],
})
export class TelephonyModule {}
