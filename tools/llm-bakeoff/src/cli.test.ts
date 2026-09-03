import { describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';

const completeEnvironment = {
  OPENAI_API_KEY: 'openai-test-secret',
  OPENAI_TEST_CREDENTIAL_AUTHORIZED: 'YES',
  ANTHROPIC_API_KEY: 'anthropic-test-secret',
  ANTHROPIC_TEST_CREDENTIAL_AUTHORIZED: 'YES',
  GOOGLE_API_KEY: 'google-test-secret',
  GOOGLE_CLOUD_PROJECT: 'synthetic-project',
  GOOGLE_CLOUD_LOCATION: 'global',
  GOOGLE_TEST_CREDENTIAL_AUTHORIZED: 'YES',
} as const;

describe('LLM bake-off CLI', () => {
  it('defaults to a 240-execution dry run even when every credential exists', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const result = await runCli([], completeEnvironment, fetchImplementation);

    expect(result.exitCode).toBe(0);
    expect(result.payload.mode).toBe('DRY_RUN');
    if (result.payload.mode !== 'DRY_RUN') throw new Error('Expected dry run');
    expect(result.payload.plan.expectedExecutions).toBe(240);
    expect(result.payload.plan.goldenCases).toBe(12);
    expect(result.payload.plan.securityCases).toBe(8);
    expect(result.payload.plan.repetitions).toBe(3);
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('openai-test-secret');
    expect(JSON.stringify(result)).not.toContain('anthropic-test-secret');
    expect(JSON.stringify(result)).not.toContain('google-test-secret');
  });

  it('blocks --execute before adapter construction when one provider is incomplete', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const result = await runCli(
      ['--execute'],
      { ...completeEnvironment, ANTHROPIC_TEST_CREDENTIAL_AUTHORIZED: undefined },
      fetchImplementation,
    );

    expect(result.exitCode).toBe(2);
    expect(result.payload.mode).toBe('EXECUTION_BLOCKED');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
