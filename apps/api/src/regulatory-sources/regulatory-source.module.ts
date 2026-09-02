import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RegulatoryContentController } from './regulatory-content.controller';
import { RegulatorySourceController } from './regulatory-source.controller';
import { RegulatorySourceService } from './regulatory-source.service';

@Module({
  controllers: [RegulatorySourceController, RegulatoryContentController],
  providers: [RegulatorySourceService, OrganizationGuard],
  exports: [RegulatorySourceService],
})
export class RegulatorySourceModule {}
