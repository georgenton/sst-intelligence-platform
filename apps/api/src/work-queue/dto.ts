import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { WORK_QUEUE_MODULES } from '@sst/contracts';

export class WorkQueueQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsUUID() assignedToUserId?: string;
  @IsOptional() @IsDateString() dueFrom?: string;
  @IsOptional() @IsDateString() dueTo?: string;
  @IsOptional() @IsIn(WORK_QUEUE_MODULES) module?: (typeof WORK_QUEUE_MODULES)[number];
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) priority?:
    'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}
