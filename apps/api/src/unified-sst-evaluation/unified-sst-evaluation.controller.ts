import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  AddUnifiedOrganizationEvidenceDto,
  CreateUnifiedSstEvaluationDto,
  DeclareUnifiedCurrentStateDto,
  LinkUnifiedRiskAssessmentDto,
  ReviewRegulatoryInterpretationDto,
} from './dto';
import {
  REGULATORY_INTERPRETATION_REVIEW_ROLES,
  UNIFIED_SST_EVALUATION_ROLES,
} from './unified-sst-evaluation.policy';
import { UnifiedSstEvaluationService } from './unified-sst-evaluation.service';

type OrgContext = { id: string; role: string };

@ApiTags('unified-sst-evaluation')
@ApiBearerAuth()
@Controller('unified-sst-evaluations')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class UnifiedSstEvaluationController {
  constructor(private readonly evaluations: UnifiedSstEvaluationService) {}

  @Get()
  list(@OrganizationContext() organization: OrgContext) {
    return this.evaluations.list(organization.id);
  }

  @Get('expert-workspace')
  workspace() {
    return this.evaluations.expertWorkspace();
  }

  @Post()
  @Roles(...UNIFIED_SST_EVALUATION_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateUnifiedSstEvaluationDto,
  ) {
    return this.evaluations.create(organization.id, user.id, input.profileVersionId);
  }

  @Get(':id')
  get(@OrganizationContext() organization: OrgContext, @Param('id') id: string) {
    return this.evaluations.get(organization.id, id);
  }

  @Put(':id/items/:itemId/current-state')
  @Roles(...UNIFIED_SST_EVALUATION_ROLES)
  @UseGuards(RolesGuard)
  declareCurrentState(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() input: DeclareUnifiedCurrentStateDto,
  ) {
    return this.evaluations.declareCurrentState(organization.id, user.id, id, itemId, input.status);
  }

  @Post(':id/items/:itemId/organization-evidence')
  @Roles(...UNIFIED_SST_EVALUATION_ROLES)
  @UseGuards(RolesGuard)
  addOrganizationEvidence(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() input: AddUnifiedOrganizationEvidenceDto,
  ) {
    return this.evaluations.addOrganizationEvidence(organization.id, user.id, id, itemId, input);
  }

  @Post(':id/items/:itemId/risk-references')
  @Roles(...UNIFIED_SST_EVALUATION_ROLES)
  @UseGuards(RolesGuard)
  linkRiskAssessment(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() input: LinkUnifiedRiskAssessmentDto,
  ) {
    return this.evaluations.linkRiskAssessment(
      organization.id,
      user.id,
      id,
      itemId,
      input.assessmentId,
    );
  }

  @Post('expert-workspace/:ruleDraftId/reviews')
  @Roles(...REGULATORY_INTERPRETATION_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  review(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleDraftId') ruleDraftId: string,
    @Body() input: ReviewRegulatoryInterpretationDto,
  ) {
    return this.evaluations.review(organization.id, user.id, ruleDraftId, input);
  }
}
