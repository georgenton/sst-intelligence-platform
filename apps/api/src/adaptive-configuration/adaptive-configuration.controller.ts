import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { AdaptiveConfigurationService } from './adaptive-configuration.service';
import { ADAPTIVE_CONFIGURATION_WRITE_ROLES } from './adaptive-configuration.policy';
import {
  AddAdaptiveEvidenceDto,
  CreateAdaptiveSessionDto,
  DeclareAdaptiveCurrentStateDto,
  EvaluateAdaptiveSessionDto,
  SubmitAdaptiveAnswersDto,
} from './dto';

type OrgContext = { id: string; role: string };

@ApiTags('adaptive-configuration')
@ApiBearerAuth()
@Controller('adaptive-configuration')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class AdaptiveConfigurationController {
  constructor(private readonly adaptive: AdaptiveConfigurationService) {}

  @Get('rule-packs')
  listRulePacks() {
    return this.adaptive.listRulePacks();
  }

  @Get('sessions')
  listSessions(@OrganizationContext() organization: OrgContext) {
    return this.adaptive.listSessions(organization.id);
  }

  @Post('sessions')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createSession(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAdaptiveSessionDto,
    @Req() request: ApiRequest,
  ) {
    return this.adaptive.createSession(organization.id, user.id, body, requestMetadata(request));
  }

  @Get('sessions/:sessionId')
  getSession(
    @OrganizationContext() organization: OrgContext,
    @Param('sessionId') sessionId: string,
  ) {
    return this.adaptive.getSession(organization.id, sessionId);
  }

  @Post('sessions/:sessionId/answers')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  submitAnswers(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitAdaptiveAnswersDto,
    @Req() request: ApiRequest,
  ) {
    return this.adaptive.submitAnswers(
      organization.id,
      user.id,
      sessionId,
      body,
      requestMetadata(request),
    );
  }

  @Post('sessions/:sessionId/evaluate')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  evaluate(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: EvaluateAdaptiveSessionDto,
    @Req() request: ApiRequest,
  ) {
    return this.adaptive.evaluate(
      organization.id,
      user.id,
      sessionId,
      body.expectedSessionRevision,
      requestMetadata(request),
    );
  }

  @Get('sessions/:sessionId/questions')
  questions(
    @OrganizationContext() organization: OrgContext,
    @Param('sessionId') sessionId: string,
  ) {
    return this.adaptive.getLatestQuestions(organization.id, sessionId);
  }

  @Get('sessions/:sessionId/runs')
  runs(@OrganizationContext() organization: OrgContext, @Param('sessionId') sessionId: string) {
    return this.adaptive.listRuns(organization.id, sessionId);
  }

  @Get('sessions/:sessionId/proposals')
  proposals(
    @OrganizationContext() organization: OrgContext,
    @Param('sessionId') sessionId: string,
  ) {
    return this.adaptive.listProposals(organization.id, sessionId);
  }

  @Get('proposals/:proposalId')
  proposal(
    @OrganizationContext() organization: OrgContext,
    @Param('proposalId') proposalId: string,
  ) {
    return this.adaptive.getProposal(organization.id, proposalId);
  }

  @Post('proposals/:proposalId/current-state')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  declareCurrentState(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('proposalId') proposalId: string,
    @Body() body: DeclareAdaptiveCurrentStateDto,
    @Req() request: ApiRequest,
  ) {
    return this.adaptive.declareCurrentState(
      organization.id,
      user.id,
      proposalId,
      body,
      requestMetadata(request),
    );
  }

  @Post('proposals/:proposalId/evidence')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addEvidence(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('proposalId') proposalId: string,
    @Body() body: AddAdaptiveEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.adaptive.addEvidence(
      organization.id,
      user.id,
      proposalId,
      body,
      requestMetadata(request),
    );
  }

  @Post('sessions/:sessionId/finalize')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  finalize(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: EvaluateAdaptiveSessionDto,
    @Req() request: ApiRequest,
  ) {
    return this.adaptive.finalize(
      organization.id,
      user.id,
      sessionId,
      body.expectedSessionRevision,
      requestMetadata(request),
    );
  }
}
