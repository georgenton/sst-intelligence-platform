import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFrontendEnvironmentIdentity } from '../lib/environment-identity.ts';

test('shows a safe identity only for explicit non-production staging', () => {
  assert.deepEqual(
    resolveFrontendEnvironmentIdentity({
      SST_DEPLOYMENT_ENVIRONMENT: 'staging',
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_SHA: 'ABCDEF0123456789',
      STAGING_PROVIDER_MODE: 'OPENAI',
    }),
    {
      environment: 'staging',
      gitSha: 'abcdef0123456789',
      provider: 'OPENAI',
    },
  );
});

test('a dedicated staging project keeps its identity on a stable Vercel production deployment', () => {
  assert.deepEqual(
    resolveFrontendEnvironmentIdentity({
      SST_DEPLOYMENT_ENVIRONMENT: 'staging',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_SHA: '0123456789abcdef',
      STAGING_PROVIDER_MODE: 'OPENAI',
    }),
    {
      environment: 'staging',
      gitSha: '0123456789abcdef',
      provider: 'OPENAI',
    },
  );
});

test('the production project stays unlabelled without an explicit staging identity', () => {
  assert.equal(resolveFrontendEnvironmentIdentity({ NODE_ENV: 'production' }), null);
});
