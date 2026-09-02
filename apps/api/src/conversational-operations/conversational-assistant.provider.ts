import type { ConversationActionKey, ConversationContextType } from '@sst/contracts';

export const CONVERSATIONAL_ASSISTANT_PROVIDER = Symbol('CONVERSATIONAL_ASSISTANT_PROVIDER');

export type ConversationalProviderInput = {
  content: string;
  context: { type: ConversationContextType | null; id: string | null };
};

export type ConversationalProviderResponse = {
  reply: string;
  suggestedReadAction?: { actionKey: ConversationActionKey; input: Record<string, unknown> };
};

export interface ConversationalAssistantProvider {
  readonly providerKey: string;
  respond(input: ConversationalProviderInput): Promise<ConversationalProviderResponse>;
}
