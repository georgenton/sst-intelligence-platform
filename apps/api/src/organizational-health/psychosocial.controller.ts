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
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import {
  CreatePsychosocialAssessmentCycleDto,
  CreatePsychosocialProgramDto,
  LinkPsychosocialPlanItemDto,
  UpdatePsychosocialAssessmentCycleDto,
  UpdatePsychosocialProgramDto,
} from './dto';
import { OrganizationalHealthService } from './organizational-health.service';

const PROGRAM_WRITE_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

@ApiTags('psychosocial')
@ApiBearerAuth()
@Controller('psychosocial')
@RequireEntitlement('module.psychosocial')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class PsychosocialController {
  constructor(private readonly health: OrganizationalHealthService) {}

  @Get('programs')
  list(@OrganizationContext() organization: { id: string }) {
    return this.health.listPsychosocialPrograms(organization.id);
  }

  @Get('legal-context')
  legalContext(@OrganizationContext() organization: { id: string }) {
    return this.health.getPsychosocialLegalContext(organization.id);
  }

  @Get('programs/:programId')
  get(
    @OrganizationContext() organization: { id: string },
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    return this.health.getPsychosocialProgram(organization.id, programId);
  }

  @Post('programs')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePsychosocialProgramDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.health.createPsychosocialProgram(
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
    @Body() body: UpdatePsychosocialProgramDto,
    @Req() request: ApiRequest,
  ) {
    return this.health.updatePsychosocialProgram(
      organization.id,
      user.id,
      programId,
      body,
      requestMetadata(request),
    );
  }

  @Post('programs/:programId/cycles')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  createCycle(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() body: CreatePsychosocialAssessmentCycleDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.health.createPsychosocialCycle(
      organization.id,
      user.id,
      programId,
      body,
      requestMetadata(request),
      idempotencyKey,
    );
  }

  @Patch('cycles/:cycleId')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  updateCycle(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() body: UpdatePsychosocialAssessmentCycleDto,
    @Req() request: ApiRequest,
  ) {
    return this.health.updatePsychosocialCycle(
      organization.id,
      user.id,
      cycleId,
      body,
      requestMetadata(request),
    );
  }

  @Post('cycles/:cycleId/plan-item')
  @Roles(...PROGRAM_WRITE_ROLES)
  @UseGuards(RolesGuard)
  linkPlanItem(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() body: LinkPsychosocialPlanItemDto,
    @Req() request: ApiRequest,
  ) {
    return this.health.linkPsychosocialPlanItem(
      organization.id,
      user.id,
      cycleId,
      body.operationalPlanItemId,
      requestMetadata(request),
    );
  }
}
