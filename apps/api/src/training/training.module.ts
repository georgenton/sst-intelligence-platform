import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [PrismaModule, AuditModule, CatalogModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
