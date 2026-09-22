import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CapabilityAccessController } from './capability-access.controller';
import { CapabilityAccessService } from './capability-access.service';
import { DemoCapabilityProvisioningService } from './demo-capability-provisioning.service';

@Module({
  imports: [AuditModule, CatalogModule],
  controllers: [CapabilityAccessController],
  providers: [CapabilityAccessService, DemoCapabilityProvisioningService],
  exports: [CapabilityAccessService, DemoCapabilityProvisioningService],
})
export class CapabilityAccessModule {}
