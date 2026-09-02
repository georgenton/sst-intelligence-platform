import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidencePackagesController } from './evidence-packages.controller';
import { EvidencePackagesService } from './evidence-packages.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [EvidencePackagesController],
  providers: [EvidencePackagesService],
})
export class EvidencePackagesModule {}
