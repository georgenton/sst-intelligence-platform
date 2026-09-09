import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EntitlementsModule } from '../catalog/entitlements.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidencePackagesController } from './evidence-packages.controller';
import { EvidencePackagesService } from './evidence-packages.service';

@Module({
  imports: [PrismaModule, AuditModule, EntitlementsModule],
  controllers: [EvidencePackagesController],
  providers: [EvidencePackagesService],
})
export class EvidencePackagesModule {}
