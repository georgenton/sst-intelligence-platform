import type { CookieOptions } from 'express';
import { resolveDeploymentEnvironment } from '../common/deployment-environment';

type Environment = Readonly<Record<string, string | undefined>>;

const COOKIE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function resolveRefreshCookieName(environment: Environment = process.env) {
  const configured = environment.AUTH_REFRESH_COOKIE_NAME?.trim();
  if (configured) {
    if (!COOKIE_NAME_PATTERN.test(configured)) throw new Error('AUTH_REFRESH_COOKIE_NAME_INVALID');
    return configured;
  }
  return resolveDeploymentEnvironment(environment) === 'staging'
    ? 'sst_staging_refresh'
    : 'sst_refresh';
}

export function refreshCookieOptions(environment: Environment = process.env): CookieOptions {
  return {
    httpOnly: true,
    secure: environment.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/api/v1/auth',
  };
}
