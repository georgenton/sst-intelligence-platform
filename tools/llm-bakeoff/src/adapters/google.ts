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
import { resolveGoogleAdcAccessToken } from './google-auth';

type GoogleAdapterOptions = {
  apiKey?: string;
  adcCredentialPath?: string;
  projectId: string;
  location: 'global' | 'us' | 'eu';
  modelId: 'gemini-3.8-flash';
  configIdentifier: string;
  fetchImplementation?: FetchLike;
};

function endpoint(options: GoogleAdapterOptions): string {
  const host =
    options.location === 'global'
      ? 'aiplatform.googleapis.com'
      : `${options.location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${encodeURIComponent(options.projectId)}/locations/${options.location}/publishers/google/models/${options.modelId}:generateContent`;
}

export function createGoogleAdapter(options: GoogleAdapterOptions): BakeoffAdapter {
  if (!options.apiKey && !options.adcCredentialPath) {
    throw new Error('GOOGLE_CREDENTIAL_REQUIRED');
  }
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  return {
    providerKey: 'GOOGLE',
    modelId: options.modelId,
    configIdentifier: options.configIdentifier,
    async evaluate(input) {
      const expectedAction = input.evaluationCase.expectedAction;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (options.apiKey) {
        headers['X-Goog-Api-Key'] = options.apiKey;
      } else {
        const accessToken = await resolveGoogleAdcAccessToken(
          options.adcCredentialPath!,
          fetchImplementation,
        );
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const startedAt = performance.now();
      const response = await fetchImplementation(endpoint(options), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: BASE_SYSTEM_INSTRUCTION }] },
          contents: [{ role: 'user', parts: [{ text: buildSyntheticInput(input) }] }],
          generationConfig: {
            maxOutputTokens: 2_048,
            thinkingConfig: { thinkingLevel: 'MEDIUM' },
            responseMimeType: 'application/json',
            responseJsonSchema: RESULT_JSON_SCHEMA,
          },
          ...(expectedAction
            ? {
                tools: [
                  {
                    functionDeclarations: [
                      {
                        name: expectedAction,
                        description:
                          'Devuelve el resultado sintético; el cliente no ejecutará la acción.',
                        parameters: RESULT_JSON_SCHEMA,
                      },
                    ],
                  },
                ],
                toolConfig: {
                  functionCallingConfig: {
                    mode: 'ANY',
                    allowedFunctionNames: [expectedAction],
                  },
                },
              }
            : {
                toolConfig: { functionCallingConfig: { mode: 'NONE' } },
              }),
        }),
      });
      const body = await safeJsonResponse(response);
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      const first = candidates[0];
      const candidate =
        first && typeof first === 'object' ? (first as Record<string, unknown>) : {};
      const content =
        candidate.content && typeof candidate.content === 'object'
          ? (candidate.content as Record<string, unknown>)
          : {};
      const parts = Array.isArray(content.parts) ? content.parts : [];
      const functionPart = parts.find(
        (part): part is Record<string, unknown> =>
          Boolean(part) && typeof part === 'object' && 'functionCall' in part,
      );
      const textPart = parts.find(
        (part): part is Record<string, unknown> =>
          Boolean(part) &&
          typeof part === 'object' &&
          typeof (part as { text?: unknown }).text === 'string',
      );
      const functionCall =
        functionPart?.functionCall && typeof functionPart.functionCall === 'object'
          ? (functionPart.functionCall as Record<string, unknown>)
          : undefined;
      const payload =
        functionCall?.args ??
        (typeof textPart?.text === 'string' ? parseJsonText(textPart.text) : null);
      const rawText = JSON.stringify(payload ?? null);
      const usage =
        body.usageMetadata && typeof body.usageMetadata === 'object'
          ? (body.usageMetadata as Record<string, unknown>)
          : undefined;
      const inputTokens =
        typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : undefined;
      const outputTokens =
        typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : undefined;
      const modelReturned =
        typeof body.modelVersion === 'string' ? body.modelVersion : options.modelId;
      return buildObservation({
        adapterInput: input,
        payload,
        rawText,
        latencyMs: performance.now() - startedAt,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedTokenCost(inputTokens, outputTokens, 0.75, 3.75),
        httpStatus: response.status,
        providerModelId: options.modelId,
        providerSnapshotId: modelReturned,
        toolCallSchemaValid: expectedAction ? functionCall?.name === expectedAction : undefined,
      });
    },
  };
}
