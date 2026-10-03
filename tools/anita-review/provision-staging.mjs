import { URL } from 'node:url';

const ORGANIZATION_NAME = 'SST Intelligence — Revisión Anita';
const QUITO = 'Centro Quito — Oficina y coordinación';
const GUAYAQUIL = 'Centro Guayaquil — Zona técnica';
const DEFAULT_IDEMPOTENCY_KEY = '00000000-0000-4000-8000-000000000551';

/**
 * The fixture is intentionally a small explicit guard, not an environment framework.
 * It is exported so a local test or a reviewer can exercise the refusal path without
 * contacting the API.
 */
export function assertStagingOnly(env = process.env) {
  if (env.ANITA_REVIEW_FIXTURE !== 'STAGING_ONLY') {
    throw new Error('ANITA_REVIEW_FIXTURE=STAGING_ONLY is required.');
  }
  const signals = [
    env.NODE_ENV,
    env.VERCEL_ENV,
    env.RAILWAY_ENVIRONMENT_NAME,
    env.SST_DEPLOYMENT_ENVIRONMENT,
    env.DATABASE_ENVIRONMENT,
    env.ANITA_REVIEW_API_ORIGIN,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  if (signals.some((value) => value === 'production' || value.includes('production'))) {
    throw new Error('Refusing the Anita fixture because a production signal was detected.');
  }
  if (!env.ANITA_REVIEW_API_ORIGIN) {
    throw new Error('ANITA_REVIEW_API_ORIGIN is required.');
  }
  const host = new URL(env.ANITA_REVIEW_API_ORIGIN).hostname.toLowerCase();
  if (/(^|[-.])(prod|production)([-.]|$)/.test(host)) {
    throw new Error('Refusing the Anita fixture for a production-looking API host.');
  }
}

function jsonHeaders(token) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
}

async function request(origin, token, route, options = {}) {
  const response = await fetch(`${origin.replace(/\/$/, '')}${route}`, {
    ...options,
    headers: { ...jsonHeaders(token), ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.message === 'string' ? body.message : `HTTP ${response.status}`;
    throw new Error(`${options.method ?? 'GET'} ${route} failed: ${message}`);
  }
  return body;
}

async function login(origin, env) {
  if (env.ANITA_REVIEW_ACCESS_TOKEN) return env.ANITA_REVIEW_ACCESS_TOKEN;
  if (!env.ANITA_REVIEW_EMAIL || !env.ANITA_REVIEW_PASSWORD) {
    throw new Error(
      'Provide ANITA_REVIEW_ACCESS_TOKEN or the synthetic owner email/password through env.',
    );
  }
  const response = await fetch(`${origin.replace(/\/$/, '')}/auth/login`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.ANITA_REVIEW_EMAIL, password: env.ANITA_REVIEW_PASSWORD }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.accessToken !== 'string')
    throw new Error('Synthetic owner login failed.');
  return body.accessToken;
}

async function ensureOrganization(origin, token, env) {
  if (env.ANITA_REVIEW_ORGANIZATION_ID) {
    return request(origin, token, `/organizations/${env.ANITA_REVIEW_ORGANIZATION_ID}`);
  }
  const organizations = await request(origin, token, '/organizations');
  const existing = organizations.find((organization) => organization.name === ORGANIZATION_NAME);
  if (existing) return existing;
  return request(origin, token, '/organizations', {
    method: 'POST',
    headers: { 'Idempotency-Key': env.ANITA_REVIEW_ORG_IDEMPOTENCY_KEY ?? DEFAULT_IDEMPOTENCY_KEY },
    body: JSON.stringify({
      name: ORGANIZATION_NAME,
      country: 'Ecuador',
      sector: 'Servicios técnicos y mantenimiento',
    }),
  });
}

async function ensureCenter(origin, token, organizationId, name, city) {
  const centers = await request(origin, token, `/organizations/${organizationId}/work-centers`);
  const existing = centers.find((center) => center.name === name);
  if (existing) {
    if (existing.city !== city || existing.isActive === false) {
      return request(
        origin,
        token,
        `/organizations/${organizationId}/work-centers/${existing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ city, isActive: true }),
        },
      );
    }
    return existing;
  }
  return request(origin, token, `/organizations/${organizationId}/work-centers`, {
    method: 'POST',
    body: JSON.stringify({ name, city }),
  });
}

async function main() {
  assertStagingOnly();
  const env = process.env;
  const origin = env.ANITA_REVIEW_API_ORIGIN;
  const token = await login(origin, env);
  const organization = await ensureOrganization(origin, token, env);
  const centers = await Promise.all([
    ensureCenter(origin, token, organization.id, QUITO, 'Quito'),
    ensureCenter(origin, token, organization.id, GUAYAQUIL, 'Guayaquil'),
  ]);
  console.log(
    JSON.stringify({
      organization: ORGANIZATION_NAME,
      organizationStatus: organization.status,
      navigationProfile: organization.navigationProfile,
      canonicalCenters: centers.map((center) => center.name),
      note: 'Domain rows are owned by canonical demo primitives; this command never writes queue rows directly.',
    }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Anita staging fixture failed.');
    process.exitCode = 1;
  });
}
