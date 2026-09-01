import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { PPE_FEATURE_KEY } from '../catalog/entitlement';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  AcknowledgePpeIssueDto,
  CreatePpeCatalogItemDto,
  CreatePpeIssueDto,
  CreatePpeRequirementDto,
  InspectPpeIssueDto,
  PpeCatalogQueryDto,
  ReplacePpeIssueDto,
} from './dto';
import { PPE_REVIEW_ROLES, PPE_WRITE_ROLES } from './ppe-policy';
import { PpeService } from './ppe.service';

@ApiTags('ppe')
@ApiBearerAuth()
@Controller('ppe')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
@RequireEntitlement(PPE_FEATURE_KEY)
export class PpeController {
  constructor(private readonly ppe: PpeService) {}

  @Get('catalog')
  catalog(@OrganizationContext() organization: { id: string }, @Query() query: PpeCatalogQueryDto) {
    return this.ppe.catalog(organization.id, query);
  }

  @Post('catalog')
  @Roles(...PPE_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  createCatalogItem(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePpeCatalogItemDto,
    @Req() request: ApiRequest,
  ) {
    return this.ppe.createCatalogItem(organization.id, user.id, body, requestMetadata(request));
  }

  @Get('workers/:workerId')
  worker(@OrganizationContext() organization: { id: string }, @Param('workerId') workerId: string) {
    return this.ppe.workerWorkspace(organization.id, workerId);
  }

  @Post('requirements')
  @Roles(...PPE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createRequirement(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePpeRequirementDto,
    @Req() request: ApiRequest,
  ) {
    return this.ppe.createRequirement(organization.id, user.id, body, requestMetadata(request));
  }

  @Post('issues')
  @Roles(...PPE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  issue(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePpeIssueDto,
    @Req() request: ApiRequest,
  ) {
    return this.ppe.issue(organization.id, user.id, body, requestMetadata(request));
  }

  @Post('issues/:issueId/acknowledge')
  @Roles(...PPE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  acknowledge(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId') issueId: string,
    @Body() body: AcknowledgePpeIssueDto,
    @Req() request: ApiRequest,
  ) {
    return this.ppe.acknowledge(organization.id, issueId, user.id, body, requestMetadata(request));
  }

  @Post('issues/:issueId/inspect')
  @Roles(...PPE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  inspect(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId') issueId: string,
    @Body() body: InspectPpeIssueDto,
    @Req() request: ApiRequest,
  ) {
    return this.ppe.inspect(organization.id, issueId, user.id, body, requestMetadata(request));
  }

  @Post('issues/:issueId/replace')
  @Roles(...PPE_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  replace(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId') issueId: string,
    @Body() body: ReplacePpeIssueDto,
    @Req() request: ApiRequest,
  ) {
    return this.ppe.replace(organization.id, issueId, user.id, body, requestMetadata(request));
  }
}
