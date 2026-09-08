import {
  PpeCatalogStatus,
  PpeCategory,
  PpeCondition,
  PpeReferenceReviewStatus,
  PpeReplacementReason,
  PpeRequirementDecision,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class PpeCatalogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
  @IsOptional() @IsEnum(PpeCatalogStatus) status?: PpeCatalogStatus;
  @IsOptional() @IsEnum(PpeCategory) category?: PpeCategory;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
}

export class CreatePpeCatalogItemDto {
  @IsString() @Length(2, 200) name!: string;
  @IsEnum(PpeCategory) category!: PpeCategory;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsString() @Length(1, 200) manufacturerModel?: string;
  @IsOptional() @IsString() @Length(1, 300) referenceStandard?: string;
  @IsOptional() @IsString() @Length(1, 120) referenceJurisdiction?: string;
  @IsOptional() @IsString() @Length(1, 1000) referenceProvenance?: string;
  @IsOptional() @IsEnum(PpeReferenceReviewStatus) referenceReviewStatus?: PpeReferenceReviewStatus;
  @IsOptional() @IsInt() @Min(1) @Max(3650) defaultReplacementIntervalDays?: number;
}

export class CreatePositionPpeRequirementDto {
  @IsUUID() positionId!: string;
  @IsOptional() @IsUUID() riskContextId?: string;
  @IsUUID() ppeCatalogItemId!: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() workAreaId?: string;
  @IsString() @Length(3, 2000) reason!: string;
  @IsEnum(PpeRequirementDecision) decision!: PpeRequirementDecision;
}

export class CreatePpeRequirementDto {
  @IsUUID() workerId!: string;
  @IsUUID() ppeCatalogItemId!: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() linkedAssessmentId?: string;
  @IsOptional() @IsUUID() linkedFindingId?: string;
  @IsOptional() @IsUUID() positionRequirementId?: string;
  @IsString() @Length(3, 2000) reason!: string;
}

export class CreatePpeIssueDto {
  @IsUUID() workerId!: string;
  @IsUUID() ppeCatalogItemId!: string;
  @IsOptional() @IsUUID() requirementId?: string;
  @IsDateString() issuedAt!: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) quantity?: number;
  @IsOptional() @IsString() @Length(1, 160) assetReference?: string;
  @IsOptional() @IsDateString() expectedReplacementAt?: string;
  @IsOptional() @IsString() @Length(1, 2000) evidenceNote?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) evidenceUrl?: string;
}

export class AcknowledgePpeIssueDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(3, 2000) note!: string;
}

export class InspectPpeIssueDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsDateString() inspectedAt!: string;
  @IsEnum(PpeCondition) condition!: PpeCondition;
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) evidenceUrl?: string;
}

export class ReplacePpeIssueDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsDateString() issuedAt!: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) quantity?: number;
  @IsOptional() @IsString() @Length(1, 160) assetReference?: string;
  @IsOptional() @IsDateString() expectedReplacementAt?: string;
  @IsOptional() @IsString() @Length(1, 2000) evidenceNote?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) evidenceUrl?: string;
  @IsEnum(PpeReplacementReason) reason!: PpeReplacementReason;
  @IsOptional() @IsString() @Length(1, 1000) reasonNote?: string;
  @IsOptional() @IsUUID() linkedIncidentId?: string;
}
