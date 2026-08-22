import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { SequenceStatus } from "@prisma/client";

export class UpdateSequenceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SequenceStatus)
  status?: SequenceStatus;
}
