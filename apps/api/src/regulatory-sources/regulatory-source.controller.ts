import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { ListRegulatorySourcesQueryDto, ListRegulatoryUnitsQueryDto } from './dto';
import { RegulatorySourceService } from './regulatory-source.service';

@ApiTags('regulatory-sources')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Se requiere una sesión autenticada.' })
@ApiForbiddenResponse({ description: 'La organización activa no tiene una membresía válida.' })
@Controller('regulatory-sources')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class RegulatorySourceController {
  constructor(private readonly regulatorySources: RegulatorySourceService) {}

  @Get()
  @ApiOperation({ summary: 'Lista el catálogo global de fuentes candidatas.' })
  @ApiOkResponse({ description: 'Metadatos seguros de las fuentes y su última versión.' })
  list(@Query() query: ListRegulatorySourcesQueryDto) {
    return this.regulatorySources.listSources(query);
  }

  @Get(':sourceKey')
  @ApiOperation({ summary: 'Obtiene identidad y última metadata de una fuente candidata.' })
  @ApiOkResponse({ description: 'Metadata de catálogo; no es interpretación legal.' })
  @ApiNotFoundResponse({ description: 'Fuente candidata no encontrada.' })
  detail(@Param('sourceKey') sourceKey: string) {
    return this.regulatorySources.getSource(sourceKey);
  }

  @Get(':sourceKey/versions')
  @ApiOperation({ summary: 'Lista el historial inmutable de metadata de catálogo.' })
  @ApiOkResponse({ description: 'Versiones ordenadas de la más reciente a la más antigua.' })
  @ApiNotFoundResponse({ description: 'Fuente candidata no encontrada.' })
  versions(@Param('sourceKey') sourceKey: string) {
    return this.regulatorySources.getVersions(sourceKey);
  }

  @Get(':sourceKey/relationships')
  @ApiOperation({ summary: 'Lista relaciones editoriales que requieren revisión.' })
  @ApiOkResponse({ description: 'Relaciones neutrales entre identidades de fuente.' })
  @ApiNotFoundResponse({ description: 'Fuente candidata no encontrada.' })
  relationships(@Param('sourceKey') sourceKey: string) {
    return this.regulatorySources.getRelationships(sourceKey);
  }

  @Get(':sourceKey/provisions')
  @ApiOperation({
    summary: 'Lista contenido estructurado ligado a versiones exactas de la fuente.',
  })
  @ApiOkResponse({ description: 'Disposiciones editoriales y requisitos relacionados; no reglas.' })
  @ApiNotFoundResponse({ description: 'Fuente candidata no encontrada.' })
  provisions(@Param('sourceKey') sourceKey: string) {
    return this.regulatorySources.getProvisions(sourceKey);
  }

  @Get(':sourceKey/units')
  @ApiOperation({
    summary: 'Lista la tabla de contenido y artículos de la versión oficial exacta.',
  })
  units(@Param('sourceKey') sourceKey: string, @Query() query: ListRegulatoryUnitsQueryDto) {
    return this.regulatorySources.listUnits(sourceKey, query);
  }
}
