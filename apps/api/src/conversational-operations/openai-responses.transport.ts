import { Injectable } from '@nestjs/common';

export const OPENAI_RESPONSES_TRANSPORT = Symbol('OPENAI_RESPONSES_TRANSPORT');

export interface OpenAiResponsesTransport {
  create(
    apiKey: string,
    body: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>>;
}

@Injectable()
export class FetchOpenAiResponsesTransport implements OpenAiResponsesTransport {
  async create(apiKey: string, body: Readonly<Record<string, unknown>>, signal: AbortSignal) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('OPENAI_INVALID_JSON');
    }
    return value as Record<string, unknown>;
  }
}
