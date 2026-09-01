import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { InspectionStandardsController } from './inspection-standards.controller';
import { InspectionStandardsService } from './inspection-standards.service';

@Module({
  controllers: [InspectionStandardsController],
  providers: [InspectionStandardsService, OrganizationGuard, RolesGuard, EntitlementGuard],
  exports: [InspectionStandardsService],
})
export class InspectionStandardsModule {}
