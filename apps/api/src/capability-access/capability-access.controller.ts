import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { ActivateCapabilityDemoDto } from './dto';
import { CapabilityAccessService } from './capability-access.service';

@ApiTags('capability-access')
@ApiBearerAuth()
@Controller('capability-access')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class CapabilityAccessController {
  constructor(private readonly access: CapabilityAccessService) {}

  @Get()
  overview(
    @OrganizationContext() organization: { id: string },
    @Query('assessmentId') assessmentId?: string,
  ) {
    return this.access.overview(organization.id, assessmentId);
  }

  @Post('demo')
  @Roles('ORG_OWNER', 'ORG_ADMIN')
  @UseGuards(RolesGuard)
  activateDemo(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ActivateCapabilityDemoDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.access.activateDemo(
      organization.id,
      user.id,
      body,
      idempotencyKey,
      requestMetadata(request),
    );
  }
}
