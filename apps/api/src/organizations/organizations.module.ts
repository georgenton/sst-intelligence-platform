import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../catalog/entitlements.module';
import {
  OrganizationInvitationsController,
  OrganizationsController,
} from './organizations.controller';
import { OrganizationGuard } from './organization.guard';
import { OrganizationTeamService } from './organization-team.service';
import { OrganizationsService } from './organizations.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [EntitlementsModule],
  controllers: [OrganizationsController, OrganizationInvitationsController],
  providers: [OrganizationsService, OrganizationTeamService, OrganizationGuard, RolesGuard],
  exports: [OrganizationsService, OrganizationTeamService, OrganizationGuard, RolesGuard],
})
export class OrganizationsModule {}
