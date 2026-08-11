import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [CatalogModule, OrganizationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
