import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  AddGovernanceMemberDto,
  CreateGovernanceActionDto,
  CreateGovernanceBodyDto,
  CreateGovernanceDecisionDto,
  CreateGovernanceEvidenceDto,
  CreateGovernanceMeetingDto,
  TransitionGovernanceActionDto,
  TransitionGovernanceMeetingDto,
} from './dto';
import { GOVERNANCE_WRITE_ROLES } from './governance.policy';
import { GovernanceService } from './governance.service';

@ApiTags('governance')
@ApiBearerAuth()
@Controller('governance')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get('bodies')
  list(@OrganizationContext() organization: { id: string }) {
    return this.governance.listBodies(organization.id);
  }

  @Get('bodies/:bodyId')
  get(@OrganizationContext() organization: { id: string }, @Param('bodyId') bodyId: string) {
    return this.governance.getBody(organization.id, bodyId);
  }

  @Post('bodies')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createBody(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateGovernanceBodyDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.createBody(organization.id, user.id, body, requestMetadata(request));
  }

  @Post('bodies/:bodyId/members')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addMember(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('bodyId') bodyId: string,
    @Body() body: AddGovernanceMemberDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.addMember(
      organization.id,
      bodyId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('bodies/:bodyId/meetings')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createMeeting(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('bodyId') bodyId: string,
    @Body() body: CreateGovernanceMeetingDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.createMeeting(
      organization.id,
      bodyId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('meetings/:meetingId/transition')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  transitionMeeting(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId') meetingId: string,
    @Body() body: TransitionGovernanceMeetingDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.transitionMeeting(
      organization.id,
      meetingId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('meetings/:meetingId/decisions')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createDecision(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId') meetingId: string,
    @Body() body: CreateGovernanceDecisionDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.createDecision(
      organization.id,
      meetingId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('decisions/:decisionId/actions')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createAction(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('decisionId') decisionId: string,
    @Body() body: CreateGovernanceActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.createAction(
      organization.id,
      decisionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Patch('actions/:actionId/status')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  transitionAction(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('actionId') actionId: string,
    @Body() body: TransitionGovernanceActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.transitionAction(
      organization.id,
      actionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('meetings/:meetingId/evidence')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addMeetingEvidence(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId') meetingId: string,
    @Body() body: CreateGovernanceEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.addEvidence(
      organization.id,
      user.id,
      { meetingId },
      body,
      requestMetadata(request),
    );
  }

  @Post('decisions/:decisionId/evidence')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addDecisionEvidence(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('decisionId') decisionId: string,
    @Body() body: CreateGovernanceEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.addEvidence(
      organization.id,
      user.id,
      { decisionId },
      body,
      requestMetadata(request),
    );
  }

  @Post('actions/:actionId/evidence')
  @Roles(...GOVERNANCE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addActionEvidence(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('actionId') actionId: string,
    @Body() body: CreateGovernanceEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.governance.addEvidence(
      organization.id,
      user.id,
      { actionId },
      body,
      requestMetadata(request),
    );
  }
}
