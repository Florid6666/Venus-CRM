import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { BacklinkStatus } from "@prisma/client";

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
  @IsEnum(BacklinkStatus)
  status?: BacklinkStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
