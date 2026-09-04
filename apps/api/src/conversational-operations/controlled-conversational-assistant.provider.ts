import { Injectable } from '@nestjs/common';
import type {
  ConversationalAssistantProvider,
  ConversationalProviderInput,
  ConversationalProviderResponse,
  ConversationalProviderRuntimeStatus,
  ProviderExecution,
} from './conversational-assistant.provider';
import { ConversationalProviderControlService } from './conversational-provider-control.service';
import { DeterministicConversationalAssistantProvider } from './deterministic-conversational-assistant.provider';
import { GenerativeProviderResponseGuard } from './generative-provider-boundaries';
import {
  OpenAiConversationalAssistantProvider,
  OpenAiProviderError,
} from './openai-conversational-assistant.provider';
import {
  OPENAI_STAGING_MODEL,
  OPENAI_STAGING_POLICY_VERSION,
  OpenAiStagingPolicy,
} from './openai-staging-policy';

@Injectable()
export class ControlledConversationalAssistantProvider implements ConversationalAssistantProvider {
  readonly descriptor;

  constructor(
    private readonly local: DeterministicConversationalAssistantProvider,
    private readonly openai: OpenAiConversationalAssistantProvider,
    private readonly policy: OpenAiStagingPolicy,
    private readonly control: ConversationalProviderControlService,
    private readonly guard: GenerativeProviderResponseGuard,
  ) {
    this.descriptor = {
      ...local.descriptor,
      capabilities: [
        'NATURAL_LANGUAGE',
        'SUMMARIZATION',
        'DRAFTING',
        'CLASSIFICATION_SUGGESTION',
      ] as const,
    };
  }

  async respond(input: ConversationalProviderInput): Promise<ConversationalProviderResponse> {
    if (!input.externalRequest) return this.localResponse(input, null, false);
    if (
      !this.policy.externalConfigurationAllows(
        input.requestContext.organizationId,
        input.requestContext.userId,
      )
    ) {
      return this.localResponse(input, 'OPENAI_STAGING_POLICY_NOT_ELIGIBLE', true);
    }
    if (!(await this.control.externalEnabled(input.requestContext.organizationId))) {
      return this.localResponse(input, 'OPENAI_STAGING_KILL_SWITCH', true);
    }
    let external: ConversationalProviderResponse | null = null;
    try {
      external = await this.openai.respond(input);
      const validated = this.guard.validate(external, input, this.openai);
      return {
        ...validated,
        execution: {
          ...validated.execution!,
          citationValidation: 'PASS',
        },
      };
    } catch (error) {
      const execution =
        error instanceof OpenAiProviderError
          ? error.execution
          : (external?.execution ?? this.openAiFailureExecution('OPENAI_RESPONSE_REJECTED'));
      return this.localResponse(
        input,
        error instanceof OpenAiProviderError ? error.errorClass : 'OPENAI_RESPONSE_REJECTED',
        true,
        {
          ...execution,
          citationValidation: external ? 'REJECTED' : execution.citationValidation,
        },
      );
    }
  }

  async status(input: {
    organizationId: string;
    userId: string;
  }): Promise<ConversationalProviderRuntimeStatus> {
    const configuration = this.policy.configuration();
    const cohortEligible = this.policy.cohortAllows(input.organizationId, input.userId);
    const configured = this.policy.externalConfigurationAllows(input.organizationId, input.userId);
    const switchEnabled = await this.control.externalEnabled(input.organizationId);
    const externalEnabled = configured && switchEnabled;
    if (!externalEnabled) {
      const providerSelection =
        configured && !switchEnabled
          ? 'DETERMINISTIC_KILL_SWITCH'
          : configuration.deploymentEnvironment === 'staging' && !cohortEligible
            ? 'DETERMINISTIC_COHORT_POLICY'
            : 'DETERMINISTIC_ENVIRONMENT_POLICY';
      return {
        ...this.local.descriptor,
        label: 'Procesamiento local controlado · sin IA externa',
        providerSelection,
        configuredProvider: configuration.provider,
        requestedModel: configuration.model,
        externalEligible: configured,
        externalEnabled: false,
        killSwitchAvailable: configured,
        reviewRequired: true,
        dataScope: 'LOW_ONLY',
      };
    }
    return {
      ...this.openai.descriptor,
      label: 'IA generativa en entorno de prueba',
      providerSelection: 'CONTROLLED_STAGING_COHORT',
      configuredProvider: 'OPENAI',
      requestedModel: OPENAI_STAGING_MODEL,
      externalEligible: true,
      externalEnabled: true,
      killSwitchAvailable: true,
      reviewRequired: true,
      dataScope: 'LOW_ONLY',
    };
  }

  private async localResponse(
    input: ConversationalProviderInput,
    errorClass: string | null,
    fallbackUsed: boolean,
    externalAttempt?: ProviderExecution,
  ) {
    const startedAt = performance.now();
    const response = await this.local.respond(input);
    const localExecution: ProviderExecution = {
      providerKey: this.local.descriptor.providerKey,
      configIdentifier: this.local.descriptor.configIdentifier,
      externalProcessing: false,
      requestedModel:
        externalAttempt?.requestedModel ?? (fallbackUsed ? OPENAI_STAGING_MODEL : null),
      returnedModel: externalAttempt?.returnedModel ?? null,
      requestPolicyVersion: OPENAI_STAGING_POLICY_VERSION,
      latencyMs: externalAttempt?.latencyMs ?? Math.round(performance.now() - startedAt),
      inputTokens: externalAttempt?.inputTokens ?? null,
      outputTokens: externalAttempt?.outputTokens ?? null,
      estimatedCostUsd: externalAttempt?.estimatedCostUsd ?? null,
      toolRequests: externalAttempt?.toolRequests ?? [],
      citationValidation: externalAttempt?.citationValidation ?? 'PASS',
      errorClass,
      fallbackUsed,
    };
    return {
      ...response,
      ...(fallbackUsed
        ? {
            reply: `La IA generativa de prueba no está disponible para esta solicitud. ${response.reply}`,
          }
        : {}),
      execution: localExecution,
    };
  }

  private openAiFailureExecution(errorClass: string): ProviderExecution {
    return {
      providerKey: 'OPENAI',
      configIdentifier: 'openai-terra-medium-low-staging-v1',
      externalProcessing: true,
      requestedModel: OPENAI_STAGING_MODEL,
      returnedModel: null,
      requestPolicyVersion: OPENAI_STAGING_POLICY_VERSION,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      toolRequests: [],
      citationValidation: 'NOT_APPLICABLE',
      errorClass,
      fallbackUsed: false,
    };
  }
}
