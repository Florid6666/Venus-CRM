import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { DealStage } from "@prisma/client";
import { DealsService } from "./deals.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("deals")
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("stage") stage?: DealStage,
    @Query("ownerId") ownerId?: string,
    @Query("companyId") companyId?: string,
    @Query("mine") mine?: string,
  ) {
    return this.dealsService.findAll(
      {
        stage,
        companyId,
        ownerId: mine === "true" ? user.id : ownerId,
      },
      user,
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.dealsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDealDto, @CurrentUser() user: RequestUser) {
    return this.dealsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDealDto, @CurrentUser() user: RequestUser) {
    return this.dealsService.update(id, dto, user);
  }

  @Delete(":id")
  archive(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dealsService.archive(id, user);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dealsService.approve(id, user);
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dealsService.reject(id, user);
  }
}
