import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { AdaptiveConfigurationController } from './adaptive-configuration.controller';
import { AdaptiveConfigurationService } from './adaptive-configuration.service';

@Module({
  controllers: [AdaptiveConfigurationController],
  providers: [AdaptiveConfigurationService, OrganizationGuard, RolesGuard],
})
export class AdaptiveConfigurationModule {}
