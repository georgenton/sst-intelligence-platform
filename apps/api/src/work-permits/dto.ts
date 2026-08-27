import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { WorkPermitStatus } from '@prisma/client';

export class WorkPermitQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(WorkPermitStatus) status?: WorkPermitStatus;
  @IsOptional() @IsUUID() workCenterId?: string;
}

export class CreateWorkPermitDto {
  @IsUUID() permitTemplateVersionId!: string;
  @IsUUID() workCenterId!: string;
  @IsUUID() approverUserId!: string;
  @IsString() @Length(2, 240) area!: string;
  @IsString() @Length(3, 1000) activity!: string;
  @IsDateString() plannedStartAt!: string;
  @IsDateString() plannedEndAt!: string;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) hazards!: string[];
  @IsArray() @ArrayMaxSize(50) @IsUUID('4', { each: true }) linkedRiskAssessmentIds!: string[];
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) controls!: string[];
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) preconditions!: string[];
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) evidenceReferences!: string[];
}

export class WorkPermitTransitionDto {
  @IsEnum(WorkPermitStatus) status!: WorkPermitStatus;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(1, 2000) closureNote?: string;
}

export class ApproveWorkPermitDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(1, 2000) comment?: string;
}
