import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { ReviewOperationalSignalDto } from './dto';
import { OperationalIntelligenceService } from './operational-intelligence.service';
import { OPERATIONAL_INTELLIGENCE_REVIEW_ROLES } from './operational-intelligence.policy';

@ApiTags('operational-intelligence')
@ApiBearerAuth()
@Controller('operational-intelligence')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class OperationalIntelligenceController {
  constructor(private readonly intelligence: OperationalIntelligenceService) {}

  @Get('signals')
  list(@OrganizationContext() organization: { id: string }) {
    return this.intelligence.listSignals(organization.id);
  }

  @Post('signals/evaluate')
  @Roles(...OPERATIONAL_INTELLIGENCE_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  evaluate(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: ApiRequest,
  ) {
    return this.intelligence.evaluate(organization.id, user.id, requestMetadata(request));
  }

  @Post('signals/:signalId/review')
  @Roles(...OPERATIONAL_INTELLIGENCE_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  review(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('signalId') signalId: string,
    @Body() body: ReviewOperationalSignalDto,
    @Req() request: ApiRequest,
  ) {
    return this.intelligence.review(
      organization.id,
      signalId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('work-centers/:workCenterId/overview')
  workCenterOverview(
    @OrganizationContext() organization: { id: string },
    @Param('workCenterId') workCenterId: string,
  ) {
    return this.intelligence.workCenterOverview(organization.id, workCenterId);
  }

  @Get('workers/:workerId/facts')
  workerFacts(
    @OrganizationContext() organization: { id: string },
    @Param('workerId') workerId: string,
  ) {
    return this.intelligence.workerFacts(organization.id, workerId);
  }
}
