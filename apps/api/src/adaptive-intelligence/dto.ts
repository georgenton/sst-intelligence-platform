import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class GapAnalysisQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CreateGapAnalysisDto {
  @IsIn(['ADAPTIVE_CONFIGURATION', 'UNIFIED_SST_EVALUATION']) sourceType!:
    'ADAPTIVE_CONFIGURATION' | 'UNIFIED_SST_EVALUATION';
  @IsUUID() sourceId!: string;
}

export class ConvertGapToPlanDto {
  @IsArray() @IsString({ each: true }) selectedItemKeys!: string[];
  @IsString() @Length(3, 200) name!: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
}
