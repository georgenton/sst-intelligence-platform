import type { BakeoffAdapter } from '../runner';
import {
  BASE_SYSTEM_INSTRUCTION,
  RESULT_JSON_SCHEMA,
  buildObservation,
  buildSyntheticInput,
  estimatedTokenCost,
  parseJsonText,
  safeJsonResponse,
  type FetchLike,
} from './common';

type AnthropicAdapterOptions = {
  apiKey: string;
  modelId: 'claude-sonnet-5';
  configIdentifier: string;
  fetchImplementation?: FetchLike;
};

export function createAnthropicAdapter(options: AnthropicAdapterOptions): BakeoffAdapter {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  return {
    providerKey: 'ANTHROPIC',
    modelId: options.modelId,
    configIdentifier: options.configIdentifier,
    async evaluate(input) {
      const expectedAction = input.evaluationCase.expectedAction;
      const startedAt = performance.now();
      const response = await fetchImplementation('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.modelId,
          max_tokens: 2_048,
          system: BASE_SYSTEM_INSTRUCTION,
          messages: [{ role: 'user', content: buildSyntheticInput(input) }],
          thinking: { type: 'adaptive' },
          output_config: {
            effort: 'high',
            format: {
              type: 'json_schema',
              schema: RESULT_JSON_SCHEMA,
            },
          },
          ...(expectedAction
            ? {
                tools: [
                  {
                    name: expectedAction,
                    description:
                      'Devuelve el resultado sintético; el cliente no ejecutará la acción.',
                    input_schema: RESULT_JSON_SCHEMA,
                    strict: true,
                  },
                ],
                tool_choice: {
                  type: 'tool',
                  name: expectedAction,
                  disable_parallel_tool_use: true,
                },
              }
            : {}),
        }),
      });
      const body = await safeJsonResponse(response);
      const content = Array.isArray(body.content) ? body.content : [];
      const toolUse = content.find(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          (item as { type?: unknown }).type === 'tool_use',
      );
      const text = content.find(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && (item as { type?: unknown }).type === 'text',
      );
      const payload =
        toolUse?.input ?? (typeof text?.text === 'string' ? parseJsonText(text.text) : null);
      const rawText = JSON.stringify(payload ?? null);
      const usage =
        body.usage && typeof body.usage === 'object'
          ? (body.usage as Record<string, unknown>)
          : undefined;
      const inputTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined;
      const outputTokens =
        typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined;
      const modelReturned = typeof body.model === 'string' ? body.model : undefined;
      return buildObservation({
        adapterInput: input,
        payload,
        rawText,
        latencyMs: performance.now() - startedAt,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedTokenCost(inputTokens, outputTokens, 2, 10),
        httpStatus: response.status,
        providerModelId: modelReturned,
        providerSnapshotId: modelReturned,
        toolCallSchemaValid: expectedAction ? toolUse?.name === expectedAction : undefined,
      });
    },
  };
}
