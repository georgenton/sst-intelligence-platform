import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';

@Module({
  controllers: [GovernanceController],
  providers: [GovernanceService, OrganizationGuard, RolesGuard],
  exports: [GovernanceService],
})
export class GovernanceModule {}
