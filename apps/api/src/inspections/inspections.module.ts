import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { RiskMethodologyModule } from '../risk-methodology/risk-methodology.module';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';

@Module({
  imports: [RiskMethodologyModule],
  controllers: [InspectionsController],
  providers: [InspectionsService, OrganizationGuard, RolesGuard, EntitlementGuard],
  exports: [InspectionsService],
})
export class InspectionsModule {}
