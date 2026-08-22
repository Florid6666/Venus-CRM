import { IsInt, Min } from "class-validator";

export class CreateActivityPingDto {
  @IsInt()
  @Min(0)
  idleSeconds!: number;
}
