import { buildProviderBakeoffFixture, PROVIDER_GOLDEN_DATASET } from '@sst/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createAnthropicAdapter } from './anthropic';
import { createGoogleAdapter } from './google';
import { createOpenAiAdapter } from './openai';

const evaluationCase = PROVIDER_GOLDEN_DATASET[0]!;
const adapterInput = {
  evaluationCase,
  fixture: buildProviderBakeoffFixture(evaluationCase),
  repetition: 1,
};
const payload = {
  status: evaluationCase.expectedStatus,
  summary: 'Resultado sintético.',
  actionKey: evaluationCase.expectedAction ?? null,
  citationIds: evaluationCase.expectedCitationIds,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('provider request adapters', () => {
  it('uses OpenAI Responses with store=false, equal reasoning and one strict client tool', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        model: 'gpt-5.6-terra-snapshot',
        output: [
          {
            type: 'function_call',
            name: evaluationCase.expectedAction,
            arguments: JSON.stringify(payload),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    );
    const adapter = createOpenAiAdapter({
      apiKey: 'openai-test-secret',
      modelId: 'gpt-5.6-terra',
      configIdentifier: 'openai-terra-medium-v1',
      fetchImplementation,
    });

    await adapter.evaluate(adapterInput);
    const [url, request] = fetchImplementation.mock.calls[0]!;
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(body).toMatchObject({
      model: 'gpt-5.6-terra',
      store: false,
      max_output_tokens: 2_048,
      reasoning: { effort: 'medium' },
      parallel_tool_calls: false,
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body.tools).toEqual([
      expect.objectContaining({
        type: 'function',
        strict: true,
        name: evaluationCase.expectedAction,
      }),
    ]);
  });

  it('uses Anthropic adaptive thinking/effort without incompatible sampling or server tools', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        model: 'claude-sonnet-5-snapshot',
        content: [{ type: 'tool_use', name: evaluationCase.expectedAction, input: payload }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    );
    const adapter = createAnthropicAdapter({
      apiKey: 'anthropic-test-secret',
      modelId: 'claude-sonnet-5',
      configIdentifier: 'anthropic-sonnet5-adaptive-v1',
      fetchImplementation,
    });

    await adapter.evaluate(adapterInput);
    const [url, request] = fetchImplementation.mock.calls[0]!;
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(body).toMatchObject({
      model: 'claude-sonnet-5',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('top_k');
    expect(body.tools).toEqual([
      expect.objectContaining({ strict: true, name: evaluationCase.expectedAction }),
    ]);
  });

  it('uses paid Vertex generateContent with MEDIUM thinking and GA function calling', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        modelVersion: 'gemini-3.8-flash-snapshot',
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: { name: evaluationCase.expectedAction, args: payload },
                },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
      }),
    );
    const adapter = createGoogleAdapter({
      apiKey: 'google-test-secret',
      projectId: 'synthetic-project',
      location: 'global',
      modelId: 'gemini-3.8-flash',
      configIdentifier: 'google-gemini38-medium-v1',
      fetchImplementation,
    });

    await adapter.evaluate(adapterInput);
    const [url, request] = fetchImplementation.mock.calls[0]!;
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(url).toBe(
      'https://aiplatform.googleapis.com/v1/projects/synthetic-project/locations/global/publishers/google/models/gemini-3.8-flash:generateContent',
    );
    expect(body).toMatchObject({
      generationConfig: {
        maxOutputTokens: 2_048,
        thinkingConfig: { thinkingLevel: 'MEDIUM' },
      },
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [evaluationCase.expectedAction],
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain('VALIDATED');
    expect(body.generationConfig).not.toHaveProperty('temperature');
    expect(body.generationConfig).not.toHaveProperty('topP');
    expect(body.generationConfig).not.toHaveProperty('topK');
  });
});
