import { Module } from '@nestjs/common';
import { EntitlementGuard } from '../catalog/entitlement.guard';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { WorkPermitsController } from './work-permits.controller';
import { WorkPermitsService } from './work-permits.service';

@Module({
  controllers: [WorkPermitsController],
  providers: [WorkPermitsService, OrganizationGuard, RolesGuard, EntitlementGuard],
})
export class WorkPermitsModule {}
