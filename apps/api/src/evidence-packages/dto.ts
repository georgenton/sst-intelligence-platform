import { EvidencePackageItemType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class EvidenceReferenceQueryDto {
  @IsOptional() @IsString() @Length(1, 120) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class CreateEvidencePackageDto {
  @IsString() @Length(3, 240) title!: string;
  @IsString() @Length(3, 1000) scope!: string;
}

export class AddEvidencePackageItemDto {
  @IsEnum(EvidencePackageItemType) type!: EvidencePackageItemType;
  @IsUUID() sourceId!: string;
}
