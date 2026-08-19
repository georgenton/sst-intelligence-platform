import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
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
import { RegulatorySourceService } from './regulatory-source.service';

@ApiTags('regulatory-content')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Se requiere una sesión autenticada.' })
@ApiForbiddenResponse({ description: 'La organización activa no tiene una membresía válida.' })
@Controller()
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class RegulatoryContentController {
  constructor(private readonly regulatorySources: RegulatorySourceService) {}

  @Get('regulatory-provisions/:provisionId')
  @ApiOperation({ summary: 'Obtiene una disposición editorial por su identidad inmutable.' })
  @ApiOkResponse({ description: 'Localizador breve con fuente y versión exactas.' })
  @ApiNotFoundResponse({ description: 'Disposición estructurada no encontrada.' })
  provision(@Param('provisionId', new ParseUUIDPipe()) provisionId: string) {
    return this.regulatorySources.getProvision(provisionId);
  }

  @Get('regulatory-requirements')
  @ApiOperation({ summary: 'Lista candidatos de requisito globales y revisados humanamente.' })
  @ApiOkResponse({ description: 'Catálogo editorial; no expresa aplicabilidad u obligación.' })
  requirements() {
    return this.regulatorySources.listRequirements();
  }

  @Get('regulatory-requirements/:requirementKey')
  @ApiOperation({ summary: 'Obtiene un requisito y su procedencia completa.' })
  @ApiOkResponse({ description: 'Fuente, versión exacta, disposición y estado de revisión.' })
  @ApiNotFoundResponse({ description: 'Requisito estructurado no encontrado.' })
  requirement(@Param('requirementKey') requirementKey: string) {
    return this.regulatorySources.getRequirement(requirementKey);
  }
}
