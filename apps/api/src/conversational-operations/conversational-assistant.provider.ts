import type {
  ConversationActionKey,
  ConversationCitationType,
  ConversationContextType,
} from '@sst/contracts';

export const CONVERSATIONAL_ASSISTANT_PROVIDER = Symbol('CONVERSATIONAL_ASSISTANT_PROVIDER');

export const GENERATIVE_PROVIDER_CAPABILITIES = [
  'NATURAL_LANGUAGE',
  'SUMMARIZATION',
  'DRAFTING',
  'CLASSIFICATION_SUGGESTION',
] as const;

export const PROHIBITED_PROVIDER_DECISIONS = [
  'FINAL_RISK_DECISION',
  'LEGAL_COMPLIANCE_DECISION',
  'ROOT_CAUSE_DECISION',
] as const;

export type GenerativeProviderCapability = (typeof GENERATIVE_PROVIDER_CAPABILITIES)[number];

export type ProviderDescriptor = {
  providerKey: string;
  configIdentifier: string;
  mode: 'DETERMINISTIC_LOCAL' | 'GENERATIVE';
  externalProcessing: boolean;
  capabilities: readonly GenerativeProviderCapability[];
  finalRiskDecisionAllowed: false;
  legalComplianceDecisionAllowed: false;
  automaticRootCauseAllowed: false;
};

export type ConversationalProviderInput = {
  userIntent: string;
  authorizedContext: {
    scope: 'ACTIVE_ORGANIZATION';
    contextType: ConversationContextType | null;
    contextReferenceAvailable: boolean;
    dataMinimization: 'REQUIRED_FIELDS_ONLY';
  };
  citations: Array<{
    id: string;
    type: ConversationCitationType;
    label: string;
  }>;
  actionRegistry: { actions: readonly ConversationActionKey[] };
  securityBoundary: {
    userContentUntrusted: true;
    sourceContentUntrusted: true;
    contentCannotModifyPermissions: true;
  };
};

export type ConversationalProviderResponse = {
  reply: string;
  capability: GenerativeProviderCapability;
  citationIds?: string[];
  requestedAction?: { actionKey: ConversationActionKey; input: Record<string, unknown> };
};

export interface ConversationalAssistantProvider {
  readonly descriptor: ProviderDescriptor;
  respond(input: ConversationalProviderInput): Promise<ConversationalProviderResponse>;
}
