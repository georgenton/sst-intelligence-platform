import { TrainingAttendance, TrainingMode, TrainingSessionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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

export class TrainingDefinitionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class CreateTrainingDefinitionDto {
  @IsString() @Length(3, 240) title!: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsString() @Length(2, 120) category!: string;
  @IsOptional() @IsInt() @Min(1) @Max(3650) validityDays?: number;
}

export class CreateCompetencyRequirementDto {
  @IsUUID() workerId!: string;
  @IsUUID() trainingDefinitionId!: string;
  @IsOptional() @IsUUID() linkedAssessmentId?: string;
  @IsOptional() @IsUUID() linkedRegulatoryRequirementId?: string;
  @IsString() @Length(3, 2000) reason!: string;
  @IsOptional() @IsDateString() requiredByDate?: string;
  @IsOptional() @IsBoolean() renewalRequired?: boolean;
}

export class TrainingSessionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
  @IsOptional() @IsEnum(TrainingSessionStatus) status?: TrainingSessionStatus;
  @IsOptional() @IsUUID() trainingDefinitionId?: string;
  @IsOptional() @IsUUID() workCenterId?: string;
}

export class CreateTrainingSessionDto {
  @IsUUID() trainingDefinitionId!: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsDateString() scheduledStart!: string;
  @IsDateString() scheduledEnd!: string;
  @IsEnum(TrainingMode) mode!: TrainingMode;
  @IsOptional() @IsString() @Length(1, 200) instructorName?: string;
  @IsOptional() @IsString() @Length(1, 300) location?: string;
}

export class TransitionTrainingSessionDto {
  @IsEnum(TrainingSessionStatus) status!: TrainingSessionStatus;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class EnrollTrainingParticipantDto {
  @IsUUID() workerId!: string;
}

export class RecordTrainingAttendanceDto {
  @IsEnum(TrainingAttendance) attendance!: TrainingAttendance;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(1, 2000) evidenceNote?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) evidenceUrl?: string;
}

export class CompleteTrainingParticipantDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsDateString() completedAt!: string;
  @IsOptional() @IsUUID() requirementId?: string;
  @IsOptional() @IsString() @Length(1, 2000) completionNote?: string;
  @IsOptional() @IsString() @Length(1, 300) certificateReference?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) evidenceUrl?: string;
}
