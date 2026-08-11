import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PlanKey } from '@prisma/client';

export class UpgradeRequestDto {
  @IsOptional()
  @IsEnum(PlanKey)
  requestedPlan?: PlanKey;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  message?: string;
}
