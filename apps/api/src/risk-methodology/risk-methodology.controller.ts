import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import type { AuthenticatedUser } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { SaveOrganizationGuided5x5ProfileDto, SaveOrganizationRiskMethodPolicyDto } from './dto';
import { RiskMethodologyService } from './risk-methodology.service';

type OrgContext = { id: string; role: string };
const POLICY_WRITE_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

@ApiTags('risk-methodology')
@ApiBearerAuth()
@Controller('risk-methods')
@RequireEntitlement('module.inspections')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class RiskMethodologyController {
  constructor(private readonly riskMethods: RiskMethodologyService) {}

  @Get()
  catalog() {
    return this.riskMethods.catalog();
  }

  @Get('organization/policy')
  policy(@OrganizationContext() organization: OrgContext) {
    return this.riskMethods.organizationPolicy(organization.id);
  }

  @Put('organization/policy')
  @Roles(...POLICY_WRITE_ROLES)
  @UseGuards(RolesGuard)
  savePolicy(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveOrganizationRiskMethodPolicyDto,
  ) {
    return this.riskMethods.saveOrganizationPolicy(organization.id, user.id, body);
  }

  @Get('organization/guided-5x5-profile')
  guided5x5Profile(@OrganizationContext() organization: OrgContext) {
    return this.riskMethods.guided5x5Profile(organization.id);
  }

  @Put('organization/guided-5x5-profile')
  @Roles(...POLICY_WRITE_ROLES)
  @UseGuards(RolesGuard)
  saveGuided5x5Profile(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveOrganizationGuided5x5ProfileDto,
  ) {
    return this.riskMethods.saveGuided5x5Profile(organization.id, user.id, body);
  }

  @Get(':versionId')
  version(@Param('versionId') versionId: string) {
    return this.riskMethods.catalogVersion(versionId);
  }
}
