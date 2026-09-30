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
  Min,
} from 'class-validator';
import {
  ActionEvidenceType,
  OccupationalHealthActivityStatus,
  OccupationalHealthProgramStatus,
  PsychosocialAssessmentCycleStatus,
  PsychosocialInstrumentSourceType,
  PsychosocialProgramStatus,
} from '@prisma/client';

export class CreateOccupationalHealthProgramDto {
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsString() @Length(2, 240) title!: string;
  @IsOptional() @IsString() @Length(2, 2000) scopeSummary?: string;
  @IsOptional() @IsString() @Length(2, 240) coordinatorName?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class UpdateOccupationalHealthProgramDto {
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
  @IsOptional() @IsEnum(OccupationalHealthProgramStatus) status?: OccupationalHealthProgramStatus;
  @IsOptional() @IsString() @Length(2, 240) title?: string;
  @IsOptional() @IsString() @Length(2, 2000) scopeSummary?: string;
  @IsOptional() @IsString() @Length(2, 240) coordinatorName?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class CreateOccupationalHealthActivityDto {
  @IsString() @Length(2, 120) componentKey!: string;
  @IsString() @Length(2, 240) title!: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsDateString() plannedAt?: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsEnum(ActionEvidenceType) evidenceType?: ActionEvidenceType;
  @IsOptional() @IsString() @Length(1, 2000) evidenceNote?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) evidenceUrl?: string;
  @IsOptional() @IsUUID() linkedOperationalPlanItemId?: string;
}

export class UpdateOccupationalHealthActivityDto {
  @IsOptional() @IsString() @Length(2, 120) componentKey?: string;
  @IsOptional() @IsString() @Length(2, 240) title?: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsDateString() plannedAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsEnum(OccupationalHealthActivityStatus) status?: OccupationalHealthActivityStatus;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsEnum(ActionEvidenceType) evidenceType?: ActionEvidenceType;
  @IsOptional() @IsString() @Length(1, 2000) evidenceNote?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) evidenceUrl?: string;
}

export class LinkOccupationalPlanItemDto {
  @IsUUID() operationalPlanItemId!: string;
}

export class CreatePsychosocialProgramDto {
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsString() @Length(2, 240) title!: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class UpdatePsychosocialProgramDto {
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
  @IsOptional() @IsEnum(PsychosocialProgramStatus) status?: PsychosocialProgramStatus;
  @IsOptional() @IsString() @Length(2, 240) title?: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class CreatePsychosocialAssessmentCycleDto {
  @IsString() @Length(2, 240) instrumentName!: string;
  @IsOptional() @IsString() @Length(1, 120) instrumentVersion?: string;
  @IsOptional() @IsString() @Length(2, 240) instrumentProvider?: string;
  @IsEnum(PsychosocialInstrumentSourceType) instrumentSourceType!: PsychosocialInstrumentSourceType;
  @IsOptional() @IsUUID() instrumentSourceVersionId?: string;
  @IsOptional() @IsString() @Length(1, 1000) validationReference?: string;
  @IsOptional() @IsDateString() plannedAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsInt() @Min(0) targetPopulationCount?: number;
  @IsOptional() @IsInt() @Min(0) participantCount?: number;
  @IsOptional() @IsBoolean() aggregateReportAvailable?: boolean;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  aggregateReportUrl?: string;
  @IsOptional() @IsString() @Length(1, 2000) evidenceNote?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class UpdatePsychosocialAssessmentCycleDto {
  @IsOptional()
  @IsEnum(PsychosocialAssessmentCycleStatus)
  status?: PsychosocialAssessmentCycleStatus;
  @IsOptional() @IsString() @Length(2, 240) instrumentName?: string;
  @IsOptional() @IsString() @Length(1, 120) instrumentVersion?: string;
  @IsOptional() @IsString() @Length(2, 240) instrumentProvider?: string;
  @IsOptional()
  @IsEnum(PsychosocialInstrumentSourceType)
  instrumentSourceType?: PsychosocialInstrumentSourceType;
  @IsOptional() @IsUUID() instrumentSourceVersionId?: string;
  @IsOptional() @IsString() @Length(1, 1000) validationReference?: string;
  @IsOptional() @IsDateString() plannedAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsInt() @Min(0) targetPopulationCount?: number;
  @IsOptional() @IsInt() @Min(0) participantCount?: number;
  @IsOptional() @IsBoolean() aggregateReportAvailable?: boolean;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  aggregateReportUrl?: string;
  @IsOptional() @IsString() @Length(1, 2000) evidenceNote?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class LinkPsychosocialPlanItemDto {
  @IsUUID() operationalPlanItemId!: string;
}
