import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationGuard } from '../organizations/organization.guard';
import { OrganizationContext } from '../organizations/organization-context.decorator';
import { DashboardService } from './dashboard.service';
import { UpgradeRequestDto } from './dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  dashboard(@OrganizationContext() organization: { id: string }) {
    return this.dashboardService.dashboard(organization.id);
  }

  @Post('upgrade-requests')
  requestUpgrade(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpgradeRequestDto,
    @Req() request: ApiRequest,
  ) {
    return this.dashboardService.requestUpgrade(
      organization.id,
      user.id,
      body,
      requestMetadata(request),
    );
  }
}
