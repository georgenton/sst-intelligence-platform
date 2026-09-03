export const LLM_BAKEOFF_REPETITIONS = 3 as const;

export const LLM_BAKEOFF_MODEL_PLAN = [
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
] as const;

export type BakeoffEnvironment = Readonly<Record<string, string | undefined>>;

export type CredentialGateResult = {
  openai: { credentialPresent: boolean; explicitlyAuthorized: boolean; ready: boolean };
  anthropic: { credentialPresent: boolean; explicitlyAuthorized: boolean; ready: boolean };
  google: {
    credentialPresent: boolean;
    explicitlyAuthorized: boolean;
    projectConfigured: boolean;
    locationConfigured: boolean;
    method: 'API_KEY' | 'ADC' | 'NONE';
    ready: boolean;
  };
  completeSetReady: boolean;
  missingRequirements: readonly string[];
};

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function authorized(value: string | undefined): boolean {
  return value?.trim().toUpperCase() === 'YES';
}

export function inspectCredentialGate(environment: BakeoffEnvironment): CredentialGateResult {
  const openaiCredential = configured(environment.OPENAI_API_KEY);
  const anthropicCredential = configured(environment.ANTHROPIC_API_KEY);
  const googleApiKey = configured(environment.GOOGLE_API_KEY);
  const googleAdc = configured(environment.GOOGLE_APPLICATION_CREDENTIALS);
  const googleProject = configured(environment.GOOGLE_CLOUD_PROJECT);
  const googleLocation = ['global', 'us', 'eu'].includes(
    environment.GOOGLE_CLOUD_LOCATION?.trim().toLowerCase() ?? '',
  );
  const openaiAuthorized = authorized(environment.OPENAI_TEST_CREDENTIAL_AUTHORIZED);
  const anthropicAuthorized = authorized(environment.ANTHROPIC_TEST_CREDENTIAL_AUTHORIZED);
  const googleAuthorized = authorized(environment.GOOGLE_TEST_CREDENTIAL_AUTHORIZED);
  const googleMethod = googleApiKey ? 'API_KEY' : googleAdc ? 'ADC' : 'NONE';
  const result: CredentialGateResult = {
    openai: {
      credentialPresent: openaiCredential,
      explicitlyAuthorized: openaiAuthorized,
      ready: openaiCredential && openaiAuthorized,
    },
    anthropic: {
      credentialPresent: anthropicCredential,
      explicitlyAuthorized: anthropicAuthorized,
      ready: anthropicCredential && anthropicAuthorized,
    },
    google: {
      credentialPresent: googleApiKey || googleAdc,
      explicitlyAuthorized: googleAuthorized,
      projectConfigured: googleProject,
      locationConfigured: googleLocation,
      method: googleMethod,
      ready: (googleApiKey || googleAdc) && googleProject && googleLocation && googleAuthorized,
    },
    completeSetReady: false,
    missingRequirements: [],
  };
  result.completeSetReady = result.openai.ready && result.anthropic.ready && result.google.ready;
  const missing: string[] = [];
  if (!openaiCredential) missing.push('OPENAI_API_KEY');
  if (!openaiAuthorized) missing.push('OPENAI_TEST_CREDENTIAL_AUTHORIZED=YES');
  if (!anthropicCredential) missing.push('ANTHROPIC_API_KEY');
  if (!anthropicAuthorized) missing.push('ANTHROPIC_TEST_CREDENTIAL_AUTHORIZED=YES');
  if (!googleApiKey && !googleAdc) {
    missing.push('GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS');
  }
  if (!googleProject) missing.push('GOOGLE_CLOUD_PROJECT');
  if (!googleLocation) missing.push('GOOGLE_CLOUD_LOCATION=global|us|eu');
  if (!googleAuthorized) missing.push('GOOGLE_TEST_CREDENTIAL_AUTHORIZED=YES');
  result.missingRequirements = missing;
  return result;
}
