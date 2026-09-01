import { Type } from 'class-transformer';
import {
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
import { WorkerStatus } from '@prisma/client';

export class WorkerQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsEnum(WorkerStatus) status?: WorkerStatus;
  @IsOptional() @IsUUID() workCenterId?: string;
}

export class CreateWorkerDto {
  @IsString() @Length(2, 200) displayName!: string;
  @IsOptional() @IsString() @Length(1, 80) internalCode?: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsString() @Length(1, 200) jobTitle?: string;
  @IsOptional() @IsUUID() linkedUserId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class UpdateWorkerDto {
  @IsOptional() @IsString() @Length(2, 200) displayName?: string;
  @IsOptional() @IsString() @Length(1, 80) internalCode?: string | null;
  @IsOptional() @IsUUID() workCenterId?: string | null;
  @IsOptional() @IsString() @Length(1, 200) jobTitle?: string | null;
  @IsOptional() @IsUUID() linkedUserId?: string | null;
  @IsOptional() @IsDateString() startDate?: string | null;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string | null;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class DeactivateWorkerDto {
  @IsOptional() @IsDateString() endDate?: string;
  @IsInt() @Min(1) expectedVersion!: number;
}
