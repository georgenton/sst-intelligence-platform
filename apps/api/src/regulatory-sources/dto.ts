import { RegulatoryCandidateStatus, RegulatoryDocumentType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListRegulatorySourcesQueryDto {
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
