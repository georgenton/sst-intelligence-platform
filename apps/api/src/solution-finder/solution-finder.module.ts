import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SolutionFinderController } from './solution-finder.controller';
import { SolutionFinderService } from './solution-finder.service';

@Module({
  imports: [AiModule, CatalogModule, OrganizationsModule],
  controllers: [SolutionFinderController],
  providers: [SolutionFinderService],
  exports: [SolutionFinderService],
})
export class SolutionFinderModule {}
