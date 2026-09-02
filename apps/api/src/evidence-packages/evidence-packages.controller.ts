import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { AddEvidencePackageItemDto, CreateEvidencePackageDto } from './dto';
import { EVIDENCE_PACKAGE_WRITE_ROLES } from './evidence-packages.policy';
import { EvidencePackagesService } from './evidence-packages.service';

@ApiTags('evidence-packages')
@ApiBearerAuth()
@Controller('evidence-packages')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class EvidencePackagesController {
  constructor(private readonly packages: EvidencePackagesService) {}

  @Get()
  list(@OrganizationContext() organization: { id: string }) {
    return this.packages.list(organization.id);
  }

  @Get(':packageId')
  get(@OrganizationContext() organization: { id: string }, @Param('packageId') packageId: string) {
    return this.packages.get(organization.id, packageId);
  }

  @Post()
  @Roles(...EVIDENCE_PACKAGE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  create(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateEvidencePackageDto,
    @Req() request: ApiRequest,
  ) {
    return this.packages.create(organization.id, user.id, body, requestMetadata(request));
  }

  @Post(':packageId/items')
  @Roles(...EVIDENCE_PACKAGE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  addItem(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId') packageId: string,
    @Body() body: AddEvidencePackageItemDto,
    @Req() request: ApiRequest,
  ) {
    return this.packages.addItem(
      organization.id,
      packageId,
      user.id,
      body,
      requestMetadata(request),
    );
  }

  @Post(':packageId/finalize')
  @Roles(...EVIDENCE_PACKAGE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  finalize(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId') packageId: string,
    @Req() request: ApiRequest,
  ) {
    return this.packages.finalize(organization.id, packageId, user.id, requestMetadata(request));
  }

  @Post(':packageId/archive')
  @Roles(...EVIDENCE_PACKAGE_WRITE_ROLES)
  @UseGuards(RolesGuard)
  archive(
    @OrganizationContext() organization: { id: string },
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId') packageId: string,
    @Req() request: ApiRequest,
  ) {
    return this.packages.archive(organization.id, packageId, user.id, requestMetadata(request));
  }
}
