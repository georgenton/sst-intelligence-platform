import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EntitlementsModule } from '../catalog/entitlements.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuditModule, EntitlementsModule, OrganizationsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
