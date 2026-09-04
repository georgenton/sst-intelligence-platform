import {
  externalAiAllowedInCurrentEnvironment,
  OPENAI_STAGING_MODEL,
  readOpenAiStagingConfiguration,
} from './openai-staging-policy';

describe('OpenAI controlled staging policy', () => {
  const enabled = {
    SST_DEPLOYMENT_ENVIRONMENT: 'staging',
    CONVERSATIONAL_AI_PROVIDER: 'OPENAI',
    CONVERSATIONAL_AI_EXTERNAL_ENABLED: 'true',
    CONVERSATIONAL_AI_OPENAI_MODEL: OPENAI_STAGING_MODEL,
    CONVERSATIONAL_AI_STAGING_ORGANIZATION_IDS: 'org-a,org-b',
    CONVERSATIONAL_AI_STAGING_USER_IDS: 'user-a,user-b',
    OPENAI_API_KEY: 'configured-test-key',
  };

  it('requires an explicit staging environment and never enables production implicitly', () => {
    expect(readOpenAiStagingConfiguration(enabled)).toMatchObject({
      deploymentEnvironment: 'staging',
      provider: 'OPENAI',
      globallyEnabled: true,
      apiKeyConfigured: true,
      model: OPENAI_STAGING_MODEL,
    });
    expect(externalAiAllowedInCurrentEnvironment(enabled)).toBe(true);
    expect(
      externalAiAllowedInCurrentEnvironment({
        ...enabled,
        SST_DEPLOYMENT_ENVIRONMENT: 'production',
      }),
    ).toBe(false);
    expect(
      readOpenAiStagingConfiguration({
        ...enabled,
        SST_DEPLOYMENT_ENVIRONMENT: undefined,
        NODE_ENV: 'production',
      }).deploymentEnvironment,
    ).toBe('production');
    expect(
      externalAiAllowedInCurrentEnvironment({
        ...enabled,
        RAILWAY_ENVIRONMENT_NAME: 'production',
      }),
    ).toBe(false);
    expect(
      externalAiAllowedInCurrentEnvironment({
        ...enabled,
        VERCEL_ENV: 'production',
      }),
    ).toBe(false);
  });

  it('defaults every missing or misspelled provider control to deterministic local', () => {
    expect(readOpenAiStagingConfiguration({ NODE_ENV: 'test' })).toMatchObject({
      deploymentEnvironment: 'test',
      provider: 'DETERMINISTIC_LOCAL_V1',
      globallyEnabled: false,
      apiKeyConfigured: false,
      model: null,
    });
    expect(
      readOpenAiStagingConfiguration({
        ...enabled,
        CONVERSATIONAL_AI_PROVIDER: 'anthropic',
      }).provider,
    ).toBe('DETERMINISTIC_LOCAL_V1');
  });

  it('parses explicit organization and user cohorts without wildcard behavior', () => {
    const configuration = readOpenAiStagingConfiguration(enabled);
    expect([...configuration.organizationIds]).toEqual(['org-a', 'org-b']);
    expect([...configuration.userIds]).toEqual(['user-a', 'user-b']);
    expect(configuration.organizationIds.has('*')).toBe(false);
    expect(configuration.userIds.has('*')).toBe(false);
  });
});
