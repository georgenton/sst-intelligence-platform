import { Module } from '@nestjs/common';
import { OperationalSearchController } from './operational-search.controller';
import { OperationalSearchService } from './operational-search.service';
@Module({ controllers: [OperationalSearchController], providers: [OperationalSearchService] })
export class OperationalSearchModule {}
