import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { ContentBriefStatus } from "@prisma/client";

export class CreateSeoContentBriefDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  targetKeyword!: string;

  @IsOptional()
  @IsEnum(ContentBriefStatus)
  status?: ContentBriefStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
