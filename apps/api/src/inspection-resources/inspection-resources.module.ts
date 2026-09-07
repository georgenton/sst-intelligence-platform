import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConversationalProviderControlService } from '../conversational-operations/conversational-provider-control.service';
import {
  FetchOpenAiResponsesTransport,
  OPENAI_RESPONSES_TRANSPORT,
} from '../conversational-operations/openai-responses.transport';
import { OpenAiStagingPolicy } from '../conversational-operations/openai-staging-policy';
import { RolesGuard } from '../organizations/roles.guard';
import { InspectionDraftingProvider } from './inspection-drafting.provider';
import { InspectionResourcesController } from './inspection-resources.controller';
import { InspectionResourcesService } from './inspection-resources.service';

@Module({
  imports: [AuditModule],
  controllers: [InspectionResourcesController],
  providers: [
    InspectionResourcesService,
    InspectionDraftingProvider,
    OpenAiStagingPolicy,
    ConversationalProviderControlService,
    FetchOpenAiResponsesTransport,
    { provide: OPENAI_RESPONSES_TRANSPORT, useExisting: FetchOpenAiResponsesTransport },
    RolesGuard,
  ],
  exports: [InspectionResourcesService],
})
export class InspectionResourcesModule {}
