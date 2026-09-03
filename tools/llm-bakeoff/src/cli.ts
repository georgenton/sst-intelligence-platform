import { createAnthropicAdapter, createGoogleAdapter, createOpenAiAdapter } from './adapters';
import { inspectCredentialGate, LLM_BAKEOFF_MODEL_PLAN, type BakeoffEnvironment } from './config';
import { planBakeoff, runBakeoff, type BakeoffAdapter } from './runner';
import type { FetchLike } from './adapters/common';

export type BakeoffCliPayload =
  | {
      mode: 'DRY_RUN';
      gate: ReturnType<typeof inspectCredentialGate>;
      plan: ReturnType<typeof planBakeoff>;
    }
  | {
      mode: 'EXECUTION_BLOCKED';
      gate: ReturnType<typeof inspectCredentialGate>;
      plan: ReturnType<typeof planBakeoff>;
      reason: 'COMPLETE_CREDENTIAL_SET_REQUIRED';
    }
  | {
      mode: 'EXECUTED';
      gate: ReturnType<typeof inspectCredentialGate>;
      result: Omit<Awaited<ReturnType<typeof runBakeoff>>, 'executions'>;
    };

export type BakeoffCliResult = {
  exitCode: number;
  payload: BakeoffCliPayload;
};

function createLiveAdapters(
  environment: BakeoffEnvironment,
  fetchImplementation: FetchLike,
): readonly BakeoffAdapter[] {
  const location = environment.GOOGLE_CLOUD_LOCATION!.trim().toLowerCase() as
    'global' | 'us' | 'eu';
  return [
    createOpenAiAdapter({
      apiKey: environment.OPENAI_API_KEY!,
      modelId: 'gpt-5.6-terra',
      configIdentifier: 'openai-terra-medium-v1',
      fetchImplementation,
    }),
    createOpenAiAdapter({
      apiKey: environment.OPENAI_API_KEY!,
      modelId: 'gpt-5.6-sol',
      configIdentifier: 'openai-sol-medium-v1',
      fetchImplementation,
    }),
    createAnthropicAdapter({
      apiKey: environment.ANTHROPIC_API_KEY!,
      modelId: 'claude-sonnet-5',
      configIdentifier: 'anthropic-sonnet5-adaptive-v1',
      fetchImplementation,
    }),
    createGoogleAdapter({
      apiKey: environment.GOOGLE_API_KEY,
      adcCredentialPath: environment.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: environment.GOOGLE_CLOUD_PROJECT!,
      location,
      modelId: 'gemini-3.8-flash',
      configIdentifier: 'google-gemini38-medium-v1',
      fetchImplementation,
    }),
  ];
}

export async function runCli(
  args: readonly string[],
  environment: BakeoffEnvironment,
  fetchImplementation: FetchLike = globalThis.fetch,
): Promise<BakeoffCliResult> {
  const execute = args.includes('--execute');
  const unknownArguments = args.filter((argument) => argument !== '--execute');
  if (unknownArguments.length) throw new Error('UNSUPPORTED_BAKEOFF_ARGUMENT');

  const gate = inspectCredentialGate(environment);
  const plan = planBakeoff(LLM_BAKEOFF_MODEL_PLAN.map(({ modelId }) => modelId));
  if (!execute) {
    return { exitCode: 0, payload: { mode: 'DRY_RUN', gate, plan } };
  }
  if (!gate.completeSetReady) {
    return {
      exitCode: 2,
      payload: {
        mode: 'EXECUTION_BLOCKED',
        gate,
        plan,
        reason: 'COMPLETE_CREDENTIAL_SET_REQUIRED',
      },
    };
  }

  const completed = await runBakeoff(createLiveAdapters(environment, fetchImplementation));
  const result = {
    casesPerRepetition: completed.casesPerRepetition,
    repetitions: completed.repetitions,
    modelCount: completed.modelCount,
    expectedExecutions: completed.expectedExecutions,
    externalCallsExecuted: completed.externalCallsExecuted,
    models: completed.models,
  };
  return { exitCode: 0, payload: { mode: 'EXECUTED', gate, result } };
}

async function main(): Promise<void> {
  try {
    const result = await runCli(process.argv.slice(2), process.env);
    process.stdout.write(`${JSON.stringify(result.payload, null, 2)}\n`);
    process.exitCode = result.exitCode;
  } catch {
    process.stderr.write('LLM_BAKEOFF_RUNNER_FAILED\n');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
