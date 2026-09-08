import { Module } from '@nestjs/common';
import { ManagementIntelligenceController } from './management-intelligence.controller';
import { ManagementIntelligenceService } from './management-intelligence.service';
@Module({
  controllers: [ManagementIntelligenceController],
  providers: [ManagementIntelligenceService],
})
export class ManagementIntelligenceModule {}
