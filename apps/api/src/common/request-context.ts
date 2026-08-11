import type { Request } from 'express';

export type AuthenticatedUser = { id: string; email: string };

export type ApiRequest = Request & {
  id?: string;
  user?: AuthenticatedUser;
  organization?: { id: string; role: string };
};

export function requestMetadata(request: ApiRequest) {
  return {
    requestId: request.id ?? 'unknown',
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
