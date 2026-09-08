import { resolveDeploymentEnvironment, resolveSafeReleaseSha } from './deployment-environment';

describe('deployment environment', () => {
  it('treats platform production as authoritative over an explicit staging value', () => {
    expect(
      resolveDeploymentEnvironment({
        NODE_ENV: 'production',
        SST_DEPLOYMENT_ENVIRONMENT: 'staging',
        RAILWAY_ENVIRONMENT_NAME: 'production',
      }),
    ).toBe('production');
    expect(
      resolveDeploymentEnvironment({
        SST_DEPLOYMENT_ENVIRONMENT: 'staging',
        VERCEL_ENV: 'production',
      }),
    ).toBe('production');
  });

  it('allows an explicit staging deployment on a non-production platform environment', () => {
    expect(
      resolveDeploymentEnvironment({
        NODE_ENV: 'production',
        SST_DEPLOYMENT_ENVIRONMENT: 'staging',
        RAILWAY_ENVIRONMENT_NAME: 'staging',
      }),
    ).toBe('staging');
  });

  it('exposes only a validated release SHA', () => {
    expect(resolveSafeReleaseSha({ RAILWAY_GIT_COMMIT_SHA: 'ABCDEF0123456789' })).toBe(
      'abcdef0123456789',
    );
    expect(resolveSafeReleaseSha({ RELEASE_SHA: 'not-a-sha' })).toBe('unknown');
  });
});
