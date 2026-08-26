import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { RequireEntitlement } from '../catalog/entitlement.decorator';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RiskMethodologyService } from './risk-methodology.service';

@ApiTags('risk-methodology')
@ApiBearerAuth()
@Controller('risk-methods')
@RequireEntitlement('module.inspections')
@UseGuards(AccessTokenGuard, OrganizationGuard, EntitlementGuard)
export class RiskMethodologyController {
  constructor(private readonly riskMethods: RiskMethodologyService) {}

  @Get()
  catalog() {
    return this.riskMethods.catalog();
  }

  @Get(':versionId')
  version(@Param('versionId') versionId: string) {
    return this.riskMethods.catalogVersion(versionId);
  }
}
