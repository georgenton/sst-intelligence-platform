import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateOrganizationSstProfileVersionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) workerCount?: number;
  @IsOptional() @IsBoolean() hasChemicalProcesses?: boolean;
  @IsOptional() @IsBoolean() hasHighEnergyOperations?: boolean;
  @IsOptional() @IsIn(['ROUTINE', 'FOCUSED', 'URGENT']) managementPriority?: string;
  @IsOptional() @IsBoolean() hasPhysicalSite?: boolean;
  @IsOptional() @IsBoolean() administrativeOrRemoteOnly?: boolean;
  @IsOptional() @IsBoolean() hasContractorsOrExternalPersonnel?: boolean;
  @IsOptional() @IsArray() @IsObject({ each: true }) facts?: Record<string, unknown>[];
}

export class EvaluateApplicabilityDto {
  @IsUUID() profileVersionId!: string;
  @IsUUID() rulePackVersionId!: string;
}
