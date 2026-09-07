import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../organizations/roles.guard';
import { OperationalPlansController } from './operational-plans.controller';
import { OperationalPlansService } from './operational-plans.service';

@Module({
  imports: [AuditModule],
  controllers: [OperationalPlansController],
  providers: [OperationalPlansService, RolesGuard],
  exports: [OperationalPlansService],
})
export class OperationalPlansModule {}
