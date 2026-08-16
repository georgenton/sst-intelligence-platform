import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { APPLICABILITY_ADMIN_ROLES } from './applicability-policy';
import { ApplicabilityService } from './applicability.service';
import { CreateOrganizationSstProfileVersionDto, EvaluateApplicabilityDto } from './dto';

type OrgContext = { id: string; role: string };

@ApiTags('applicability')
@ApiBearerAuth()
@Controller('applicability')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class ApplicabilityController {
  constructor(private readonly applicability: ApplicabilityService) {}

  @Get('profile-versions')
  listProfileVersions(@OrganizationContext() organization: OrgContext) {
    return this.applicability.listProfileVersions(organization.id);
  }

  @Post('profile-versions')
  @Roles(...APPLICABILITY_ADMIN_ROLES)
  @UseGuards(RolesGuard)
  createProfileVersion(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrganizationSstProfileVersionDto,
    @Req() request: ApiRequest,
  ) {
    return this.applicability.createProfileVersion(
      organization.id,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('profile-versions/:profileVersionId')
  getProfileVersion(
    @OrganizationContext() organization: OrgContext,
    @Param('profileVersionId') profileVersionId: string,
  ) {
    return this.applicability.getProfileVersion(organization.id, profileVersionId);
  }

  @Get('rule-packs')
  listRulePacks() {
    return this.applicability.listRulePacks();
  }

  @Get('assessments')
  listAssessments(@OrganizationContext() organization: OrgContext) {
    return this.applicability.listAssessments(organization.id);
  }

  @Post('assessments')
  @Roles(...APPLICABILITY_ADMIN_ROLES)
  @UseGuards(RolesGuard)
  evaluate(
    @OrganizationContext() organization: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: EvaluateApplicabilityDto,
    @Req() request: ApiRequest,
  ) {
    return this.applicability.evaluate(organization.id, user.id, body, requestMetadata(request));
  }

  @Get('assessments/:assessmentId')
  getAssessment(
    @OrganizationContext() organization: OrgContext,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.applicability.getAssessment(organization.id, assessmentId);
  }
}
