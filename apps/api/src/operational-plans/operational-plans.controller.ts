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
  CreateOperationalPlanDto,
  GenerateOperationalPlanDto,
  OperationalPlanQueryDto,
  TransitionOperationalPlanItemDto,
} from './dto';
import {
  OPERATIONAL_PLAN_ACTIVATE_ROLES,
  OPERATIONAL_PLAN_WRITE_ROLES,
} from './operational-plan.policy';
import { OperationalPlansService } from './operational-plans.service';

@ApiTags('operational-plans')
@ApiBearerAuth()
@Controller('operational-plans')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class OperationalPlansController {
  constructor(private readonly plans: OperationalPlansService) {}

  @Get()
  list(
    @OrganizationContext() organization: { id: string },
    @Query() query: OperationalPlanQueryDto,
  ) {
    return this.plans.list(organization.id, query);
  }

  @Get(':planId')
  get(@OrganizationContext() organization: { id: string }, @Param('planId') planId: string) {
    return this.plans.get(organization.id, planId);
  }

  @Post()
  @Roles(...OPERATIONAL_PLAN_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOperationalPlanDto,
    @Req() request: ApiRequest,
  ) {
    return this.plans.createManual(organization.id, user.id, body, requestMetadata(request));
  }

  @Post('generate-draft')
  @Roles(...OPERATIONAL_PLAN_WRITE_ROLES)
  @UseGuards(RolesGuard)
  generate(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateOperationalPlanDto,
    @Req() request: ApiRequest,
  ) {
    return this.plans.generateDraft(organization.id, user.id, body, requestMetadata(request));
  }

  @Post(':planId/versions')
  @Roles(...OPERATIONAL_PLAN_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createVersion(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') planId: string,
    @Body() body: CreateOperationalPlanDto,
    @Req() request: ApiRequest,
  ) {
    return this.plans.createVersion(
      organization.id,
      planId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':planId/versions/:versionId/activate')
  @Roles(...OPERATIONAL_PLAN_ACTIVATE_ROLES)
  @UseGuards(RolesGuard)
  activate(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Req() request: ApiRequest,
  ) {
    return this.plans.activate(
      organization.id,
      planId,
      versionId,
      user.id,
      requestMetadata(request),
    );
  }

  @Post('items/:itemId/transition')
  @Roles(...OPERATIONAL_PLAN_WRITE_ROLES)
  @UseGuards(RolesGuard)
  transition(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
    @Body() body: TransitionOperationalPlanItemDto,
    @Req() request: ApiRequest,
  ) {
    return this.plans.transitionItem(
      organization.id,
      itemId,
      user.id,
      body,
      requestMetadata(request),
    );
  }
}
