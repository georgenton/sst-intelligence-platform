import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Min,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { InspectionDomain, InspectionStandardRightsType } from '@prisma/client';

export class InspectionStandardPolicyBindingDto {
  @IsEnum(InspectionDomain) inspectionDomain!: InspectionDomain;
  @IsUUID() standardVersionId!: string;
}

export class SaveInspectionStandardPolicyDto {
  @IsOptional() @IsString() @Length(3, 500) reason?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => InspectionStandardPolicyBindingDto)
  bindings!: InspectionStandardPolicyBindingDto[];
}

export class OrganizationStandardCriterionDto {
  @IsString() @Length(2, 60) code!: string;
  @IsString() @Length(5, 500) title!: string;
  @IsString() @Length(5, 2000) guidance!: string;
  @IsOptional() @IsString() @Length(3, 1000) evidenceExpectation?: string;
  @IsInt() @Min(1) @Max(1000) displayOrder!: number;
  @IsBoolean() notApplicableAllowed!: boolean;
  @IsBoolean() required!: boolean;
}

export class OrganizationStandardSectionDto {
  @IsString() @Length(2, 60) code!: string;
  @IsString() @Length(3, 240) title!: string;
  @IsInt() @Min(1) @Max(1000) displayOrder!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrganizationStandardCriterionDto)
  criteria!: OrganizationStandardCriterionDto[];
}

export class CreateOrganizationInspectionStandardDto {
  @IsString() @Length(2, 60) code!: string;
  @IsString() @Length(3, 200) name!: string;
  @IsString() @Length(2, 200) publisher!: string;
  @IsOptional() @IsString() @Length(2, 80) originCountry?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) referenceUrl?: string;
  @IsEnum(InspectionStandardRightsType) rightsType!: InspectionStandardRightsType;
  @IsEnum(InspectionDomain) inspectionDomain!: InspectionDomain;
  @IsString() @Length(1, 60) versionCode!: string;
  @IsString() @Length(2, 120) editionLabel!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrganizationStandardSectionDto)
  sections!: OrganizationStandardSectionDto[];
}
