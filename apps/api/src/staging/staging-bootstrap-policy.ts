import { resolveDeploymentEnvironment } from '../common/deployment-environment';

type Environment = Readonly<Record<string, string | undefined>>;

export function assertStagingBootstrapAllowed(environment: Environment = process.env) {
  if (
    environment.APP_ENV?.trim().toLowerCase() !== 'staging' ||
    resolveDeploymentEnvironment(environment) !== 'staging'
  ) {
    throw new Error('STAGING_BOOTSTRAP_FORBIDDEN_OUTSIDE_STAGING');
  }
}

export function requireStagingBootstrapPassword(environment: Environment = process.env) {
  const password = environment.STAGING_BOOTSTRAP_PASSWORD?.trim();
  if (!password || password.length < 16) {
    throw new Error('STAGING_BOOTSTRAP_PASSWORD_REQUIRED');
  }
  return password;
}
