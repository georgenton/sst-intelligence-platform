import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { RegulatoryRiskLinkController } from './regulatory-risk-link.controller';
import { RegulatoryRiskLinkService } from './regulatory-risk-link.service';

@Module({
  controllers: [RegulatoryRiskLinkController],
  providers: [RegulatoryRiskLinkService, OrganizationGuard, RolesGuard],
})
export class RegulatoryRiskLinkModule {}
