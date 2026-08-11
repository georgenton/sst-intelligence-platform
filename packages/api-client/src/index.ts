export type ApiError = { code: string; message: string; details: unknown; traceId: string };

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiError,
  ) {
    super(payload.message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  context: { accessToken?: string; organizationId?: string; sessionToken?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (context.accessToken) headers.set('authorization', `Bearer ${context.accessToken}`);
  if (context.organizationId) headers.set('x-organization-id', context.organizationId);
  if (context.sessionToken) headers.set('x-session-token', context.sessionToken);
  const response = await fetch(`/api/v1${path}`, { ...init, headers, credentials: 'include' });
  const payload = (await response.json()) as T | ApiError;
  if (!response.ok) throw new ApiClientError(response.status, payload as ApiError);
  return payload as T;
}
