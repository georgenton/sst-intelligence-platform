import { Global, Module } from '@nestjs/common';
import { EntitlementGuard } from './entitlement.guard';
import { EntitlementService } from './entitlement.service';

@Global()
@Module({
  providers: [EntitlementService, EntitlementGuard],
  exports: [EntitlementService, EntitlementGuard],
})
export class EntitlementsModule {}
