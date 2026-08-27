import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser, ApiRequest } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import {
  CreateOrganizationDto,
  CreateWorkCenterDto,
  InvitationTokenDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
  UpdateWorkCenterDto,
} from './dto';
import { OrganizationGuard } from './organization.guard';
import { OrganizationContext, OrganizationIdParam, Roles } from './organization-context.decorator';
import { OrganizationTeamService } from './organization-team.service';
import { OrganizationsService } from './organizations.service';
import { RolesGuard } from './roles.guard';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(AccessTokenGuard)
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly team: OrganizationTeamService,
  ) {}

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
    return this.team.members(organization.id);
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
    return this.team.invite(organization.id, user.id, body, requestMetadata(request));
  }

  @Get(':id/invitations')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  invitations(@OrganizationContext() organization: { id: string }) {
    return this.team.invitations(organization.id);
  }

  @Post(':id/invitations/:invitationId/revoke')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  revokeInvitation(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Req() request: ApiRequest,
  ) {
    return this.team.revoke(organization.id, invitationId, user.id, requestMetadata(request));
  }

  @Patch(':id/members/:membershipId/role')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  updateMemberRole(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body() body: UpdateMemberRoleDto,
    @Req() request: ApiRequest,
  ) {
    return this.team.updateMemberRole(
      organization.id,
      membershipId,
      user.id,
      body.role,
      requestMetadata(request),
    );
  }

  @Post(':id/members/:membershipId/deactivate')
  @OrganizationIdParam()
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(OrganizationGuard, RolesGuard)
  deactivateMember(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Req() request: ApiRequest,
  ) {
    return this.team.deactivateMember(
      organization.id,
      membershipId,
      user.id,
      requestMetadata(request),
    );
  }
}

@ApiTags('organization-invitations')
@ApiBearerAuth()
@Controller('organization-invitations')
@UseGuards(AccessTokenGuard)
export class OrganizationInvitationsController {
  constructor(private readonly team: OrganizationTeamService) {}

  @Post('inspect')
  inspect(@CurrentUser() user: AuthenticatedUser, @Body() body: InvitationTokenDto) {
    return this.team.inspect(body.token, user.email);
  }

  @Post('accept')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InvitationTokenDto,
    @Req() request: ApiRequest,
  ) {
    return this.team.accept(body.token, user, requestMetadata(request));
  }
}
