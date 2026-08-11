import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../catalog/entitlements.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationGuard } from './organization.guard';
import { OrganizationsService } from './organizations.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [EntitlementsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationGuard, RolesGuard],
  exports: [OrganizationsService, OrganizationGuard, RolesGuard],
})
export class OrganizationsModule {}
