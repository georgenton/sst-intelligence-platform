import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationGuard } from '../organizations/organization.guard';
import { OrganizationContext } from '../organizations/organization-context.decorator';
import { UpdateSessionDto } from './dto';
import { SolutionFinderService } from './solution-finder.service';

@ApiTags('solution-finder')
@Controller('solution-finder/sessions')
export class SolutionFinderController {
  constructor(private readonly solutionFinder: SolutionFinderService) {}

  @Post()
  create() {
    return this.solutionFinder.create();
  }

  @Get(':id')
  get(@Param('id') id: string, @Headers('x-session-token') token?: string) {
    return this.solutionFinder.get(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Headers('x-session-token') token: string | undefined,
    @Body() body: UpdateSessionDto,
  ) {
    return this.solutionFinder.update(id, token, body);
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @Headers('x-session-token') token: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.solutionFinder.complete(id, token, requestMetadata(request));
  }

  @Post(':id/claim')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, OrganizationGuard)
  claim(
    @Param('id') id: string,
    @Headers('x-session-token') token: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @OrganizationContext() organization: { id: string },
  ) {
    return this.solutionFinder.claim(id, token, user.id, organization.id);
  }

  @Post(':id/activate-demo')
  @ApiBearerAuth()
  @RequireEntitlement('demo.enabled')
  @UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
  activateDemo(
    @Param('id') id: string,
    @Headers('x-session-token') token: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @OrganizationContext() organization: { id: string },
    @Req() request: ApiRequest,
  ) {
    return this.solutionFinder.activateDemo(
      id,
      token,
      user.id,
      organization.id,
      requestMetadata(request),
    );
  }
}
