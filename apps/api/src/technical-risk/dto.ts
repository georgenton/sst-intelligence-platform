import { Allow, IsEnum, IsOptional, IsString, IsUUID, IsUrl, Length } from 'class-validator';
import { TechnicalEvidenceType, TechnicalReviewDecision } from '@prisma/client';

export class CreateTechnicalAssessmentDto {
  @IsUUID() methodVersionId!: string;
  @IsUUID() workCenterId!: string;
  @IsOptional() @IsUUID() workAreaId?: string;
  @IsString() @Length(3, 160) title!: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
}

export class UpdateTechnicalAssessmentDto {
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() workAreaId?: string;
  @IsOptional() @IsString() @Length(3, 160) title?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
}

export class SaveTechnicalResponseDto {
  @Allow() value!: unknown;
}

export class CreateTechnicalEvidenceDto {
  @IsOptional() @IsString() @Length(1, 100) questionKey?: string;
  @IsEnum(TechnicalEvidenceType) type!: TechnicalEvidenceType;
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) externalUrl?: string;
}

export class ReviewTechnicalAssessmentDto {
  @IsEnum(TechnicalReviewDecision) decision!: TechnicalReviewDecision;
  @IsOptional() @IsString() @Length(1, 2000) comment?: string;
}
