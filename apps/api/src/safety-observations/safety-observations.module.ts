import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EntitlementsModule } from '../catalog/entitlements.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SafetyObservationsController } from './safety-observations.controller';
import { SafetyObservationsService } from './safety-observations.service';

@Module({
  imports: [AuditModule, EntitlementsModule, OrganizationsModule],
  controllers: [SafetyObservationsController],
  providers: [SafetyObservationsService],
  exports: [SafetyObservationsService],
})
export class SafetyObservationsModule {}
