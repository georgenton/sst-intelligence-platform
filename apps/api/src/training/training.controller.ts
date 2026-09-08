import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { TRAINING_FEATURE_KEY } from '../catalog/entitlement';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  CompleteTrainingParticipantDto,
  AddTrainingAudienceDto,
  CreateCompetencyRequirementDto,
  CreateTrainingDefinitionDto,
  CreateTrainingSessionDto,
  CreateTrainingNeedDto,
  EnrollTrainingParticipantDto,
  RecordTrainingAttendanceDto,
  TrainingDefinitionQueryDto,
  TrainingSessionQueryDto,
  TransitionTrainingSessionDto,
} from './dto';
import { TRAINING_REVIEW_ROLES, TRAINING_WRITE_ROLES } from './training-policy';
import { TrainingService } from './training.service';

@ApiTags('training')
@ApiBearerAuth()
@Controller('training')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
@RequireEntitlement(TRAINING_FEATURE_KEY)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get('definitions')
  definitions(
    @OrganizationContext() organization: { id: string },
    @Query() query: TrainingDefinitionQueryDto,
  ) {
    return this.training.definitions(organization.id, query);
  }

  @Post('definitions')
  @Roles(...TRAINING_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  createDefinition(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTrainingDefinitionDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.createDefinition(organization.id, user.id, body, requestMetadata(request));
  }

  @Get('needs')
  needs(@OrganizationContext() organization: { id: string }) {
    return this.training.needs(organization.id);
  }

  @Post('needs')
  @Roles(...TRAINING_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createNeed(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTrainingNeedDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.createNeed(organization.id, user.id, body, requestMetadata(request));
  }

  @Post('needs/:needId/audiences')
  @Roles(...TRAINING_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addAudience(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('needId') needId: string,
    @Body() body: AddTrainingAudienceDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.addAudience(
      organization.id,
      needId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('plan')
  plan(@OrganizationContext() organization: { id: string }) {
    return this.training.plan(organization.id);
  }

  @Get('sessions')
  sessions(
    @OrganizationContext() organization: { id: string },
    @Query() query: TrainingSessionQueryDto,
  ) {
    return this.training.sessions(organization.id, query);
  }

  @Post('sessions')
  @Roles(...TRAINING_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createSession(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTrainingSessionDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.createSession(organization.id, user.id, body, requestMetadata(request));
  }

  @Get('sessions/:sessionId')
  session(
    @OrganizationContext() organization: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.training.session(organization.id, sessionId);
  }

  @Post('sessions/:sessionId/transition')
  @Roles(...TRAINING_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  transitionSession(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: TransitionTrainingSessionDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.transitionSession(
      organization.id,
      sessionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('sessions/:sessionId/participants')
  @Roles(...TRAINING_WRITE_ROLES)
  @UseGuards(RolesGuard)
  enroll(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: EnrollTrainingParticipantDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.enroll(
      organization.id,
      sessionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('sessions/:sessionId/participants/:participantId/attendance')
  @Roles(...TRAINING_WRITE_ROLES)
  @UseGuards(RolesGuard)
  attendance(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Param('participantId') participantId: string,
    @Body() body: RecordTrainingAttendanceDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.attendance(
      organization.id,
      sessionId,
      participantId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('sessions/:sessionId/participants/:participantId/complete')
  @Roles(...TRAINING_WRITE_ROLES)
  @UseGuards(RolesGuard)
  completeParticipant(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Param('participantId') participantId: string,
    @Body() body: CompleteTrainingParticipantDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.completeParticipant(
      organization.id,
      sessionId,
      participantId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('requirements')
  @Roles(...TRAINING_WRITE_ROLES)
  @UseGuards(RolesGuard)
  requirement(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCompetencyRequirementDto,
    @Req() request: ApiRequest,
  ) {
    return this.training.createRequirement(
      organization.id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('workers/:workerId')
  worker(@OrganizationContext() organization: { id: string }, @Param('workerId') workerId: string) {
    return this.training.workerWorkspace(organization.id, workerId);
  }
}
