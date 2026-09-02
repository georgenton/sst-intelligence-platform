import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { ConsultantPortfolioService } from './consultant-portfolio.service';
import { PortfolioCopilotRequestDto, PortfolioQueryDto } from './dto';
import { PortfolioCopilotService } from './portfolio-copilot.service';

@ApiTags('consultant-portfolio')
@ApiBearerAuth()
@Controller('portfolio')
@UseGuards(AccessTokenGuard)
export class ConsultantPortfolioController {
  constructor(
    private readonly portfolio: ConsultantPortfolioService,
    private readonly copilot: PortfolioCopilotService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Query() query: PortfolioQueryDto) {
    return this.portfolio.get(user.id, query);
  }

  @Get('provider-status')
  providerStatus() {
    return this.copilot.status();
  }

  @Post('copilot/query')
  query(@CurrentUser() user: AuthenticatedUser, @Body() body: PortfolioCopilotRequestDto) {
    return this.copilot.query(user.id, body);
  }

  @Get('organizations/:organizationId')
  organization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
  ) {
    return this.portfolio.organization(user.id, organizationId);
  }
}
