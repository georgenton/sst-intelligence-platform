import {
  ActionPriority,
  IncidentEvidenceType,
  SafetyObservationCategory,
  SafetyObservationStatus,
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

export class SafetyObservationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(SafetyObservationStatus) status?: SafetyObservationStatus;
  @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @IsOptional() @IsUUID() workCenterId?: string;
}

export class CreateSafetyObservationDto {
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(3, 2000) description!: string;
  @IsEnum(SafetyObservationCategory) category!: SafetyObservationCategory;
  @IsUUID() workCenterId!: string;
  @IsOptional() @IsUUID() workAreaId?: string;
  @IsDateString() observedAt!: string;
  @IsEnum(ActionPriority) priority!: ActionPriority;
  @IsOptional() @IsUUID() assignedToUserId?: string;
  @IsOptional() @IsUUID() linkedIncidentId?: string;
  @IsOptional() @IsUUID() linkedFindingId?: string;
}

export class TransitionSafetyObservationDto {
  @IsEnum(SafetyObservationStatus) status!: SafetyObservationStatus;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(3, 2000) resolutionNote?: string;
}

export class AddSafetyObservationEvidenceDto {
  @IsEnum(IncidentEvidenceType) type!: IncidentEvidenceType;
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) externalUrl?: string;
}

export class LinkSafetyObservationActionDto {
  @IsUUID() obligationExecutionId!: string;
}
