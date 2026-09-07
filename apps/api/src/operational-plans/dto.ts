import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  OperationalPlanItemPriority,
  OperationalPlanItemProvenanceType,
  OperationalPlanItemStatus,
} from '@prisma/client';

export class OperationalPlanItemDto {
  @IsString() @Length(3, 240) title!: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @Length(1, 120) frequency?: string;
  @IsOptional() @IsEnum(OperationalPlanItemPriority) priority = OperationalPlanItemPriority.MEDIUM;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) evidenceReferences: string[] = [];
  @IsEnum(OperationalPlanItemProvenanceType)
  provenanceType: OperationalPlanItemProvenanceType = OperationalPlanItemProvenanceType.MANUAL;
  @IsOptional() @IsString() @Length(1, 240) provenanceReference?: string;
  @IsOptional() @IsObject() provenanceSnapshot: Record<string, unknown> = {};
}

export class CreateOperationalPlanDto {
  @IsString() @Length(3, 200) name!: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsObject() provenance: Record<string, unknown> = {};
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationalPlanItemDto)
  items!: OperationalPlanItemDto[];
}

export class GenerateOperationalPlanDto {
  @IsString() @Length(3, 200) name!: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
}

export class OperationalPlanQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(OperationalPlanItemStatus) itemStatus?: OperationalPlanItemStatus;
}

export class TransitionOperationalPlanItemDto {
  @IsEnum(OperationalPlanItemStatus) status!: OperationalPlanItemStatus;
  @IsInt() @Min(1) expectedVersion!: number;
}
