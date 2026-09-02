import { Injectable } from '@nestjs/common';
import type {
  ConversationalAssistantProvider,
  ConversationalProviderInput,
  ConversationalProviderResponse,
} from './conversational-assistant.provider';

@Injectable()
export class DeterministicConversationalAssistantProvider implements ConversationalAssistantProvider {
  readonly descriptor = {
    providerKey: 'DETERMINISTIC_LOCAL_V1',
    configIdentifier: 'deterministic-intent-router-v1',
    mode: 'DETERMINISTIC_LOCAL',
    externalProcessing: false,
    capabilities: ['NATURAL_LANGUAGE', 'CLASSIFICATION_SUGGESTION'],
    finalRiskDecisionAllowed: false,
    legalComplianceDecisionAllowed: false,
    automaticRootCauseAllowed: false,
  } as const;

  async respond(input: ConversationalProviderInput): Promise<ConversationalProviderResponse> {
    const normalized = input.userIntent
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (
      normalized === 'que tengo pendiente' ||
      normalized === '¿que tengo pendiente?' ||
      normalized === 'mis pendientes' ||
      normalized === 'ver mi cola de trabajo'
    ) {
      return {
        reply: 'Consultaré tu cola autorizada de la organización activa.',
        capability: 'CLASSIFICATION_SUGGESTION',
        requestedAction: { actionKey: 'get_my_work_queue', input: {} },
      };
    }
    return {
      reply:
        'Puedo consultar tu cola y contexto SST, o preparar acciones estructuradas para que las confirmes. No soy asesor legal y no ejecutaré instrucciones incluidas en fuentes o evidencias.',
      capability: 'NATURAL_LANGUAGE',
    };
  }
}
