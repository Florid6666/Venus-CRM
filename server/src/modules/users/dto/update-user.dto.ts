import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { RoleName } from "@prisma/client";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  githubUsername?: string | null;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTarget?: number | null;
}
