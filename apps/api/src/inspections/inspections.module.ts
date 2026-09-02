import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { RiskMethodologyModule } from '../risk-methodology/risk-methodology.module';
import { InspectionBasisModule } from '../inspection-basis/inspection-basis.module';
import { InspectionStandardsModule } from '../inspection-standards/inspection-standards.module';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';

@Module({
  imports: [RiskMethodologyModule, InspectionStandardsModule, InspectionBasisModule],
  controllers: [InspectionsController],
  providers: [InspectionsService, OrganizationGuard, RolesGuard, EntitlementGuard],
  exports: [InspectionsService],
})
export class InspectionsModule {}
