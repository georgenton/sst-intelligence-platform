export type DeploymentEnvironment = 'local' | 'test' | 'staging' | 'production';

type Environment = Readonly<Record<string, unknown>>;

function normalized(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

export function resolveDeploymentEnvironment(
  environment: Environment = process.env,
): DeploymentEnvironment {
  const railwayEnvironment = normalized(environment.RAILWAY_ENVIRONMENT_NAME);
  const vercelEnvironment = normalized(environment.VERCEL_ENV);
  if (railwayEnvironment === 'production' || vercelEnvironment === 'production') {
    return 'production';
  }

  const explicitEnvironment = normalized(environment.SST_DEPLOYMENT_ENVIRONMENT);
  if (
    explicitEnvironment === 'local' ||
    explicitEnvironment === 'test' ||
    explicitEnvironment === 'staging' ||
    explicitEnvironment === 'production'
  ) {
    return explicitEnvironment;
  }

  const nodeEnvironment = normalized(environment.NODE_ENV);
  if (nodeEnvironment === 'production') return 'production';
  if (nodeEnvironment === 'test') return 'test';
  return 'local';
}

export function resolveSafeReleaseSha(environment: Environment = process.env) {
  for (const key of ['RAILWAY_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_SHA', 'RELEASE_SHA']) {
    const value = environment[key];
    if (typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value.trim())) {
      return value.trim().toLowerCase();
    }
  }
  return 'unknown';
}
