import type {
  ConversationActionKey,
  ConversationCitationType,
  ConversationContextType,
  ConversationProviderUseCase,
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
  requestContext: {
    organizationId: string;
    userId: string;
    currentRole: string;
    activeEntitlementKeys: readonly string[];
  };
  authorizedContext: {
    scope: 'ACTIVE_ORGANIZATION';
    contextType: ConversationContextType | null;
    contextReferenceAvailable: boolean;
    dataMinimization: 'REQUIRED_FIELDS_ONLY';
  };
  externalRequest: null | {
    useCase: ConversationProviderUseCase;
    sensitivity: 'LOW';
    canonicalPrompt: string;
    explicitUserSelection: true;
  };
  citations: Array<{
    id: string;
    type: ConversationCitationType;
    label: string;
  }>;
  actionRegistry: {
    actions: readonly ConversationActionKey[];
    tools: ReadonlyArray<{
      actionKey: ConversationActionKey;
      input: Readonly<Record<string, unknown>>;
    }>;
  };
  securityBoundary: {
    userContentUntrusted: true;
    sourceContentUntrusted: true;
    contentCannotModifyPermissions: true;
  };
};

export type ProviderExecution = {
  providerKey: string;
  configIdentifier: string;
  externalProcessing: boolean;
  requestedModel: string | null;
  returnedModel: string | null;
  requestPolicyVersion: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  toolRequests: readonly string[];
  citationValidation: 'PASS' | 'REJECTED' | 'NOT_APPLICABLE';
  errorClass: string | null;
  fallbackUsed: boolean;
};

export type ConversationalProviderResponse = {
  reply: string;
  capability: GenerativeProviderCapability;
  outcome?: 'ANSWERED' | 'INSUFFICIENT_CONTEXT' | 'NOT_AUTHORIZED' | 'PROFESSIONAL_REVIEW_REQUIRED';
  citationIds?: string[];
  requestedAction?: { actionKey: ConversationActionKey; input: Record<string, unknown> };
  execution?: ProviderExecution;
};

export type ConversationalProviderRuntimeStatus = ProviderDescriptor & {
  label: string;
  providerSelection:
    | 'DETERMINISTIC_ENVIRONMENT_POLICY'
    | 'DETERMINISTIC_COHORT_POLICY'
    | 'DETERMINISTIC_KILL_SWITCH'
    | 'CONTROLLED_STAGING_COHORT';
  configuredProvider: 'OPENAI' | 'DETERMINISTIC_LOCAL_V1';
  requestedModel: string | null;
  externalEligible: boolean;
  externalEnabled: boolean;
  killSwitchAvailable: boolean;
  reviewRequired: boolean;
  dataScope: 'LOW_ONLY';
};

export interface ConversationalAssistantProvider {
  readonly descriptor: ProviderDescriptor;
  respond(input: ConversationalProviderInput): Promise<ConversationalProviderResponse>;
  status?(input: {
    organizationId: string;
    userId: string;
  }): Promise<ConversationalProviderRuntimeStatus>;
}
