import { Injectable } from '@nestjs/common';

export const OPENAI_STAGING_MODEL = 'gpt-5.6-terra' as const;
export const OPENAI_STAGING_POLICY_VERSION = 'openai-controlled-staging-low-v1' as const;
export const OPENAI_STAGING_CONFIG_IDENTIFIER = 'openai-terra-medium-low-staging-v1' as const;

type Environment = Readonly<Record<string, string | undefined>>;

export type OpenAiStagingConfiguration = {
  deploymentEnvironment: 'local' | 'test' | 'staging' | 'production';
  provider: 'OPENAI' | 'DETERMINISTIC_LOCAL_V1';
  globallyEnabled: boolean;
  apiKeyConfigured: boolean;
  model: string | null;
  organizationIds: ReadonlySet<string>;
  userIds: ReadonlySet<string>;
};

function csvSet(value: string | undefined) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function readOpenAiStagingConfiguration(
  environment: Environment = process.env,
): OpenAiStagingConfiguration {
  const explicitEnvironment = environment.SST_DEPLOYMENT_ENVIRONMENT?.trim().toLowerCase();
  const platformProduction =
    environment.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase() === 'production' ||
    environment.VERCEL_ENV?.trim().toLowerCase() === 'production';
  const deploymentEnvironment = platformProduction
    ? 'production'
    : explicitEnvironment === 'staging' ||
        explicitEnvironment === 'production' ||
        explicitEnvironment === 'test' ||
        explicitEnvironment === 'local'
      ? explicitEnvironment
      : environment.NODE_ENV === 'production'
        ? 'production'
        : environment.NODE_ENV === 'test'
          ? 'test'
          : 'local';
  return {
    deploymentEnvironment,
    provider:
      environment.CONVERSATIONAL_AI_PROVIDER?.trim().toUpperCase() === 'OPENAI'
        ? 'OPENAI'
        : 'DETERMINISTIC_LOCAL_V1',
    globallyEnabled: environment.CONVERSATIONAL_AI_EXTERNAL_ENABLED === 'true',
    apiKeyConfigured: Boolean(environment.OPENAI_API_KEY?.trim()),
    model: environment.CONVERSATIONAL_AI_OPENAI_MODEL?.trim() || null,
    organizationIds: csvSet(environment.CONVERSATIONAL_AI_STAGING_ORGANIZATION_IDS),
    userIds: csvSet(environment.CONVERSATIONAL_AI_STAGING_USER_IDS),
  };
}

export function externalAiAllowedInCurrentEnvironment(environment: Environment = process.env) {
  return readOpenAiStagingConfiguration(environment).deploymentEnvironment === 'staging';
}

@Injectable()
export class OpenAiStagingPolicy {
  configuration() {
    return readOpenAiStagingConfiguration();
  }

  cohortAllows(organizationId: string, userId: string) {
    const configuration = this.configuration();
    return configuration.organizationIds.has(organizationId) && configuration.userIds.has(userId);
  }

  externalConfigurationAllows(organizationId: string, userId: string) {
    const configuration = this.configuration();
    return (
      configuration.deploymentEnvironment === 'staging' &&
      configuration.provider === 'OPENAI' &&
      configuration.globallyEnabled &&
      configuration.apiKeyConfigured &&
      configuration.model === OPENAI_STAGING_MODEL &&
      configuration.organizationIds.has(organizationId) &&
      configuration.userIds.has(userId)
    );
  }
}
