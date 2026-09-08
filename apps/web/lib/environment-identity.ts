export type FrontendEnvironmentIdentity = {
  environment: 'staging';
  gitSha: string;
  provider: 'OPENAI' | 'DETERMINISTIC_LOCAL_V1';
};

type Environment = Readonly<Record<string, string | undefined>>;

export function resolveFrontendEnvironmentIdentity(
  environment: Environment = process.env,
): FrontendEnvironmentIdentity | null {
  if (environment.SST_DEPLOYMENT_ENVIRONMENT?.trim().toLowerCase() !== 'staging') {
    return null;
  }
  const candidateSha =
    environment.VERCEL_GIT_COMMIT_SHA?.trim() || environment.RELEASE_SHA?.trim() || '';
  return {
    environment: 'staging',
    gitSha: /^[0-9a-f]{7,40}$/i.test(candidateSha) ? candidateSha.toLowerCase() : 'unknown',
    provider:
      environment.STAGING_PROVIDER_MODE?.trim().toUpperCase() === 'OPENAI'
        ? 'OPENAI'
        : 'DETERMINISTIC_LOCAL_V1',
  };
}
