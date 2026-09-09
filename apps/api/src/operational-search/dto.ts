import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { operationalSearchTypes } from '@sst/contracts';

export class OperationalSearchQueryDto {
  @IsString() @Length(2, 120) q!: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @IsIn(operationalSearchTypes, { each: true })
  types?: string[];
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}
