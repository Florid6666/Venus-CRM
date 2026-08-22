import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { BacklinkVerificationStatus } from "@prisma/client";

export class CreateSeoBacklinkDto {
  @IsString()
  @MinLength(1)
  sourceUrl!: string;

  @IsString()
  @MinLength(1)
  targetUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  domainAuthority?: number;

  @IsOptional()
  @IsEnum(BacklinkVerificationStatus)
  status?: BacklinkVerificationStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
