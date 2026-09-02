import type { ConversationalAssistantProvider } from './conversational-assistant.provider';
import {
  GenerativeProviderContextBuilder,
  GenerativeProviderResponseGuard,
} from './generative-provider-boundaries';

const provider: ConversationalAssistantProvider = {
  descriptor: {
    providerKey: 'TEST_PROVIDER',
    configIdentifier: 'test-config',
    mode: 'GENERATIVE',
    externalProcessing: true,
    capabilities: ['NATURAL_LANGUAGE', 'DRAFTING'],
    finalRiskDecisionAllowed: false,
    legalComplianceDecisionAllowed: false,
    automaticRootCauseAllowed: false,
  },
  respond: async () => ({ reply: 'ok', capability: 'NATURAL_LANGUAGE' }),
};

describe('generative provider boundaries', () => {
  const builder = new GenerativeProviderContextBuilder();
  const guard = new GenerativeProviderResponseGuard();
  const context = builder.build({
    userIntent: 'Resume el registro autorizado.',
    context: { type: 'INCIDENT', id: 'private-canonical-id' },
    citations: [{ id: 'citation-1', type: 'WORK_ITEM', label: 'Trabajo autorizado' }],
    actionKeys: ['get_my_work_queue', 'create_action'],
  });

  it('builds minimized context and marks all supplied content as untrusted', () => {
    expect(context.authorizedContext).toEqual({
      scope: 'ACTIVE_ORGANIZATION',
      contextType: 'INCIDENT',
      contextReferenceAvailable: true,
      dataMinimization: 'REQUIRED_FIELDS_ONLY',
    });
    expect(JSON.stringify(context)).not.toContain('private-canonical-id');
    expect(context.securityBoundary).toEqual({
      userContentUntrusted: true,
      sourceContentUntrusted: true,
      contentCannotModifyPermissions: true,
    });
  });

  it('rejects citations, capabilities and actions outside server-supplied contracts', () => {
    expect(() =>
      guard.validate(
        { reply: 'x', capability: 'NATURAL_LANGUAGE', citationIds: ['unknown'] },
        context,
        provider,
      ),
    ).toThrow('cita fuera del contexto autorizado');
    expect(() =>
      guard.validate(
        {
          reply: 'x',
          capability: 'NATURAL_LANGUAGE',
          requestedAction: {
            actionKey: 'delete_organization' as 'get_my_work_queue',
            input: {},
          },
        },
        context,
        provider,
      ),
    ).toThrow('acción fuera del registro autorizado');
    expect(() =>
      guard.validate({ reply: 'x', capability: 'SUMMARIZATION' }, context, provider),
    ).toThrow('capacidad no autorizada');
  });

  it('allows only supplied citations and finite actions', () => {
    expect(
      guard.validate(
        {
          reply: 'Borrador sujeto a confirmación.',
          capability: 'DRAFTING',
          citationIds: ['citation-1', 'citation-1'],
          requestedAction: { actionKey: 'create_action', input: {} },
        },
        context,
        provider,
      ),
    ).toMatchObject({ citationIds: ['citation-1'] });
  });
});
