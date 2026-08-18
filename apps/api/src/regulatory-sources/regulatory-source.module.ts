import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RegulatorySourceController } from './regulatory-source.controller';
import { RegulatorySourceService } from './regulatory-source.service';

@Module({
  controllers: [RegulatorySourceController],
  providers: [RegulatorySourceService, OrganizationGuard],
})
export class RegulatorySourceModule {}
