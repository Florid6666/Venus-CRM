import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { CandidateStage } from "@prisma/client";

export class CreateCandidateDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(CandidateStage)
  stage?: CandidateStage;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsUUID()
  jobPostingId!: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
