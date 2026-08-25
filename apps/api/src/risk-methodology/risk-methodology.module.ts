import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RiskMethodologyController } from './risk-methodology.controller';
import { RiskMethodologyService } from './risk-methodology.service';

@Module({
  controllers: [RiskMethodologyController],
  providers: [RiskMethodologyService, OrganizationGuard, EntitlementGuard],
  exports: [RiskMethodologyService],
})
export class RiskMethodologyModule {}
