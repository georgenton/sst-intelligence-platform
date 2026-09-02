import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { InspectionBasisTechnicalRole, InspectionDomain } from '@prisma/client';

export class InspectionBasisTechnicalSourceDto {
  @IsUUID() standardVersionId!: string;
  @IsEnum(InspectionBasisTechnicalRole) role!: InspectionBasisTechnicalRole;
  @IsInt() @Min(1) @Max(100) displayOrder!: number;
  @IsOptional() @IsString() @Length(3, 500) organizationNote?: string;
}

export class InspectionBasisRegulatoryUnitDto {
  @IsUUID() regulatoryUnitId!: string;
  @IsInt() @Min(1) @Max(100) displayOrder!: number;
  @IsOptional() @IsString() @Length(3, 500) organizationNote?: string;
}

export class InspectionBasisCriterionRegulatoryLinkDto {
  @IsUUID() criterionId!: string;
  @IsUUID() regulatoryUnitId!: string;
}

export class InspectionBasisCompositionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InspectionBasisTechnicalSourceDto)
  technicalSources!: InspectionBasisTechnicalSourceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InspectionBasisRegulatoryUnitDto)
  regulatoryUnits: InspectionBasisRegulatoryUnitDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InspectionBasisCriterionRegulatoryLinkDto)
  criterionRegulatoryLinks: InspectionBasisCriterionRegulatoryLinkDto[] = [];

  @IsOptional() @IsString() @Length(3, 500) reason?: string;
}

export class CreateInspectionBasisDto extends InspectionBasisCompositionDto {
  @IsString() @Length(3, 200) name!: string;
  @IsEnum(InspectionDomain) inspectionDomain!: InspectionDomain;
}

export class SearchRegulatoryUnitsDto {
  @IsOptional() @IsString() @Length(2, 120) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take = 30;
}
