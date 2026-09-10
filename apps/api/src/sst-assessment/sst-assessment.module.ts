import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { AssessmentSpecialists } from './assessment-specialists';
import { SstAssessmentController } from './sst-assessment.controller';
import { SstAssessmentService } from './sst-assessment.service';

@Module({
  controllers: [SstAssessmentController],
  providers: [SstAssessmentService, AssessmentSpecialists, OrganizationGuard, RolesGuard],
})
export class SstAssessmentModule {}
