import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser, ApiRequest } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import {
  CreateOrganizationDto,
  CreateWorkCenterDto,
  InviteMemberDto,
  UpdateOrganizationDto,
  UpdateWorkCenterDto,
} from './dto';
import { OrganizationGuard } from './organization.guard';
import { OrganizationContext, OrganizationIdParam, Roles } from './organization-context.decorator';
import { OrganizationsService } from './organizations.service';
import { RolesGuard } from './roles.guard';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(AccessTokenGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrganizationDto,
    @Req() request: ApiRequest,
  ) {
    return this.organizations.create(user.id, body, requestMetadata(request));
  }

  @Get(':id')
  @OrganizationIdParam()
  @UseGuards(OrganizationGuard)
  get(@OrganizationContext() organization: { id: string }) {
    return this.organizations.get(organization.id);
  }

  @Patch(':id')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  update(@OrganizationContext() organization: { id: string }, @Body() body: UpdateOrganizationDto) {
    return this.organizations.update(organization.id, body);
  }

  @Get(':id/members')
  @OrganizationIdParam()
  @UseGuards(OrganizationGuard)
  members(@OrganizationContext() organization: { id: string }) {
    return this.organizations.members(organization.id);
  }

  @Get(':id/work-centers')
  @OrganizationIdParam()
  @UseGuards(OrganizationGuard)
  workCenters(@OrganizationContext() organization: { id: string }) {
    return this.organizations.workCenters(organization.id);
  }

  @Get(':id/work-centers/:workCenterId')
  @OrganizationIdParam()
  @UseGuards(OrganizationGuard)
  workCenter(
    @OrganizationContext() organization: { id: string },
    @Param('workCenterId') workCenterId: string,
  ) {
    return this.organizations.workCenter(organization.id, workCenterId);
  }

  @Post(':id/work-centers')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  createWorkCenter(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateWorkCenterDto,
    @Req() request: ApiRequest,
  ) {
    return this.organizations.createWorkCenter(
      organization.id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Patch(':id/work-centers/:workCenterId')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  updateWorkCenter(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('workCenterId') workCenterId: string,
    @Body() body: UpdateWorkCenterDto,
    @Req() request: ApiRequest,
  ) {
    return this.organizations.updateWorkCenter(
      organization.id,
      workCenterId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':id/invitations')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  invite(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InviteMemberDto,
    @Req() request: ApiRequest,
  ) {
    return this.organizations.invite(organization.id, user.id, body, requestMetadata(request));
  }
}
