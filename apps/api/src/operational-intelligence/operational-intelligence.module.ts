import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationalIntelligenceController } from './operational-intelligence.controller';
import { OperationalIntelligenceService } from './operational-intelligence.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OperationalIntelligenceController],
  providers: [OperationalIntelligenceService],
})
export class OperationalIntelligenceModule {}
