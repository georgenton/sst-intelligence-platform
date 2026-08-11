import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { EntitlementsModule } from './entitlements.module';

@Module({
  imports: [OrganizationsModule, EntitlementsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [EntitlementsModule],
})
export class CatalogModule {}
