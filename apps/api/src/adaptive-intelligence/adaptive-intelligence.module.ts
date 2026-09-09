import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OperationalPlansModule } from '../operational-plans/operational-plans.module';
import { RolesGuard } from '../organizations/roles.guard';
import { AdaptiveIntelligenceController } from './adaptive-intelligence.controller';
import { AdaptiveIntelligenceService } from './adaptive-intelligence.service';

@Module({
  imports: [AuditModule, OperationalPlansModule],
  controllers: [AdaptiveIntelligenceController],
  providers: [AdaptiveIntelligenceService, RolesGuard],
})
export class AdaptiveIntelligenceModule {}
