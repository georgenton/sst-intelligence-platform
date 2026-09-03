import { describe, expect, it } from 'vitest';
import { inspectCredentialGate, LLM_BAKEOFF_MODEL_PLAN } from './config';

describe('LLM bake-off credential gate', () => {
  it('pins exactly four model configurations', () => {
    expect(LLM_BAKEOFF_MODEL_PLAN).toEqual([
      {
        providerKey: 'OPENAI',
        modelId: 'gpt-5.6-terra',
        configIdentifier: 'openai-terra-medium-v1',
      },
      {
        providerKey: 'OPENAI',
        modelId: 'gpt-5.6-sol',
        configIdentifier: 'openai-sol-medium-v1',
      },
      {
        providerKey: 'ANTHROPIC',
        modelId: 'claude-sonnet-5',
        configIdentifier: 'anthropic-sonnet5-adaptive-v1',
      },
      {
        providerKey: 'GOOGLE',
        modelId: 'gemini-3.8-flash',
        configIdentifier: 'google-gemini38-medium-v1',
      },
    ]);
  });

  it('does not treat credential presence as execution authorization', () => {
    const result = inspectCredentialGate({
      OPENAI_API_KEY: 'openai-secret',
      ANTHROPIC_API_KEY: 'anthropic-secret',
      GOOGLE_API_KEY: 'google-secret',
      GOOGLE_CLOUD_PROJECT: 'synthetic-project',
      GOOGLE_CLOUD_LOCATION: 'global',
    });

    expect(result.completeSetReady).toBe(false);
    expect(result.openai).toMatchObject({ credentialPresent: true, explicitlyAuthorized: false });
    expect(result.anthropic).toMatchObject({
      credentialPresent: true,
      explicitlyAuthorized: false,
    });
    expect(result.google).toMatchObject({ credentialPresent: true, explicitlyAuthorized: false });
    expect(JSON.stringify(result)).not.toContain('openai-secret');
    expect(JSON.stringify(result)).not.toContain('anthropic-secret');
    expect(JSON.stringify(result)).not.toContain('google-secret');
  });

  it('opens only when every provider is configured and explicitly authorized', () => {
    expect(
      inspectCredentialGate({
        OPENAI_API_KEY: 'openai-secret',
        OPENAI_TEST_CREDENTIAL_AUTHORIZED: 'yes',
        ANTHROPIC_API_KEY: 'anthropic-secret',
        ANTHROPIC_TEST_CREDENTIAL_AUTHORIZED: 'YES',
        GOOGLE_APPLICATION_CREDENTIALS: '/private/synthetic-adc.json',
        GOOGLE_CLOUD_PROJECT: 'synthetic-project',
        GOOGLE_CLOUD_LOCATION: 'EU',
        GOOGLE_TEST_CREDENTIAL_AUTHORIZED: 'YES',
      }).completeSetReady,
    ).toBe(true);
  });
});
