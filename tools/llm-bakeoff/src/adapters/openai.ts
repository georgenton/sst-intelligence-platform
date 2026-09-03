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

type OpenAiAdapterOptions = {
  apiKey: string;
  modelId: 'gpt-5.6-terra' | 'gpt-5.6-sol';
  configIdentifier: string;
  fetchImplementation?: FetchLike;
};

export function createOpenAiAdapter(options: OpenAiAdapterOptions): BakeoffAdapter {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  return {
    providerKey: 'OPENAI',
    modelId: options.modelId,
    configIdentifier: options.configIdentifier,
    async evaluate(input) {
      const expectedAction = input.evaluationCase.expectedAction;
      const startedAt = performance.now();
      const response = await fetchImplementation('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.modelId,
          store: false,
          max_output_tokens: 2_048,
          reasoning: { effort: 'medium' },
          parallel_tool_calls: false,
          input: [
            { role: 'developer', content: BASE_SYSTEM_INSTRUCTION },
            { role: 'user', content: buildSyntheticInput(input) },
          ],
          ...(expectedAction
            ? {
                tools: [
                  {
                    type: 'function',
                    name: expectedAction,
                    description: 'Devuelve el resultado sintético estructurado sin ejecutar nada.',
                    parameters: RESULT_JSON_SCHEMA,
                    strict: true,
                  },
                ],
                tool_choice: { type: 'function', name: expectedAction },
              }
            : {
                text: {
                  format: {
                    type: 'json_schema',
                    name: 'sst_bakeoff_result',
                    strict: true,
                    schema: RESULT_JSON_SCHEMA,
                  },
                },
              }),
        }),
      });
      const body = await safeJsonResponse(response);
      const output = Array.isArray(body.output) ? body.output : [];
      const functionCall = output.find(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          (item as { type?: unknown }).type === 'function_call',
      );
      const message = output.find(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          (item as { type?: unknown }).type === 'message',
      );
      const content = Array.isArray(message?.content) ? message.content : [];
      const outputText = content.find(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          (item as { type?: unknown }).type === 'output_text',
      );
      const rawText =
        typeof functionCall?.arguments === 'string'
          ? functionCall.arguments
          : typeof outputText?.text === 'string'
            ? outputText.text
            : '';
      const payload = parseJsonText(rawText);
      const usage =
        body.usage && typeof body.usage === 'object'
          ? (body.usage as Record<string, unknown>)
          : undefined;
      const inputTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined;
      const outputTokens =
        typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined;
      const rates = options.modelId === 'gpt-5.6-sol' ? [4, 20] : [2, 12];
      const modelReturned = typeof body.model === 'string' ? body.model : undefined;
      return buildObservation({
        adapterInput: input,
        payload,
        rawText,
        latencyMs: performance.now() - startedAt,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedTokenCost(inputTokens, outputTokens, rates[0]!, rates[1]!),
        httpStatus: response.status,
        providerModelId: modelReturned,
        providerSnapshotId: modelReturned,
        toolCallSchemaValid: expectedAction ? functionCall?.name === expectedAction : undefined,
      });
    },
  };
}
