import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { ApplicabilityController } from './applicability.controller';
import { ApplicabilityService } from './applicability.service';

@Module({
  controllers: [ApplicabilityController],
  providers: [ApplicabilityService, OrganizationGuard, RolesGuard],
})
export class ApplicabilityModule {}
