import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { RoleName } from "@prisma/client";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEnum(RoleName)
  role!: RoleName;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  githubUsername?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTarget?: number;
}
