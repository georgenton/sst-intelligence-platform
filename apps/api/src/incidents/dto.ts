import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  ActionPriority,
  IncidentActionStatus,
  IncidentEvidenceScope,
  IncidentEvidenceType,
  IncidentEventType,
  IncidentFactorCategory,
  IncidentStatus,
} from '@prisma/client';

export class IncidentQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(IncidentStatus) status?: IncidentStatus;
  @IsOptional() @IsEnum(IncidentEventType) eventType?: IncidentEventType;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() workerId?: string;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
}

export class CreateIncidentDto {
  @IsUUID() workCenterId!: string;
  @IsDateString() occurredAt!: string;
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(3, 4000) description!: string;
  @IsEnum(IncidentEventType) eventType!: IncidentEventType;
  @IsOptional() @IsString() @Length(1, 1000) activityContext?: string;
  @IsOptional() @IsUUID() linkedInspectionId?: string;
  @IsOptional() @IsUUID() linkedFindingId?: string;
  @IsOptional() @IsUUID() linkedAssessmentId?: string;
}

export class TransitionIncidentDto {
  @IsEnum(IncidentStatus) status!: IncidentStatus;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class AddIncidentWorkerDto {
  @IsUUID() workerId!: string;
  @IsOptional() @IsString() @Length(1, 500) involvement?: string;
}

export class StartIncidentInvestigationDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CompleteIncidentInvestigationDto {
  @IsString() @Length(3, 4000) summary!: string;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CreateIncidentFactorDto {
  @IsEnum(IncidentFactorCategory) category!: IncidentFactorCategory;
  @IsString() @Length(3, 2000) description!: string;
  @IsOptional() @IsString() @Length(1, 2000) rationale?: string;
}

export class CreateIncidentActionDto {
  @IsString() @Length(3, 200) title!: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @IsOptional() @IsUUID() ownerUserId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class TransitionIncidentActionDto {
  @IsEnum(IncidentActionStatus) status!: IncidentActionStatus;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class VerifyIncidentActionDto {
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CreateIncidentEvidenceDto {
  @IsEnum(IncidentEvidenceScope) scope!: IncidentEvidenceScope;
  @IsEnum(IncidentEvidenceType) type!: IncidentEvidenceType;
  @IsOptional() @IsUUID() incidentActionId?: string;
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) externalUrl?: string;
}
