import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  CreateInspectionDraftProposalDto,
  InspectionResourceQueryDto,
  ReviewInspectionDraftProposalDto,
} from './dto';
import {
  INSPECTION_RESOURCE_PROPOSAL_ROLES,
  INSPECTION_RESOURCE_REVIEW_ROLES,
} from './inspection-resources.policy';
import { InspectionResourcesService } from './inspection-resources.service';

@ApiTags('inspection-resources')
@ApiBearerAuth()
@Controller('inspection-resources')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class InspectionResourcesController {
  constructor(private readonly resources: InspectionResourcesService) {}

  @Get()
  catalog(
    @OrganizationContext() organization: { id: string },
    @Query() query: InspectionResourceQueryDto,
  ) {
    return this.resources.catalog(organization.id, query);
  }

  @Get('proposals')
  proposals(@OrganizationContext() organization: { id: string }) {
    return this.resources.listProposals(organization.id);
  }

  @Post('proposals')
  @Roles(...INSPECTION_RESOURCE_PROPOSAL_ROLES)
  @UseGuards(RolesGuard)
  createProposal(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInspectionDraftProposalDto,
    @Req() request: ApiRequest,
  ) {
    return this.resources.createProposal(organization.id, user.id, body, requestMetadata(request));
  }

  @Post('proposals/:proposalId/submit')
  @Roles(...INSPECTION_RESOURCE_PROPOSAL_ROLES)
  @UseGuards(RolesGuard)
  submit(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('proposalId') proposalId: string,
    @Req() request: ApiRequest,
  ) {
    return this.resources.submit(organization.id, proposalId, user.id, requestMetadata(request));
  }

  @Post('proposals/:proposalId/review')
  @Roles(...INSPECTION_RESOURCE_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  review(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('proposalId') proposalId: string,
    @Body() body: ReviewInspectionDraftProposalDto,
    @Req() request: ApiRequest,
  ) {
    return this.resources.review(
      organization.id,
      proposalId,
      user.id,
      body,
      requestMetadata(request),
    );
  }
}
