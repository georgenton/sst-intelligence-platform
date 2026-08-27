import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { WorkQueueController } from './work-queue.controller';
import { WorkQueueService } from './work-queue.service';

@Module({
  controllers: [WorkQueueController],
  providers: [WorkQueueService, OrganizationGuard],
  exports: [WorkQueueService],
})
export class WorkQueueModule {}
