import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ConversationActionKey,
  ConversationCitationType,
  ConversationContextType,
} from '@sst/contracts';
import type {
  ConversationalAssistantProvider,
  ConversationalProviderInput,
  ConversationalProviderResponse,
} from './conversational-assistant.provider';

@Injectable()
export class GenerativeProviderContextBuilder {
  build(input: {
    userIntent: string;
    context: { type: ConversationContextType | null; id: string | null };
    citations?: Array<{ id: string; type: ConversationCitationType; label: string }>;
    actionKeys: readonly ConversationActionKey[];
  }): ConversationalProviderInput {
    const citations = input.citations ?? [];
    if (new Set(citations.map(({ id }) => id)).size !== citations.length) {
      throw new BadRequestException('El contexto contiene identificadores de cita duplicados.');
    }
    return {
      userIntent: input.userIntent,
      authorizedContext: {
        scope: 'ACTIVE_ORGANIZATION',
        contextType: input.context.type,
        contextReferenceAvailable: Boolean(input.context.id),
        dataMinimization: 'REQUIRED_FIELDS_ONLY',
      },
      citations,
      actionRegistry: { actions: [...input.actionKeys] },
      securityBoundary: {
        userContentUntrusted: true,
        sourceContentUntrusted: true,
        contentCannotModifyPermissions: true,
      },
    };
  }
}

@Injectable()
export class GenerativeProviderResponseGuard {
  validate(
    response: ConversationalProviderResponse,
    input: ConversationalProviderInput,
    provider: ConversationalAssistantProvider,
  ) {
    if (!provider.descriptor.capabilities.includes(response.capability)) {
      throw new BadRequestException('El proveedor declaró una capacidad no autorizada.');
    }
    const suppliedCitationIds = new Set(input.citations.map(({ id }) => id));
    const citationIds = [...new Set(response.citationIds ?? [])];
    if (citationIds.some((id) => !suppliedCitationIds.has(id))) {
      throw new BadRequestException(
        'El proveedor devolvió una cita fuera del contexto autorizado.',
      );
    }
    if (
      response.requestedAction &&
      !input.actionRegistry.actions.includes(response.requestedAction.actionKey)
    ) {
      throw new BadRequestException(
        'El proveedor solicitó una acción fuera del registro autorizado.',
      );
    }
    return { ...response, citationIds };
  }
}
