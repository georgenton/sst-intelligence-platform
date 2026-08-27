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
  CreateObligationEvidenceDto,
  CreateObligationExecutionDto,
  ObligationExecutionQueryDto,
  ReviewObligationExecutionDto,
  TransitionObligationExecutionDto,
  UpdateObligationExecutionDto,
} from './dto';
import { OBLIGATION_REVIEW_ROLES, OBLIGATION_WRITE_ROLES } from './operational-execution.policy';
import { OperationalExecutionService } from './operational-execution.service';

@ApiTags('operational-execution')
@ApiBearerAuth()
@Controller('operational-execution/obligations')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class OperationalExecutionController {
  constructor(private readonly operations: OperationalExecutionService) {}

  @Get()
  list(
    @OrganizationContext() organization: { id: string },
    @Query() query: ObligationExecutionQueryDto,
  ) {
    return this.operations.list(organization.id, query);
  }

  @Post()
  @Roles(...OBLIGATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateObligationExecutionDto,
    @Req() request: ApiRequest,
  ) {
    return this.operations.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Get(':id')
  get(@OrganizationContext() organization: { id: string }, @Param('id') id: string) {
    return this.operations.get(organization.id, id);
  }

  @Patch(':id')
  @Roles(...OBLIGATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  update(
    @OrganizationContext() organization: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateObligationExecutionDto,
  ) {
    return this.operations.update(organization.id, id, body);
  }

  @Post(':id/transition')
  @Roles(...OBLIGATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  transition(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TransitionObligationExecutionDto,
    @Req() request: ApiRequest,
  ) {
    return this.operations.transition(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/review')
  @Roles(...OBLIGATION_REVIEW_ROLES)
  @UseGuards(RolesGuard)
  review(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReviewObligationExecutionDto,
    @Req() request: ApiRequest,
  ) {
    return this.operations.review(organization.id, id, user.id, body, requestMetadata(request));
  }

  @Post(':id/evidence')
  @Roles(...OBLIGATION_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addEvidence(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateObligationEvidenceDto,
    @Req() request: ApiRequest,
  ) {
    return this.operations.addEvidence(
      organization.id,
      id,
      user.id,
      body,
      requestMetadata(request),
    );
  }
}
