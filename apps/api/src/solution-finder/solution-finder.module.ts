import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CapabilityAccessModule } from '../capability-access/capability-access.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SolutionFinderController } from './solution-finder.controller';
import { SolutionFinderService } from './solution-finder.service';

@Module({
  imports: [AiModule, CapabilityAccessModule, CatalogModule, OrganizationsModule],
  controllers: [SolutionFinderController],
  providers: [SolutionFinderService],
  exports: [SolutionFinderService],
})
export class SolutionFinderModule {}
