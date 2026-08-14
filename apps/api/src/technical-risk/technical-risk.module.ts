import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { TechnicalAssessmentService } from './technical-assessment.service';
import {
  NoopTechnicalAssessmentMutationSync,
  TECHNICAL_ASSESSMENT_MUTATION_SYNC,
} from './technical-assessment-mutation-sync';
import { TechnicalCalculationRegistry } from './technical-calculation.registry';
import { TechnicalMethodService } from './technical-method.service';
import { TechnicalRiskController } from './technical-risk.controller';

@Module({
  controllers: [TechnicalRiskController],
  providers: [
    TechnicalMethodService,
    TechnicalAssessmentService,
    {
      provide: TECHNICAL_ASSESSMENT_MUTATION_SYNC,
      useClass: NoopTechnicalAssessmentMutationSync,
    },
    TechnicalCalculationRegistry,
    OrganizationGuard,
    RolesGuard,
    EntitlementGuard,
  ],
})
export class TechnicalRiskModule {}
