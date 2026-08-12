import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { TechnicalAssessmentService } from './technical-assessment.service';
import { TechnicalCalculationRegistry } from './technical-calculation.registry';
import { TechnicalMethodService } from './technical-method.service';
import { TechnicalRiskController } from './technical-risk.controller';

@Module({
  controllers: [TechnicalRiskController],
  providers: [
    TechnicalMethodService,
    TechnicalAssessmentService,
    TechnicalCalculationRegistry,
    OrganizationGuard,
    RolesGuard,
    EntitlementGuard,
  ],
})
export class TechnicalRiskModule {}
