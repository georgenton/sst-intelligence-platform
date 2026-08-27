import { Type } from 'class-transformer';
import {
  IsBoolean,
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
  ObligationExecutionEvidenceType,
  ObligationExecutionOriginType,
  ObligationExecutionReviewDecision,
  ObligationExecutionStatus,
} from '@prisma/client';

export class ObligationExecutionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(ObligationExecutionStatus) status?: ObligationExecutionStatus;
  @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() assignedToUserId?: string;
}

export class CreateObligationExecutionDto {
  @IsString() @Length(3, 200) title!: string;
  @IsOptional() @IsString() @Length(1, 4000) description?: string;
  @IsEnum(ObligationExecutionOriginType) originType!: ObligationExecutionOriginType;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() requirementId?: string;
  @IsOptional() @IsUUID() regulatoryUnitId?: string;
  @IsOptional() @IsString() @Length(1, 500) internalReference?: string;
  @IsOptional() @IsString() @Length(1, 500) manualReference?: string;
  @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @IsOptional() @IsUUID() assignedToUserId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @Length(1, 2000) evidenceExpectation?: string;
  @IsOptional() @IsBoolean() reviewRequired?: boolean;
}

export class UpdateObligationExecutionDto {
  @IsOptional() @IsString() @Length(3, 200) title?: string;
  @IsOptional() @IsString() @Length(1, 4000) description?: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @IsOptional() @IsUUID() assignedToUserId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @Length(1, 2000) evidenceExpectation?: string;
  @IsOptional() @IsBoolean() reviewRequired?: boolean;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class TransitionObligationExecutionDto {
  @IsEnum(ObligationExecutionStatus) status!: ObligationExecutionStatus;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class ReviewObligationExecutionDto {
  @IsEnum(ObligationExecutionReviewDecision) decision!: ObligationExecutionReviewDecision;
  @IsOptional() @IsString() @Length(1, 2000) comment?: string;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CreateObligationEvidenceDto {
  @IsEnum(ObligationExecutionEvidenceType) type!: ObligationExecutionEvidenceType;
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) externalUrl?: string;
}
