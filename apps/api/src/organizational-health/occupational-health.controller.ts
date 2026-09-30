import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  CreateOccupationalHealthActivityDto,
  CreateOccupationalHealthProgramDto,
  LinkOccupationalPlanItemDto,
  UpdateOccupationalHealthActivityDto,
  UpdateOccupationalHealthProgramDto,
} from './dto';
import { OrganizationalHealthService } from './organizational-health.service';

const PROGRAM_WRITE_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

@ApiTags('occupational-health')
@ApiBearerAuth()
@Controller('occupational-health')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class OccupationalHealthController {
  constructor(private readonly health: OrganizationalHealthService) {}

  @Get('programs')
  list(@OrganizationContext() organization: { id: string }) {
    return this.health.listOccupationalPrograms(organization.id);
  }

  @Get('programs/:programId')
  get(
    @OrganizationContext() organization: { id: string },
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    return this.health.getOccupationalProgram(organization.id, programId);
  }

  @Post('programs')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOccupationalHealthProgramDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.health.createOccupationalProgram(
      organization.id,
      user.id,
      body,
      requestMetadata(request),
      idempotencyKey,
    );
  }

  @Patch('programs/:programId')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  update(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() body: UpdateOccupationalHealthProgramDto,
    @Req() request: ApiRequest,
  ) {
    return this.health.updateOccupationalProgram(
      organization.id,
      user.id,
      programId,
      body,
      requestMetadata(request),
    );
  }

  @Post('programs/:programId/activities')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createActivity(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() body: CreateOccupationalHealthActivityDto,
    @Req() request: ApiRequest,
  ) {
    return this.health.createOccupationalActivity(
      organization.id,
      user.id,
      programId,
      body,
      requestMetadata(request),
    );
  }

  @Patch('activities/:activityId')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  updateActivity(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() body: UpdateOccupationalHealthActivityDto,
    @Req() request: ApiRequest,
  ) {
    return this.health.updateOccupationalActivity(
      organization.id,
      user.id,
      activityId,
      body,
      requestMetadata(request),
    );
  }

  @Post('activities/:activityId/plan-item')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  linkPlanItem(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() body: LinkOccupationalPlanItemDto,
    @Req() request: ApiRequest,
  ) {
    return this.health.linkOccupationalPlanItem(
      organization.id,
      user.id,
      activityId,
      body.operationalPlanItemId,
      requestMetadata(request),
    );
  }
}
