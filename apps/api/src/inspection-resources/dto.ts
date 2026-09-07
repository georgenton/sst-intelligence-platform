import { IsArray, IsEnum, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { InspectionDomain } from '@prisma/client';

export class InspectionResourceQueryDto {
  @IsEnum(InspectionDomain) domain!: InspectionDomain;
  @IsOptional() @IsUUID() standardVersionId?: string;
}

export class CreateInspectionDraftProposalDto {
  @IsUUID() resourceId!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords: string[] = [];
}

export class ReviewInspectionDraftProposalDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional() @IsString() @Length(1, 2000) comment?: string;
}
