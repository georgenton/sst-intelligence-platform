import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InspectionDomain } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import type { AuthenticatedUser } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  CreateInspectionBasisDto,
  InspectionBasisCompositionDto,
  SearchRegulatoryUnitsDto,
} from './dto';
import { InspectionBasisService } from './inspection-basis.service';

const BASIS_WRITE_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

@ApiTags('inspection-bases')
@ApiBearerAuth()
@Controller('inspection-bases')
@RequireEntitlement('module.inspections')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class InspectionBasisController {
  constructor(private readonly bases: InspectionBasisService) {}

  @Get()
  list(@OrganizationContext() organization: { id: string }) {
    return this.bases.list(organization.id);
  }

  @Get('regulatory-units')
  regulatoryUnits(@Query() query: SearchRegulatoryUnitsDto) {
    return this.bases.searchRegulatoryUnits(query);
  }

  @Get('active/:inspectionDomain')
  active(
    @OrganizationContext() organization: { id: string },
    @Param('inspectionDomain') inspectionDomain: InspectionDomain,
  ) {
    return this.bases.active(organization.id, inspectionDomain);
  }

  @Get('versions/:versionId')
  version(
    @OrganizationContext() organization: { id: string },
    @Param('versionId') versionId: string,
  ) {
    return this.bases.getVersion(organization.id, versionId);
  }

  @Post()
  @Roles(...BASIS_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInspectionBasisDto,
  ) {
    return this.bases.createDefinition(organization.id, user.id, body);
  }

  @Post(':definitionId/versions')
  @Roles(...BASIS_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createVersion(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('definitionId') definitionId: string,
    @Body() body: InspectionBasisCompositionDto,
  ) {
    return this.bases.createVersion(organization.id, definitionId, user.id, body);
  }

  @Post('versions/:versionId/activate')
  @Roles(...BASIS_WRITE_ROLES)
  @UseGuards(RolesGuard)
  activate(
    @OrganizationContext() organization: { id: string },
    @Param('versionId') versionId: string,
  ) {
    return this.bases.activate(organization.id, versionId);
  }

  @Post('versions/:versionId/retire')
  @Roles(...BASIS_WRITE_ROLES)
  @UseGuards(RolesGuard)
  retire(
    @OrganizationContext() organization: { id: string },
    @Param('versionId') versionId: string,
  ) {
    return this.bases.retire(organization.id, versionId);
  }
}
