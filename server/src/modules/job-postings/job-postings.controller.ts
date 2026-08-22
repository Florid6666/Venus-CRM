import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { JobPostingStatus } from "@prisma/client";
import { JobPostingsService } from "./job-postings.service";
import { CreateJobPostingDto } from "./dto/create-job-posting.dto";
import { UpdateJobPostingDto } from "./dto/update-job-posting.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("job-postings")
export class JobPostingsController {
  constructor(private readonly jobPostingsService: JobPostingsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: JobPostingStatus,
    @Query("hiringDepartmentId") hiringDepartmentId?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.jobPostingsService.findAll({ status, hiringDepartmentId, departmentId }, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.jobPostingsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateJobPostingDto, @CurrentUser() user: RequestUser) {
    return this.jobPostingsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateJobPostingDto, @CurrentUser() user: RequestUser) {
    return this.jobPostingsService.update(id, dto, user);
  }

  // Soft-close rather than delete -- preserves candidate history attached to
  // this posting, same rationale as DealsService.archive/ProjectsService.archive.
  @Delete(":id")
  close(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.jobPostingsService.close(id, user);
  }
}
