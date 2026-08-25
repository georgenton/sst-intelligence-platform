import { ApiClientError, apiRequest } from '@sst/api-client';

export const ACCESS_TOKEN_REFRESH_SKEW_MS = 45_000;

const excludedAuthPaths = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

export class AuthSessionChangedError extends Error {
  constructor() {
    super('AUTH_SESSION_CHANGED');
  }
}

export class AuthSessionExpiredError extends Error {
  constructor() {
    super('Tu sesión terminó. Inicia sesión nuevamente para continuar.');
  }
}

type SessionSnapshot = {
  accessToken: string | null;
  generation: number;
};

type RequestContext = {
  accessToken?: string;
  organizationId?: string;
  sessionToken?: string;
};

type AuthenticatedRequestOptions = {
  getSession(): SessionSnapshot;
  refresh(generation: number): Promise<{ accessToken: string }>;
  invalidate(generation: number): Promise<void> | void;
  transport?: typeof apiRequest;
  now?: () => number;
  expirySkewMs?: number;
};

function decodeJwtExpiryMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(atob(`${normalized}${padding}`)) as { exp?: unknown };
    return typeof parsed.exp === 'number' && Number.isFinite(parsed.exp) ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenNearExpiry(
  token: string,
  now = Date.now(),
  skewMs = ACCESS_TOKEN_REFRESH_SKEW_MS,
) {
  const expiresAt = decodeJwtExpiryMs(token);
  return expiresAt !== null && expiresAt <= now + skewMs;
}

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) throw abortError();
}

function waitWithAbort<T>(operation: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return operation;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    void operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function isReplayableBody(body: BodyInit | null | undefined) {
  return body === undefined || body === null || typeof body === 'string';
}

export function createAuthenticatedRequestCoordinator(options: AuthenticatedRequestOptions) {
  const transport = options.transport ?? apiRequest;
  const now = options.now ?? Date.now;
  const expirySkewMs = options.expirySkewMs ?? ACCESS_TOKEN_REFRESH_SKEW_MS;

  async function expireSession(generation: number): Promise<never> {
    await options.invalidate(generation);
    throw new AuthSessionExpiredError();
  }

  async function refreshAccessToken(generation: number, signal?: AbortSignal | null) {
    try {
      const refreshed = await waitWithAbort(options.refresh(generation), signal);
      const current = options.getSession();
      if (current.generation !== generation) throw new AuthSessionChangedError();
      return refreshed.accessToken;
    } catch (error: unknown) {
      if (
        error instanceof AuthSessionChangedError ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw error;
      }
      if (options.getSession().generation !== generation) throw new AuthSessionChangedError();
      return expireSession(generation);
    }
  }

  return async function authenticatedRequest<T>(
    path: string,
    init: RequestInit = {},
    organizationId?: string,
    sessionToken?: string,
  ): Promise<T> {
    if (excludedAuthPaths.has(path)) throw new Error('AUTH_ENDPOINT_COORDINATOR_BYPASS_REQUIRED');
    throwIfAborted(init.signal);

    const initial = options.getSession();
    if (!initial.accessToken) throw new AuthSessionExpiredError();

    let requestToken = initial.accessToken;
    if (isAccessTokenNearExpiry(requestToken, now(), expirySkewMs)) {
      requestToken = await refreshAccessToken(initial.generation, init.signal);
    }

    const context = (accessToken: string): RequestContext => ({
      accessToken,
      organizationId,
      sessionToken,
    });

    try {
      return await transport<T>(path, init, context(requestToken));
    } catch (error: unknown) {
      if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
    }

    throwIfAborted(init.signal);
    if (!isReplayableBody(init.body)) throw new Error('NON_REPLAYABLE_AUTH_REQUEST');

    const current = options.getSession();
    if (current.generation !== initial.generation) throw new AuthSessionChangedError();

    const retryToken =
      current.accessToken && current.accessToken !== requestToken
        ? current.accessToken
        : await refreshAccessToken(initial.generation, init.signal);

    throwIfAborted(init.signal);
    try {
      return await transport<T>(path, init, context(retryToken));
    } catch (error: unknown) {
      if (error instanceof ApiClientError && error.status === 401) {
        return expireSession(initial.generation);
      }
      throw error;
    }
  };
}
