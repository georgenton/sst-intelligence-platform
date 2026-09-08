import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { INCIDENTS_FEATURE_KEY } from '../catalog/entitlement';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { INCIDENT_REVIEW_ROLES, INCIDENT_WRITE_ROLES } from '../incidents/incident-policy';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  AddSafetyObservationEvidenceDto,
  CreateSafetyObservationDto,
  LinkSafetyObservationActionDto,
  SafetyObservationQueryDto,
  TransitionSafetyObservationDto,
} from './dto';
import { SafetyObservationsService } from './safety-observations.service';

@ApiTags('safety-observations')
@ApiBearerAuth()
@Controller('safety-observations')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
@RequireEntitlement(INCIDENTS_FEATURE_KEY)
export class SafetyObservationsController {
  constructor(private readonly observations: SafetyObservationsService) {}

  @Get()
  list(
    @OrganizationContext() organization: { id: string },
    @Query() query: SafetyObservationQueryDto,
  ) {
    return this.observations.list(organization.id, query);
  }

  @Post()
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSafetyObservationDto,
    @Req() request: ApiRequest,
  ) {
    return this.observations.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Get(':id')
  get(@OrganizationContext() organization: { id: string }, @Param('id') id: string) {
    return this.observations.get(organization.id, id);
  }

  @Post(':id/transition')
  @Roles(...INCIDENT_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  transition(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TransitionSafetyObservationDto,
    @Req() request: ApiRequest,
  ) {
    return this.observations.transition(
      organization.id,
      id,
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
    @Body() body: AddSafetyObservationEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.observations.addEvidence(
      organization.id,
      id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':id/actions')
  @Roles(...INCIDENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  linkAction(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: LinkSafetyObservationActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.observations.linkAction(
      organization.id,
      id,
      user.id,
      body,
      requestMetadata(request),
    );
  }
}
