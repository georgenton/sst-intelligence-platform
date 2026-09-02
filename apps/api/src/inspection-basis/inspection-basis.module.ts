import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { InspectionBasisController } from './inspection-basis.controller';
import { InspectionBasisService } from './inspection-basis.service';

@Module({
  controllers: [InspectionBasisController],
  providers: [InspectionBasisService, OrganizationGuard, RolesGuard, EntitlementGuard],
  exports: [InspectionBasisService],
})
export class InspectionBasisModule {}
