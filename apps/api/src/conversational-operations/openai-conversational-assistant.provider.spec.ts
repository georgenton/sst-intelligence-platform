import type { ConversationalProviderInput } from './conversational-assistant.provider';
import { OpenAiConversationalAssistantProvider } from './openai-conversational-assistant.provider';
import type { OpenAiResponsesTransport } from './openai-responses.transport';
import { OpenAiStagingPolicy } from './openai-staging-policy';

describe('OpenAI Responses conversational adapter', () => {
  const originalEnvironment = { ...process.env };
  const create = jest.fn();
  const transport = { create } as unknown as OpenAiResponsesTransport;
  const provider = new OpenAiConversationalAssistantProvider(new OpenAiStagingPolicy(), transport);
  const input: ConversationalProviderInput = {
    userIntent: 'texto libre que no debe salir',
    requestContext: {
      organizationId: 'org-a',
      userId: 'user-a',
      currentRole: 'SST_MANAGER',
      activeEntitlementKeys: ['module.inspections'],
    },
    authorizedContext: {
      scope: 'ACTIVE_ORGANIZATION',
      contextType: 'GLOBAL',
      contextReferenceAvailable: false,
      dataMinimization: 'REQUIRED_FIELDS_ONLY',
    },
    externalRequest: {
      useCase: 'WORK_QUEUE_EXPLANATION',
      sensitivity: 'LOW',
      canonicalPrompt: 'Consulta la cola autorizada.',
      explicitUserSelection: true,
    },
    citations: [{ id: 'opaque-citation-1', type: 'WORK_ITEM', label: 'Etiqueta privada local' }],
    actionRegistry: {
      actions: ['get_my_work_queue'],
      tools: [{ actionKey: 'get_my_work_queue', input: {} }],
    },
    securityBoundary: {
      userContentUntrusted: true,
      sourceContentUntrusted: true,
      contentCannotModifyPermissions: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnvironment,
      CONVERSATIONAL_AI_OPENAI_MODEL: 'gpt-5.6-terra',
      OPENAI_API_KEY: 'test-key-not-a-secret',
    };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('uses Responses API controls and transfers only the canonical LOW payload', async () => {
    create.mockResolvedValue({
      model: 'gpt-5.6-terra-2026-08-01',
      usage: { input_tokens: 100, output_tokens: 25 },
      output: [
        {
          type: 'function_call',
          name: 'get_my_work_queue',
          arguments: '{}',
        },
      ],
    });
    const result = await provider.respond(input);
    expect(result.requestedAction).toEqual({ actionKey: 'get_my_work_queue', input: {} });
    const request = create.mock.calls[0]![1] as Record<string, unknown>;
    expect(request).toMatchObject({
      model: 'gpt-5.6-terra',
      store: false,
      max_output_tokens: 2048,
      reasoning: { effort: 'medium' },
      parallel_tool_calls: false,
    });
    expect(request.tools).toEqual([
      expect.objectContaining({ type: 'function', name: 'get_my_work_queue', strict: true }),
    ]);
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain(input.userIntent);
    expect(serialized).not.toContain('Etiqueta privada local');
    expect(serialized).not.toContain(input.requestContext.organizationId);
    expect(serialized).not.toContain(input.requestContext.userId);
    expect(serialized).toContain('opaque-citation-1');
    expect(serialized).not.toContain('web_search');
    expect(serialized).not.toContain('file_search');
    expect(serialized).not.toContain('computer');
    expect(serialized).not.toContain('code_interpreter');
  });

  it('parses a strict citation-bearing structured response', async () => {
    create.mockResolvedValue({
      model: 'gpt-5.6-terra',
      usage: { input_tokens: 50, output_tokens: 20 },
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                outcome: 'ANSWERED',
                reply: 'Borrador sujeto a revisión humana.',
                capability: 'DRAFTING',
                citationIds: ['opaque-citation-1'],
              }),
            },
          ],
        },
      ],
    });
    const result = await provider.respond({
      ...input,
      externalRequest: {
        ...input.externalRequest!,
        useCase: 'OPERATIONAL_DRAFT',
      },
      actionRegistry: { actions: [], tools: [] },
    });
    expect(result).toMatchObject({
      outcome: 'ANSWERED',
      capability: 'DRAFTING',
      citationIds: ['opaque-citation-1'],
      execution: {
        providerKey: 'OPENAI',
        requestedModel: 'gpt-5.6-terra',
        inputTokens: 50,
        outputTokens: 20,
        fallbackUsed: false,
      },
    });
  });
});
