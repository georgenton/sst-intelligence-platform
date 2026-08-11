import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
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
  ActionEvidenceType,
  ActionPriority,
  AlertStatus,
  CorrectiveActionStatus,
  FindingStatus,
  InspectionStatus,
  RiskLevel,
} from '@prisma/client';
import { FINDING_CATEGORIES } from '@sst/contracts';

export class InspectionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() workAreaId?: string;
  @IsOptional() @IsIn(FINDING_CATEGORIES) category?: string;
  @IsOptional() @IsEnum(RiskLevel) riskLevel?: RiskLevel;
  @IsOptional() @IsEnum(FindingStatus) findingStatus?: FindingStatus;
  @IsOptional() @IsEnum(InspectionStatus) inspectionStatus?: InspectionStatus;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsIn(['true', 'false']) hasRecurrence?: string;
  @IsOptional() @IsIn(['true', 'false']) overdue?: string;
}

export class CreateInspectionDto {
  @IsUUID() workCenterId!: string;
  @IsOptional() @IsUUID() workAreaId?: string;
  @IsString() @Length(3, 160) title!: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsDateString() scheduledFor?: string;
}

export class UpdateInspectionDto {
  @IsOptional() @IsString() @Length(3, 160) title?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsDateString() scheduledFor?: string;
}

export class CreateFindingDto {
  @IsString() @Length(3, 160) title!: string;
  @IsString() @Length(3, 4000) description!: string;
  @IsIn(FINDING_CATEGORIES) category!: string;
  @IsInt() @Min(1) @Max(5) likelihood!: number;
  @IsInt() @Min(1) @Max(5) consequence!: number;
}

export class UpdateFindingDto {
  @IsOptional() @IsString() @Length(3, 160) title?: string;
  @IsOptional() @IsString() @Length(3, 4000) description?: string;
}

export class CreateActionDto {
  @IsString() @Length(3, 160) title!: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsUUID() assignedToUserId?: string;
  @IsEnum(ActionPriority) priority!: ActionPriority;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class UpdateActionDto {
  @IsOptional() @IsString() @Length(3, 160) title?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsUUID() assignedToUserId?: string;
  @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional()
  @IsIn([
    CorrectiveActionStatus.OPEN,
    CorrectiveActionStatus.IN_PROGRESS,
    CorrectiveActionStatus.CANCELED,
  ])
  status?: CorrectiveActionStatus;
}

export class CreateEvidenceDto {
  @IsEnum(ActionEvidenceType) type!: ActionEvidenceType;
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) externalUrl?: string;
}

export class VerifyFindingDto {
  @IsInt() @Min(1) @Max(5) likelihood!: number;
  @IsInt() @Min(1) @Max(5) consequence!: number;
}

export class AlertQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(AlertStatus) status?: AlertStatus;
}

export class SearchFindingDto {
  @IsString() @Length(2, 120) q!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
