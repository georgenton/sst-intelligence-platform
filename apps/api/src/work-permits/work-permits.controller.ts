import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WORK_PERMITS_FEATURE_KEY } from '../catalog/entitlement';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  ApproveWorkPermitDto,
  CreateWorkPermitDto,
  WorkPermitQueryDto,
  WorkPermitTransitionDto,
} from './dto';
import { WorkPermitsService } from './work-permits.service';

const WRITE_ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
] as const;
const APPROVE_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

@ApiTags('work-permits')
@ApiBearerAuth()
@Controller('work-permits')
@RequireEntitlement(WORK_PERMITS_FEATURE_KEY)
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class WorkPermitsController {
  constructor(private readonly permits: WorkPermitsService) {}

  @Get('templates')
  templates() {
    return this.permits.templates();
  }

  @Get()
  list(@OrganizationContext() organization: { id: string }, @Query() query: WorkPermitQueryDto) {
    return this.permits.list(organization.id, query);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateWorkPermitDto,
    @Req() request: ApiRequest,
  ) {
    return this.permits.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Get(':id')
  get(@OrganizationContext() organization: { id: string }, @Param('id') id: string) {
    return this.permits.get(organization.id, id);
  }

  @Post(':id/transition')
  @Roles(...WRITE_ROLES)
  @UseGuards(RolesGuard)
  transition(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: WorkPermitTransitionDto,
    @Req() request: ApiRequest,
  ) {
    return this.permits.transition(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/approve')
  @Roles(...APPROVE_ROLES)
  @UseGuards(RolesGuard)
  approve(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ApproveWorkPermitDto,
    @Req() request: ApiRequest,
  ) {
    return this.permits.approve(organization.id, id, user.id, body, requestMetadata(request));
  }
}
