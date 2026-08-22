import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { EmploymentType, JobPostingStatus } from "@prisma/client";

export class CreateJobPostingDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;

  @IsOptional()
  @IsUUID()
  hiringDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
