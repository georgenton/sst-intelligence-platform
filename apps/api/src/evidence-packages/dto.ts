import { EvidencePackageItemType } from '@prisma/client';
import { IsEnum, IsString, IsUUID, Length } from 'class-validator';

export class CreateEvidencePackageDto {
  @IsString() @Length(3, 240) title!: string;
  @IsString() @Length(3, 1000) scope!: string;
}

export class AddEvidencePackageItemDto {
  @IsEnum(EvidencePackageItemType) type!: EvidencePackageItemType;
  @IsUUID() sourceId!: string;
}
