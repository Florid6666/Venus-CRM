import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { OfferStatus } from "@prisma/client";

export class CreateOfferDto {
  @IsUUID()
  candidateId!: string;

  @IsInt()
  @Min(0)
  salary!: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
