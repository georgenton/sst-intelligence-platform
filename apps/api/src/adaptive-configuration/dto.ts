import { Type } from 'class-transformer';
import { ADAPTIVE_LIMITS } from '@sst/contracts';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const strategicPriorityValues = [
  'PEOPLE_AND_HEALTH',
  'PRODUCTIVE_CONTINUITY',
  'BUSINESS_CONTINUITY',
  'MACHINERY_AND_INFRASTRUCTURE',
  'FINANCIAL_IMPACT',
  'REPUTATION',
  'CONTRACTORS_AND_SUPPLY_CHAIN',
  'PRODUCT_OR_SERVICE_QUALITY',
] as const;

export class CreateAdaptiveSessionDto {
  @IsUUID() profileVersionId!: string;
  @IsUUID() rulePackVersionId!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ADAPTIVE_LIMITS.workCentersPerSession)
  @IsUUID('4', { each: true })
  workCenterIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(strategicPriorityValues.length)
  @IsIn(strategicPriorityValues, { each: true })
  strategicPriorities?: (typeof strategicPriorityValues)[number][];
}

export class AdaptiveAnswerDto {
  @IsUUID() scopeId!: string;
  @IsUUID() factVersionId!: string;
  @IsNotEmpty() value!: unknown;
}

export class SubmitAdaptiveAnswersDto {
  @Type(() => Number) @IsInt() @Min(0) expectedSessionRevision!: number;
  @IsArray()
  @ArrayMaxSize(ADAPTIVE_LIMITS.answersPerRequest)
  @ValidateNested({ each: true })
  @Type(() => AdaptiveAnswerDto)
  answers!: AdaptiveAnswerDto[];
}

export class EvaluateAdaptiveSessionDto {
  @Type(() => Number) @IsInt() @Min(0) expectedSessionRevision!: number;
}

export class DeclareAdaptiveCurrentStateDto {
  @IsUUID() itemId!: string;
  @IsIn([
    'UNKNOWN',
    'NOT_IMPLEMENTED',
    'PLANNED',
    'IN_PROGRESS',
    'PARTIALLY_IMPLEMENTED',
    'IMPLEMENTED',
  ])
  status!:
    | 'UNKNOWN'
    | 'NOT_IMPLEMENTED'
    | 'PLANNED'
    | 'IN_PROGRESS'
    | 'PARTIALLY_IMPLEMENTED'
    | 'IMPLEMENTED';
}

export class AddAdaptiveEvidenceDto {
  @IsUUID() itemId!: string;
  @IsIn(['NOTE', 'EXTERNAL_LINK']) type!: 'NOTE' | 'EXTERNAL_LINK';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_valid_protocol: true })
  @MaxLength(1000)
  externalUrl?: string;
}
