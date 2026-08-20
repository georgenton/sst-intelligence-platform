import { Module } from '@nestjs/common';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { AdaptiveConfigurationController } from './adaptive-configuration.controller';
import { AdaptiveConfigurationService } from './adaptive-configuration.service';
import { AdaptivePublicationService } from './adaptive-publication.service';
import {
  ADAPTIVE_SESSION_MUTATION_SYNC,
  NoopAdaptiveSessionMutationSync,
} from './adaptive-session-mutation-sync';

@Module({
  controllers: [AdaptiveConfigurationController],
  providers: [
    AdaptiveConfigurationService,
    AdaptivePublicationService,
    NoopAdaptiveSessionMutationSync,
    {
      provide: ADAPTIVE_SESSION_MUTATION_SYNC,
      useExisting: NoopAdaptiveSessionMutationSync,
    },
    OrganizationGuard,
    RolesGuard,
  ],
  exports: [AdaptivePublicationService],
})
export class AdaptiveConfigurationModule {}
