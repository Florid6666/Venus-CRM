import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BugStatus } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";
import { BugsService } from "./bugs.service";
import { CreateBugDto } from "./dto/create-bug.dto";
import { AddBugCommentDto, UpdateBugDto } from "./dto/update-bug.dto";

@Controller("bugs")
@UseGuards(JwtAuthGuard)
export class BugsController {
  constructor(private readonly bugsService: BugsService) {}

  @Get()
  findAll(
    @Query("taskId") taskId?: string,
    @Query("assigneeId") assigneeId?: string,
    @Query("status") status?: BugStatus,
  ) {
    return this.bugsService.findAll(taskId, assigneeId, status);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.bugsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBugDto, @CurrentUser() user: RequestUser) {
    return this.bugsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBugDto, @CurrentUser() user: RequestUser) {
    return this.bugsService.update(id, dto, user);
  }

  @Post(":id/comments")
  addComment(
    @Param("id") id: string,
    @Body() dto: AddBugCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.bugsService.addComment(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.bugsService.remove(id, user);
  }
}
