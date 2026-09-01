import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { INCIDENTS_FEATURE_KEY } from '../catalog/entitlement';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  AddIncidentWorkerDto,
  CompleteIncidentInvestigationDto,
  CreateIncidentActionDto,
  CreateIncidentDto,
  CreateIncidentEvidenceDto,
  CreateIncidentFactorDto,
  IncidentQueryDto,
  StartIncidentInvestigationDto,
  TransitionIncidentActionDto,
  TransitionIncidentDto,
  VerifyIncidentActionDto,
} from './dto';
import { INCIDENT_REVIEW_ROLES, INCIDENT_WRITE_ROLES } from './incident-policy';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
@RequireEntitlement(INCIDENTS_FEATURE_KEY)
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  list(@OrganizationContext() organization: { id: string }, @Query() query: IncidentQueryDto) {
    return this.incidents.list(organization.id, query);
  }

  @Get('analytics/summary')
  analytics(@OrganizationContext() organization: { id: string }) {
    return this.incidents.analytics(organization.id);
  }

  @Post()
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateIncidentDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Get(':id')
  get(@OrganizationContext() organization: { id: string }, @Param('id') id: string) {
    return this.incidents.get(organization.id, id);
  }

  @Post(':id/transition')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  transition(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TransitionIncidentDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.transition(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/close')
  @Roles(...INCIDENT_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  close(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TransitionIncidentDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.close(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/workers')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addWorker(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AddIncidentWorkerDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.addWorker(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/investigation/start')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  startInvestigation(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: StartIncidentInvestigationDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.startInvestigation(
      organization.id,
      id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':id/investigation/complete')
  @Roles(...INCIDENT_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  completeInvestigation(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CompleteIncidentInvestigationDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.completeInvestigation(
      organization.id,
      id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':id/factors')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addFactor(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateIncidentFactorDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.addFactor(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/actions')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createAction(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateIncidentActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.createAction(
      organization.id,
      id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':id/actions/:actionId/transition')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  transitionAction(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body() body: TransitionIncidentActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.transitionAction(
      organization.id,
      id,
      actionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':id/actions/:actionId/verify')
  @Roles(...INCIDENT_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  verifyAction(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body() body: VerifyIncidentActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.verifyAction(
      organization.id,
      id,
      actionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':id/evidence')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addEvidence(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateIncidentEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.incidents.addEvidence(organization.id, id, user.id, body, requestMetadata(request));
  }
}
