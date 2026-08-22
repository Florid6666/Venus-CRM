import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CandidateStage } from "@prisma/client";
import { CandidatesService } from "./candidates.service";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("candidates")
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("jobPostingId") jobPostingId?: string,
    @Query("stage") stage?: CandidateStage,
    @Query("ownerId") ownerId?: string,
    @Query("mine") mine?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.candidatesService.findAll(
      {
        jobPostingId,
        stage,
        ownerId: mine === "true" ? user.id : ownerId,
        departmentId,
      },
      user,
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.candidatesService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: RequestUser) {
    return this.candidatesService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCandidateDto, @CurrentUser() user: RequestUser) {
    return this.candidatesService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.candidatesService.remove(id, user);
  }
}
