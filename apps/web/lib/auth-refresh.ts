import { apiRequest } from '@sst/api-client';

export type AuthSessionUser = {
  id: string;
  email: string;
  displayName: string;
  memberships?: unknown[];
};

export type AuthRefreshResult = {
  user: AuthSessionUser;
  accessToken: string;
};

export function createAuthRefreshSingleFlight<Result>() {
  let inFlight: Promise<Result> | null = null;

  return {
    run(operation: () => Promise<Result>): Promise<Result> {
      if (inFlight) return inFlight;

      const operationPromise = Promise.resolve().then(operation);
      const shared = operationPromise.finally(() => {
        if (inFlight === shared) inFlight = null;
      });
      inFlight = shared;
      return shared;
    },
    async waitForSettlement(): Promise<void> {
      const pending = inFlight;
      if (!pending) return;
      await pending.then(
        () => undefined,
        () => undefined,
      );
    },
  };
}

export function createAuthSessionGeneration() {
  let current = 0;

  return {
    capture(): number {
      return current;
    },
    advance(): number {
      current += 1;
      return current;
    },
    isCurrent(generation: number): boolean {
      return generation === current;
    },
    commit(generation: number, mutation: () => void): boolean {
      if (generation !== current) return false;
      mutation();
      return true;
    },
  };
}

const browserRefresh = createAuthRefreshSingleFlight<AuthRefreshResult>();

export function refreshBrowserSession(): Promise<AuthRefreshResult> {
  return browserRefresh.run(() =>
    apiRequest<AuthRefreshResult>('/auth/refresh', { method: 'POST' }),
  );
}

export function waitForBrowserRefreshSettlement(): Promise<void> {
  return browserRefresh.waitForSettlement();
}
