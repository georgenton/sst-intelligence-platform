import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { OperationalExecutionController } from './operational-execution.controller';
import { OperationalExecutionService } from './operational-execution.service';

@Module({
  controllers: [OperationalExecutionController],
  providers: [OperationalExecutionService, OrganizationGuard, RolesGuard],
  exports: [OperationalExecutionService],
})
export class OperationalExecutionModule {}
