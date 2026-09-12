import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  ClaimNewOrganizationPublicAssessmentDto,
  ClaimPublicAssessmentDto,
  CreateAuthenticatedAssessmentDto,
  CreatePublicAssessmentDto,
  MutateSstAssessmentDto,
  SubmitSstAssessmentAnswersDto,
} from './dto';
import { SST_ASSESSMENT_WRITE_ROLES } from './sst-assessment.policy';
import { SstAssessmentService } from './sst-assessment.service';

type Organization = { id: string; role: string };

@ApiTags('sst-assessment')
@Controller('sst-assessment')
export class SstAssessmentController {
  constructor(private readonly assessments: SstAssessmentService) {}

  @Post('public/sessions')
  createPublic(@Body() body: CreatePublicAssessmentDto) {
    return this.assessments.createPublic(body);
  }

  @Get('public/sessions/:sessionId')
  getPublic(@Param('sessionId') sessionId: string, @Headers('x-assessment-token') token?: string) {
    return this.assessments.getPublic(sessionId, token);
  }

  @Post('public/sessions/:sessionId/answers')
  submitPublicAnswers(
    @Param('sessionId') sessionId: string,
    @Headers('x-assessment-token') token: string | undefined,
    @Body() body: SubmitSstAssessmentAnswersDto,
  ) {
    return this.assessments.submitPublicAnswers(sessionId, token, body);
  }

  @Post('public/sessions/:sessionId/evaluate')
  evaluatePublic(
    @Param('sessionId') sessionId: string,
    @Headers('x-assessment-token') token: string | undefined,
    @Body() body: MutateSstAssessmentDto,
  ) {
    return this.assessments.evaluatePublic(sessionId, token, body.expectedSessionRevision);
  }

  @Post('public/sessions/:sessionId/complete')
  completePublic(
    @Param('sessionId') sessionId: string,
    @Headers('x-assessment-token') token: string | undefined,
    @Body() body: MutateSstAssessmentDto,
  ) {
    return this.assessments.completePublic(sessionId, token, body.expectedSessionRevision);
  }

  @Post('public/sessions/:sessionId/claim')
  @ApiBearerAuth()
  @Roles(...SST_ASSESSMENT_WRITE_ROLES)
  @UseGuards(AccessTokenGuard, OrganizationGuard, RolesGuard)
  claimPublic(
    @Param('sessionId') sessionId: string,
    @OrganizationContext() organization: Organization,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ClaimPublicAssessmentDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.claimPublic(
      sessionId,
      organization.id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('public/sessions/:sessionId/claim-new-organization')
  @ApiBearerAuth()
  @Roles('ORG_OWNER')
  @UseGuards(AccessTokenGuard, OrganizationGuard, RolesGuard)
  claimPublicForNewOrganization(
    @Param('sessionId') sessionId: string,
    @OrganizationContext() organization: Organization,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ClaimNewOrganizationPublicAssessmentDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.claimPublicForNewOrganization(
      sessionId,
      organization.id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('setup-state')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, OrganizationGuard)
  setupState(@OrganizationContext() organization: Organization) {
    return this.assessments.setupState(organization.id);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, OrganizationGuard)
  history(@OrganizationContext() organization: Organization) {
    return this.assessments.listHistory(organization.id);
  }

  @Post('sessions')
  @ApiBearerAuth()
  @Roles(...SST_ASSESSMENT_WRITE_ROLES)
  @UseGuards(AccessTokenGuard, OrganizationGuard, RolesGuard)
  createAuthenticated(
    @OrganizationContext() organization: Organization,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAuthenticatedAssessmentDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.createAuthenticated(
      organization.id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('sessions/:sessionId')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, OrganizationGuard)
  getAuthenticated(
    @OrganizationContext() organization: Organization,
    @Param('sessionId') sessionId: string,
  ) {
    return this.assessments.getAuthenticated(organization.id, sessionId);
  }

  @Post('sessions/:sessionId/answers')
  @ApiBearerAuth()
  @Roles(...SST_ASSESSMENT_WRITE_ROLES)
  @UseGuards(AccessTokenGuard, OrganizationGuard, RolesGuard)
  submitAuthenticatedAnswers(
    @OrganizationContext() organization: Organization,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitSstAssessmentAnswersDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.submitAuthenticatedAnswers(
      organization.id,
      user.id,
      sessionId,
      body,
      requestMetadata(request),
    );
  }

  @Post('sessions/:sessionId/evaluate')
  @ApiBearerAuth()
  @Roles(...SST_ASSESSMENT_WRITE_ROLES)
  @UseGuards(AccessTokenGuard, OrganizationGuard, RolesGuard)
  evaluateAuthenticated(
    @OrganizationContext() organization: Organization,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: MutateSstAssessmentDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.evaluateAuthenticated(
      organization.id,
      user.id,
      sessionId,
      body.expectedSessionRevision,
      requestMetadata(request),
    );
  }

  @Post('sessions/:sessionId/finalize')
  @ApiBearerAuth()
  @Roles(...SST_ASSESSMENT_WRITE_ROLES)
  @UseGuards(AccessTokenGuard, OrganizationGuard, RolesGuard)
  finalizeAuthenticated(
    @OrganizationContext() organization: Organization,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: MutateSstAssessmentDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.finalizeAuthenticated(
      organization.id,
      user.id,
      sessionId,
      body.expectedSessionRevision,
      requestMetadata(request),
    );
  }
}
