import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  CreatePositionDto,
  CreatePositionRiskDto,
  CreateWorkerDto,
  DeactivateWorkerDto,
  UpdateWorkerDto,
  WorkerQueryDto,
} from './dto';
import { WORKER_ADMIN_ROLES } from './worker-policy';
import { WorkersService } from './workers.service';

@ApiTags('workers')
@ApiBearerAuth()
@Controller('workers')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  @Get()
  list(@OrganizationContext() organization: { id: string }, @Query() query: WorkerQueryDto) {
    return this.workers.list(organization.id, query);
  }

  @Get('positions')
  positions(@OrganizationContext() organization: { id: string }) {
    return this.workers.positions(organization.id);
  }

  @Get('work-areas')
  workAreas(@OrganizationContext() organization: { id: string }) {
    return this.workers.workAreas(organization.id);
  }

  @Post('positions')
  @Roles(...WORKER_ADMIN_ROLES)
  @UseGuards(RolesGuard)
  createPosition(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePositionDto,
    @Req() request: ApiRequest,
  ) {
    return this.workers.createPosition(organization.id, user.id, body, requestMetadata(request));
  }

  @Post('positions/:positionId/risks')
  @Roles(...WORKER_ADMIN_ROLES)
  @UseGuards(RolesGuard)
  addPositionRisk(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('positionId') positionId: string,
    @Body() body: CreatePositionRiskDto,
    @Req() request: ApiRequest,
  ) {
    return this.workers.addPositionRisk(
      organization.id,
      positionId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Get('positions/:positionId/ppe-candidates')
  positionPpeCandidates(
    @OrganizationContext() organization: { id: string },
    @Param('positionId') positionId: string,
  ) {
    return this.workers.positionPpeCandidates(organization.id, positionId);
  }

  @Post()
  @Roles(...WORKER_ADMIN_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateWorkerDto,
    @Req() request: ApiRequest,
  ) {
    return this.workers.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Get(':id')
  get(@OrganizationContext() organization: { id: string }, @Param('id') id: string) {
    return this.workers.get(organization.id, id);
  }

  @Patch(':id')
  @Roles(...WORKER_ADMIN_ROLES)
  @UseGuards(RolesGuard)
  update(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateWorkerDto,
    @Req() request: ApiRequest,
  ) {
    return this.workers.update(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/deactivate')
  @Roles(...WORKER_ADMIN_ROLES)
  @UseGuards(RolesGuard)
  deactivate(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: DeactivateWorkerDto,
    @Req() request: ApiRequest,
  ) {
    return this.workers.deactivate(organization.id, id, user.id, body, requestMetadata(request));
  }
}
