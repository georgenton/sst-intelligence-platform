import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  AlertQueryDto,
  CompleteSystemicReviewDto,
  CreateActionDto,
  CreateEvidenceDto,
  CreateFindingDto,
  CreateInspectionDto,
  InspectionQueryDto,
  SearchFindingDto,
  UpdateActionDto,
  UpdateFindingDto,
  UpdateInspectionDto,
  VerifyFindingDto,
} from './dto';
import {
  INSPECTION_ALERT_ROLES,
  INSPECTION_VERIFY_ROLES,
  INSPECTION_WRITE_ROLES,
} from './inspection-policy';
import { InspectionsService } from './inspections.service';

type OrgContext = { id: string; role: string };

@ApiTags('inspections')
@ApiBearerAuth()
@Controller('inspections')
@RequireEntitlement('module.inspections')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Get('context')
  context(@OrganizationContext() organization: OrgContext) {
    return this.inspections.context(organization.id);
  }

  @Get('alerts')
  alerts(@OrganizationContext() organization: OrgContext, @Query() query: AlertQueryDto) {
    return this.inspections.alerts(organization.id, query);
  }

  @Post('alerts/:alertId/acknowledge')
  @Roles(...INSPECTION_ALERT_ROLES)
  @UseGuards(RolesGuard)
  acknowledge(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertId') alertId: string,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.acknowledgeAlert(
      organization.id,
      alertId,
      user.id,
      requestMetadata(request),
    );
  }

  @Post('alerts/:alertId/systemic-review')
  @Roles(...INSPECTION_ALERT_ROLES)
  @UseGuards(RolesGuard)
  createSystemicReview(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertId') alertId: string,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.createSystemicReview(
      organization.id,
      alertId,
      user.id,
      requestMetadata(request),
    );
  }

  @Get('systemic-reviews')
  systemicReviews(@OrganizationContext() organization: OrgContext) {
    return this.inspections.listSystemicReviews(organization.id);
  }

  @Get('systemic-reviews/:reviewId')
  systemicReview(
    @OrganizationContext() organization: OrgContext,
    @Param('reviewId') reviewId: string,
  ) {
    return this.inspections.getSystemicReview(organization.id, reviewId);
  }

  @Post('systemic-reviews/:reviewId/start')
  @Roles(...INSPECTION_ALERT_ROLES)
  @UseGuards(RolesGuard)
  startSystemicReview(
    @OrganizationContext() organization: OrgContext,
    @Param('reviewId') reviewId: string,
  ) {
    return this.inspections.startSystemicReview(organization.id, reviewId);
  }

  @Post('systemic-reviews/:reviewId/complete')
  @Roles(...INSPECTION_ALERT_ROLES)
  @UseGuards(RolesGuard)
  completeSystemicReview(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Body() body: CompleteSystemicReviewDto,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.completeSystemicReview(
      organization.id,
      reviewId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('analytics/summary')
  analytics(@OrganizationContext() organization: OrgContext, @Query() query: InspectionQueryDto) {
    return this.inspections.analytics(organization.id, query);
  }

  @Get('findings/search')
  search(@OrganizationContext() organization: OrgContext, @Query() query: SearchFindingDto) {
    return this.inspections.search(organization.id, query);
  }

  @Get()
  list(@OrganizationContext() organization: OrgContext, @Query() query: InspectionQueryDto) {
    return this.inspections.list(organization.id, query);
  }

  @Post()
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInspectionDto,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Get(':inspectionId')
  get(
    @OrganizationContext() organization: OrgContext,
    @Param('inspectionId') inspectionId: string,
  ) {
    return this.inspections.get(organization.id, inspectionId);
  }

  @Patch(':inspectionId')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  update(
    @OrganizationContext() organization: OrgContext,
    @Param('inspectionId') inspectionId: string,
    @Body() body: UpdateInspectionDto,
  ) {
    return this.inspections.update(organization.id, inspectionId, body);
  }

  @Post(':inspectionId/start')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  start(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.transition(
      organization.id,
      inspectionId,
      'IN_PROGRESS',
      user.id,
      requestMetadata(request),
    );
  }

  @Post(':inspectionId/complete')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  complete(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.transition(
      organization.id,
      inspectionId,
      'COMPLETED',
      user.id,
      requestMetadata(request),
    );
  }

  @Get(':inspectionId/findings')
  findings(
    @OrganizationContext() organization: OrgContext,
    @Param('inspectionId') inspectionId: string,
    @Query() query: InspectionQueryDto,
  ) {
    return this.inspections.listFindings(organization.id, inspectionId, query);
  }

  @Post(':inspectionId/findings')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createFinding(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Body() body: CreateFindingDto,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.createFinding(
      organization.id,
      inspectionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get(':inspectionId/findings/:findingId')
  getFinding(
    @OrganizationContext() organization: OrgContext,
    @Param('inspectionId') inspectionId: string,
    @Param('findingId') findingId: string,
  ) {
    return this.inspections.getFinding(organization.id, inspectionId, findingId);
  }

  @Patch(':inspectionId/findings/:findingId')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  updateFinding(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Param('findingId') findingId: string,
    @Body() body: UpdateFindingDto,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.updateFinding(
      organization.id,
      inspectionId,
      findingId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':inspectionId/findings/:findingId/actions')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createAction(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Param('findingId') findingId: string,
    @Body() body: CreateActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.createAction(
      organization.id,
      inspectionId,
      findingId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Patch(':inspectionId/findings/:findingId/actions/:actionId')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  updateAction(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Param('findingId') findingId: string,
    @Param('actionId') actionId: string,
    @Body() body: UpdateActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.updateAction(
      organization.id,
      inspectionId,
      findingId,
      actionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':inspectionId/findings/:findingId/actions/:actionId/evidence')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  evidence(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Param('findingId') findingId: string,
    @Param('actionId') actionId: string,
    @Body() body: CreateEvidenceDto,
  ) {
    return this.inspections.addEvidence(
      organization.id,
      inspectionId,
      findingId,
      actionId,
      user.id,
      body,
    );
  }

  @Post(':inspectionId/findings/:findingId/actions/:actionId/complete')
  @Roles(...INSPECTION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  completeAction(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Param('findingId') findingId: string,
    @Param('actionId') actionId: string,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.completeAction(
      organization,
      inspectionId,
      findingId,
      actionId,
      user.id,
      requestMetadata(request),
    );
  }

  @Post(':inspectionId/findings/:findingId/verify')
  @Roles(...INSPECTION_VERIFY_ROLES)
  @UseGuards(RolesGuard)
  verify(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inspectionId') inspectionId: string,
    @Param('findingId') findingId: string,
    @Body() body: VerifyFindingDto,
    @Req() request: ApiRequest,
  ) {
    return this.inspections.verifyFinding(
      organization.id,
      inspectionId,
      findingId,
      user.id,
      body,
      requestMetadata(request),
    );
  }
}
