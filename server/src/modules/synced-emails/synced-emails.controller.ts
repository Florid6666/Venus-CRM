import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { SyncedEmailsService } from "./synced-emails.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("synced-emails")
export class SyncedEmailsController {
  constructor(private readonly service: SyncedEmailsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("contactId") contactId?: string,
    @Query("dealId") dealId?: string,
  ) {
    return this.service.list(user, { contactId, dealId });
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.markRead(id, user);
  }
}
