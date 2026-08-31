import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import type { AuthenticatedUser } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { CreateOrganizationInspectionStandardDto, SaveInspectionStandardPolicyDto } from './dto';
import { InspectionStandardsService } from './inspection-standards.service';

const POLICY_WRITE_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

@ApiTags('inspection-standards')
@ApiBearerAuth()
@Controller('inspection-standards')
@RequireEntitlement('module.inspections')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class InspectionStandardsController {
  constructor(private readonly standards: InspectionStandardsService) {}

  @Get('catalog')
  catalog(@OrganizationContext() organization: { id: string }) {
    return this.standards.catalog(organization.id);
  }

  @Get('sources/:sourceId')
  source(@OrganizationContext() organization: { id: string }, @Param('sourceId') sourceId: string) {
    return this.standards.source(organization.id, sourceId);
  }

  @Get('organization/policy')
  policy(@OrganizationContext() organization: { id: string }) {
    return this.standards.policy(organization.id);
  }

  @Put('organization/policy')
  @Roles(...POLICY_WRITE_ROLES)
  @UseGuards(RolesGuard)
  savePolicy(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveInspectionStandardPolicyDto,
  ) {
    return this.standards.savePolicy(organization.id, user.id, body);
  }

  @Post('organization/sources')
  @Roles(...POLICY_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createSource(
    @OrganizationContext() organization: { id: string },
    @Body() body: CreateOrganizationInspectionStandardDto,
  ) {
    return this.standards.createOrganizationStandard(organization.id, body);
  }
}
