import { Module } from '@nestjs/common';
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
import { CONVERSATIONAL_ASSISTANT_PROVIDER } from './conversational-assistant.provider';
import { ConversationalActionRegistryService } from './conversational-action-registry.service';
import { ConversationalOperationsController } from './conversational-operations.controller';
import { ConversationalOperationsService } from './conversational-operations.service';
import { DeterministicConversationalAssistantProvider } from './deterministic-conversational-assistant.provider';

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
  ],
  controllers: [ConversationalOperationsController],
  providers: [
    ConversationalOperationsService,
    ConversationalActionRegistryService,
    DeterministicConversationalAssistantProvider,
    {
      provide: CONVERSATIONAL_ASSISTANT_PROVIDER,
      useExisting: DeterministicConversationalAssistantProvider,
    },
  ],
})
export class ConversationalOperationsModule {}
