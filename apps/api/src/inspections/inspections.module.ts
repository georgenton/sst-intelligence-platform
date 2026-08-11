import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';

@Module({
  controllers: [InspectionsController],
  providers: [InspectionsService, OrganizationGuard, RolesGuard, EntitlementGuard],
  exports: [InspectionsService],
})
export class InspectionsModule {}
