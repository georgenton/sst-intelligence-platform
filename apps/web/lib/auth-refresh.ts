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

type LogoutServerInvalidationOptions = {
  capturedRefreshSettlement: Promise<void> | null;
  isCurrentGeneration: () => boolean;
  requestLogout: () => Promise<unknown>;
};

function invokeBestEffort(operation: () => Promise<unknown>): Promise<void> {
  try {
    return operation().then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

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
    currentSettlement(): Promise<void> | null {
      const pending = inFlight;
      if (!pending) return null;
      return pending.then(
        () => undefined,
        () => undefined,
      );
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

export function startLogoutServerInvalidation({
  capturedRefreshSettlement,
  isCurrentGeneration,
  requestLogout,
}: LogoutServerInvalidationOptions): Promise<void> {
  const firstLogout = invokeBestEffort(requestLogout);

  if (capturedRefreshSettlement) {
    void capturedRefreshSettlement.then(() => {
      if (!isCurrentGeneration()) return;
      void invokeBestEffort(requestLogout);
    });
  }

  return firstLogout;
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

export function captureBrowserRefreshSettlement(): Promise<void> | null {
  return browserRefresh.currentSettlement();
}
