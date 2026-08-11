import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { OrganizationContext } from '../organizations/organization-context.decorator';
import { CatalogService } from './catalog.service';
import { EntitlementService } from './entitlement.service';
import { EntitlementGuard } from './entitlement.guard';
import { RequireEntitlement } from './entitlement.decorator';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard)
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get('module-catalog')
  modules() {
    return this.catalog.modules();
  }

  @Get('entitlements')
  @UseGuards(OrganizationGuard)
  effective(@OrganizationContext() organization: { id: string }) {
    return this.entitlements.effective(organization.id);
  }

  @Get('subscription')
  @UseGuards(OrganizationGuard)
  subscription(@OrganizationContext() organization: { id: string }) {
    return this.catalog.subscription(organization.id);
  }

  @Get('entitlements/protected/technical-risk')
  @RequireEntitlement('module.technical_risk')
  @UseGuards(OrganizationGuard, EntitlementGuard)
  protectedTechnicalRisk() {
    return { available: true, featureKey: 'module.technical_risk' };
  }
}
