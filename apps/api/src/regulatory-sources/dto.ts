import {
  RegulatoryCandidateStatus,
  RegulatoryDocumentType,
  RegulatoryUnitType,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListRegulatorySourcesQueryDto {
  @ApiPropertyOptional({ description: 'Busca por título, número o emisor.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional({ description: 'Coincidencia parcial del emisor.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  issuer?: string;

  @ApiPropertyOptional({ enum: RegulatoryDocumentType })
  @IsOptional()
  @IsEnum(RegulatoryDocumentType)
  documentType?: RegulatoryDocumentType;

  @ApiPropertyOptional({ enum: RegulatoryCandidateStatus })
  @IsOptional()
  @IsEnum(RegulatoryCandidateStatus)
  candidateStatus?: RegulatoryCandidateStatus;
}

export class ListRegulatoryUnitsQueryDto {
  @ApiPropertyOptional({ description: 'Busca texto oficial, identificador, título o localizador.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional({ enum: RegulatoryUnitType })
  @IsOptional()
  @IsEnum(RegulatoryUnitType)
  unitType?: RegulatoryUnitType;
}
