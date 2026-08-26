import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { UnifiedSstEvaluationController } from './unified-sst-evaluation.controller';
import { UnifiedSstEvaluationService } from './unified-sst-evaluation.service';

@Module({
  controllers: [UnifiedSstEvaluationController],
  providers: [UnifiedSstEvaluationService, OrganizationGuard, RolesGuard],
  exports: [UnifiedSstEvaluationService],
})
export class UnifiedSstEvaluationModule {}
