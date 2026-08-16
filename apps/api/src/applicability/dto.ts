import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateOrganizationSstProfileVersionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) workerCount?: number;
  @IsOptional() @IsBoolean() hasChemicalProcesses?: boolean;
  @IsOptional() @IsBoolean() hasHighEnergyOperations?: boolean;
}

export class EvaluateApplicabilityDto {
  @IsUUID() profileVersionId!: string;
  @IsUUID() rulePackVersionId!: string;
}
