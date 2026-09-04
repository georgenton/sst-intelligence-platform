import {
  assertStagingBootstrapAllowed,
  requireStagingBootstrapPassword,
} from './staging-bootstrap-policy';

describe('staging synthetic bootstrap policy', () => {
  const staging = {
    APP_ENV: 'staging',
    SST_DEPLOYMENT_ENVIRONMENT: 'staging',
    RAILWAY_ENVIRONMENT_NAME: 'staging',
  };

  it('requires both explicit application and deployment staging identities', () => {
    expect(() => assertStagingBootstrapAllowed(staging)).not.toThrow();
    expect(() => assertStagingBootstrapAllowed({ ...staging, APP_ENV: 'production' })).toThrow(
      'STAGING_BOOTSTRAP_FORBIDDEN_OUTSIDE_STAGING',
    );
    expect(() =>
      assertStagingBootstrapAllowed({ ...staging, RAILWAY_ENVIRONMENT_NAME: 'production' }),
    ).toThrow('STAGING_BOOTSTRAP_FORBIDDEN_OUTSIDE_STAGING');
    expect(() => assertStagingBootstrapAllowed({})).toThrow(
      'STAGING_BOOTSTRAP_FORBIDDEN_OUTSIDE_STAGING',
    );
  });

  it('requires a non-trivial password without exposing it', () => {
    expect(() => requireStagingBootstrapPassword(staging)).toThrow(
      'STAGING_BOOTSTRAP_PASSWORD_REQUIRED',
    );
    expect(
      requireStagingBootstrapPassword({
        ...staging,
        STAGING_BOOTSTRAP_PASSWORD: 'synthetic-password-123',
      }),
    ).toBe('synthetic-password-123');
  });
});
