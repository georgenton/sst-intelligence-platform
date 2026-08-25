import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
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
  CreateTechnicalAssessmentDto,
  CreateTechnicalEvidenceDto,
  ReviewTechnicalAssessmentDto,
  SaveTechnicalResponseDto,
  UpdateTechnicalAssessmentDto,
} from './dto';
import { TechnicalAssessmentService } from './technical-assessment.service';
import { TechnicalMethodService } from './technical-method.service';
import {
  TECHNICAL_ASSESSMENT_REVIEW_ROLES,
  TECHNICAL_ASSESSMENT_WRITE_ROLES,
} from './technical-risk-policy';

type OrgContext = { id: string; role: string };

@ApiTags('technical-risk')
@ApiBearerAuth()
@Controller('technical-risk')
@RequireEntitlement('module.technical_risk')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class TechnicalRiskController {
  constructor(
    private readonly methods: TechnicalMethodService,
    private readonly assessments: TechnicalAssessmentService,
  ) {}

  @Get('methods')
  listMethods(@OrganizationContext() organization: OrgContext) {
    return this.methods.list(organization.id);
  }

  @Get('methods/:methodKey')
  getMethod(
    @OrganizationContext() organization: OrgContext,
    @Param('methodKey') methodKey: string,
  ) {
    return this.methods.get(organization.id, methodKey);
  }

  @Get('assessments')
  list(@OrganizationContext() organization: OrgContext) {
    return this.assessments.list(organization.id);
  }

  @Post('assessments')
  @Roles(...TECHNICAL_ASSESSMENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTechnicalAssessmentDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Get('assessments/:id')
  get(@OrganizationContext() organization: OrgContext, @Param('id') id: string) {
    return this.assessments.get(organization.id, id);
  }

  @Patch('assessments/:id')
  @Roles(...TECHNICAL_ASSESSMENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  update(
    @OrganizationContext() organization: OrgContext,
    @Param('id') id: string,
    @Body() body: UpdateTechnicalAssessmentDto,
  ) {
    return this.assessments.update(organization.id, id, body);
  }

  @Post('assessments/:id/start')
  @Roles(...TECHNICAL_ASSESSMENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  start(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.start(organization.id, id, user.id, requestMetadata(request));
  }

  @Put('assessments/:id/responses/:questionKey')
  @Roles(...TECHNICAL_ASSESSMENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  saveResponse(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('questionKey') questionKey: string,
    @Body() body: SaveTechnicalResponseDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.saveResponse(
      organization.id,
      id,
      questionKey,
      body.value,
      user.id,
      requestMetadata(request),
    );
  }

  @Post('assessments/:id/evidence')
  @Roles(...TECHNICAL_ASSESSMENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addEvidence(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateTechnicalEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.addEvidence(
      organization.id,
      id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post('assessments/:id/complete')
  @Roles(...TECHNICAL_ASSESSMENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  complete(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.complete(organization.id, id, user.id, requestMetadata(request));
  }

  @Post('assessments/:id/review')
  @Roles(...TECHNICAL_ASSESSMENT_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  review(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReviewTechnicalAssessmentDto,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.review(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post('assessments/:id/revisions')
  @Roles(...TECHNICAL_ASSESSMENT_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createRevision(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: ApiRequest,
  ) {
    return this.assessments.createRevision(organization.id, id, user.id, requestMetadata(request));
  }
}
