import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ConversationActionKey,
  ConversationCitationType,
  ConversationContextType,
  ConversationProviderUseCase,
} from '@sst/contracts';
import { adaptiveContentHash } from '@sst/contracts';
import type {
  ConversationalAssistantProvider,
  ConversationalProviderInput,
  ConversationalProviderResponse,
} from './conversational-assistant.provider';

@Injectable()
export class GenerativeProviderContextBuilder {
  build(input: {
    userIntent: string;
    requestContext: ConversationalProviderInput['requestContext'];
    context: { type: ConversationContextType | null; id: string | null };
    citations?: Array<{ id: string; type: ConversationCitationType; label: string }>;
    externalRequest?: {
      useCase: ConversationProviderUseCase;
      canonicalPrompt: string;
    };
    tools?: ReadonlyArray<{
      actionKey: ConversationActionKey;
      input: Readonly<Record<string, unknown>>;
    }>;
  }): ConversationalProviderInput {
    const citations = input.citations ?? [];
    const tools = input.tools ?? [];
    if (new Set(citations.map(({ id }) => id)).size !== citations.length) {
      throw new BadRequestException('El contexto contiene identificadores de cita duplicados.');
    }
    if (new Set(tools.map(({ actionKey }) => actionKey)).size !== tools.length) {
      throw new BadRequestException('El contexto contiene herramientas duplicadas.');
    }
    return {
      userIntent: input.userIntent,
      requestContext: input.requestContext,
      authorizedContext: {
        scope: 'ACTIVE_ORGANIZATION',
        contextType: input.context.type,
        contextReferenceAvailable: Boolean(input.context.id),
        dataMinimization: 'REQUIRED_FIELDS_ONLY',
      },
      externalRequest: input.externalRequest
        ? {
            ...input.externalRequest,
            sensitivity: 'LOW',
            explicitUserSelection: true,
          }
        : null,
      citations,
      actionRegistry: {
        actions: tools.map(({ actionKey }) => actionKey),
        tools: tools.map(({ actionKey, input: toolInput }) => ({
          actionKey,
          input: { ...toolInput },
        })),
      },
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
    if (response.requestedAction) {
      const tool = input.actionRegistry.tools.find(
        ({ actionKey }) => actionKey === response.requestedAction?.actionKey,
      );
      if (
        !tool ||
        adaptiveContentHash(tool.input) !== adaptiveContentHash(response.requestedAction.input)
      ) {
        throw new BadRequestException(
          'El proveedor alteró el contexto estructurado de una acción autorizada.',
        );
      }
    }
    return { ...response, citationIds };
  }
}
