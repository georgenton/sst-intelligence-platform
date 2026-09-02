import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PpeController } from './ppe.controller';
import { PpeService } from './ppe.service';

@Module({
  imports: [PrismaModule, AuditModule, CatalogModule],
  controllers: [PpeController],
  providers: [PpeService],
  exports: [PpeService],
})
export class PpeModule {}
