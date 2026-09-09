import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class ManagementIntelligenceQueryDto {
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsString() @Length(1, 120) findingCategory?: string;
  @IsOptional()
  @IsIn(['UNSAFE_ACT', 'UNSAFE_CONDITION', 'GOOD_PRACTICE', 'HOUSEKEEPING', 'PPE', 'OTHER'])
  observationCategory?: string;
  @IsOptional() @IsIn(['INCIDENT', 'NEAR_MISS']) incidentEventType?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}
