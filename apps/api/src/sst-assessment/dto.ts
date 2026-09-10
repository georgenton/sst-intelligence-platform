import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SST_ASSESSMENT_LIMITS } from '@sst/contracts';

export class CreatePublicAssessmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SST_ASSESSMENT_LIMITS.workCenters)
  workCenterCount = 1;
}

export class CreateAuthenticatedAssessmentDto {
  @IsOptional()
  @IsIn(['INITIAL_ASSESSMENT', 'REASSESSMENT'])
  kind?: 'INITIAL_ASSESSMENT' | 'REASSESSMENT';

  @IsOptional()
  @IsUUID()
  parentAssessmentId?: string;
}

export class SstAssessmentAnswerDto {
  @IsString() @MaxLength(120) factKey!: string;
  @IsString() @MaxLength(160) scopeKey!: string;
  @IsIn(['KNOWN', 'EXPLICIT_UNKNOWN']) answerState!: 'KNOWN' | 'EXPLICIT_UNKNOWN';
  @IsOptional() @IsNotEmpty() value?: unknown;
}

export class SubmitSstAssessmentAnswersDto {
  @Type(() => Number) @IsInt() @Min(0) expectedSessionRevision!: number;
  @IsArray()
  @ArrayMaxSize(SST_ASSESSMENT_LIMITS.answersPerRequest)
  @ValidateNested({ each: true })
  @Type(() => SstAssessmentAnswerDto)
  answers!: SstAssessmentAnswerDto[];
}

export class MutateSstAssessmentDto {
  @Type(() => Number) @IsInt() @Min(0) expectedSessionRevision!: number;
}

export class ClaimScopeMappingDto {
  @IsString() @MaxLength(160) scopeKey!: string;
  @IsUUID() workCenterId!: string;
}

export class ClaimPublicAssessmentDto {
  @IsString() @MaxLength(200) publicToken!: string;
  @IsArray()
  @ArrayMaxSize(SST_ASSESSMENT_LIMITS.workCenters)
  @ValidateNested({ each: true })
  @Type(() => ClaimScopeMappingDto)
  scopeMappings!: ClaimScopeMappingDto[];
}
