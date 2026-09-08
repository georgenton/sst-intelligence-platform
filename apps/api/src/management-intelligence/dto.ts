import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class ManagementIntelligenceQueryDto {
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsString() @Length(1, 120) category?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}
