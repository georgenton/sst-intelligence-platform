import { RegulatoryInterpretationReviewDecision } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, IsUrl, IsUUID, Length } from 'class-validator';

export class CreateUnifiedSstEvaluationDto {
  @IsUUID() profileVersionId!: string;
}

export class ReviewRegulatoryInterpretationDto {
  @IsUUID() evaluationItemId!: string;
  @IsEnum(RegulatoryInterpretationReviewDecision)
  decision!: RegulatoryInterpretationReviewDecision;
  @IsOptional() @IsString() @Length(1, 2000) comment?: string;
}

export class DeclareUnifiedCurrentStateDto {
  @IsIn([
    'UNKNOWN',
    'NOT_IMPLEMENTED',
    'PLANNED',
    'IN_PROGRESS',
    'PARTIALLY_IMPLEMENTED',
    'IMPLEMENTED',
  ])
  status!: string;
}

export class AddUnifiedOrganizationEvidenceDto {
  @IsIn(['NOTE', 'EXTERNAL_LINK']) type!: 'NOTE' | 'EXTERNAL_LINK';
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) externalUrl?: string;
}

export class LinkUnifiedRiskAssessmentDto {
  @IsUUID() assessmentId!: string;
}
