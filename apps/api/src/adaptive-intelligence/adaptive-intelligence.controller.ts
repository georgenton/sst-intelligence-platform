import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { ADAPTIVE_CONFIGURATION_WRITE_ROLES } from '../adaptive-configuration/adaptive-configuration.policy';
import { AdaptiveIntelligenceService } from './adaptive-intelligence.service';
import { ConvertGapToPlanDto, CreateGapAnalysisDto, GapAnalysisQueryDto } from './dto';

type OrgContext = { id: string; role: string };

@ApiTags('adaptive-intelligence')
@ApiBearerAuth()
@Controller('adaptive-intelligence')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class AdaptiveIntelligenceController {
  constructor(private readonly service: AdaptiveIntelligenceService) {}
  @Get('gap-analyses') list(
    @OrganizationContext() org: OrgContext,
    @Query() query: GapAnalysisQueryDto,
  ) {
    return this.service.list(org.id, query);
  }
  @Get('gap-analyses/:id') get(@OrganizationContext() org: OrgContext, @Param('id') id: string) {
    return this.service.get(org.id, id);
  }
  @Post('gap-analyses')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateGapAnalysisDto,
    @Req() request: ApiRequest,
  ) {
    return this.service.create(org.id, user.id, body, requestMetadata(request));
  }
  @Post('gap-analyses/:id/plan-draft')
  @Roles(...ADAPTIVE_CONFIGURATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  plan(
    @OrganizationContext() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ConvertGapToPlanDto,
    @Req() request: ApiRequest,
  ) {
    return this.service.convertToPlan(org.id, user.id, id, body, requestMetadata(request));
  }
}
