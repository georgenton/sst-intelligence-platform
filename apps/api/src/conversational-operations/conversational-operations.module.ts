import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { InspectionBasisModule } from '../inspection-basis/inspection-basis.module';
import { InspectionsModule } from '../inspections/inspections.module';
import { OperationalExecutionModule } from '../operational-execution/operational-execution.module';
import { PpeModule } from '../ppe/ppe.module';
import { RegulatorySourceModule } from '../regulatory-sources/regulatory-source.module';
import { TrainingModule } from '../training/training.module';
import { WorkPermitsModule } from '../work-permits/work-permits.module';
import { WorkQueueModule } from '../work-queue/work-queue.module';
import { WorkersModule } from '../workers/workers.module';
import { RolesGuard } from '../organizations/roles.guard';
import { CONVERSATIONAL_ASSISTANT_PROVIDER } from './conversational-assistant.provider';
import { ConversationalActionRegistryService } from './conversational-action-registry.service';
import { ConversationalOperationsController } from './conversational-operations.controller';
import { ConversationalOperationsService } from './conversational-operations.service';
import { ConversationalProviderControlService } from './conversational-provider-control.service';
import { ControlledConversationalAssistantProvider } from './controlled-conversational-assistant.provider';
import { DeterministicConversationalAssistantProvider } from './deterministic-conversational-assistant.provider';
import {
  GenerativeProviderContextBuilder,
  GenerativeProviderResponseGuard,
} from './generative-provider-boundaries';
import { OpenAiConversationalAssistantProvider } from './openai-conversational-assistant.provider';
import {
  FetchOpenAiResponsesTransport,
  OPENAI_RESPONSES_TRANSPORT,
} from './openai-responses.transport';
import { OpenAiStagingPolicy } from './openai-staging-policy';

@Module({
  imports: [
    InspectionsModule,
    InspectionBasisModule,
    RegulatorySourceModule,
    WorkersModule,
    IncidentsModule,
    PpeModule,
    TrainingModule,
    WorkPermitsModule,
    OperationalExecutionModule,
    WorkQueueModule,
    AuditModule,
  ],
  controllers: [ConversationalOperationsController],
  providers: [
    ConversationalOperationsService,
    ConversationalActionRegistryService,
    ConversationalProviderControlService,
    DeterministicConversationalAssistantProvider,
    OpenAiConversationalAssistantProvider,
    ControlledConversationalAssistantProvider,
    OpenAiStagingPolicy,
    RolesGuard,
    GenerativeProviderContextBuilder,
    GenerativeProviderResponseGuard,
    FetchOpenAiResponsesTransport,
    {
      provide: OPENAI_RESPONSES_TRANSPORT,
      useExisting: FetchOpenAiResponsesTransport,
    },
    {
      provide: CONVERSATIONAL_ASSISTANT_PROVIDER,
      useExisting: ControlledConversationalAssistantProvider,
    },
  ],
  exports: [CONVERSATIONAL_ASSISTANT_PROVIDER],
})
export class ConversationalOperationsModule {}
