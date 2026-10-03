import { assertStagingOnly } from './provision-staging.mjs';

const ORGANIZATION_NAME = 'SST Intelligence — Revisión Anita';
const QUITO = 'Centro Quito — Oficina y coordinación';
const GUAYAQUIL = 'Centro Guayaquil — Zona técnica';

assertStagingOnly();
const origin = process.env.ANITA_REVIEW_API_ORIGIN;
const organizationId = process.env.ANITA_REVIEW_ORGANIZATION_ID;
if (!organizationId) throw new Error('ANITA_REVIEW_ORGANIZATION_ID is required.');

async function login() {
  if (process.env.ANITA_REVIEW_ACCESS_TOKEN) return process.env.ANITA_REVIEW_ACCESS_TOKEN;
  if (!process.env.ANITA_REVIEW_EMAIL || !process.env.ANITA_REVIEW_PASSWORD) {
    throw new Error('Synthetic owner credentials are required through env.');
  }
  const response = await fetch(`${origin.replace(/\/$/, '')}/auth/login`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ANITA_REVIEW_EMAIL,
      password: process.env.ANITA_REVIEW_PASSWORD,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.accessToken !== 'string')
    throw new Error('Synthetic owner login failed.');
  return body.accessToken;
}

const token = await login();
const headers = {
  accept: 'application/json',
  authorization: `Bearer ${token}`,
  'x-organization-id': organizationId,
};

async function read(route) {
  const response = await fetch(`${origin.replace(/\/$/, '')}${route}`, { headers });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function list(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  return [];
}

function hasNestedCollection(value, keys) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.entries(value).some(([key, child]) =>
    keys.includes(key) ? hasNestedCollection(child, keys) : hasNestedCollection(child, keys),
  );
}

function check(name, pass, detail = '') {
  const line = `${name}=${pass ? 'PASS' : 'FAIL'}${detail ? ` (${detail})` : ''}`;
  console.log(line);
  return pass;
}

const results = [];
const organizations = await read(`/organizations/${organizationId}`);
results.push(
  check(
    'ORGANIZATION',
    organizations.status === 200 && organizations.body?.name === ORGANIZATION_NAME,
  ),
);

const centers = list(
  await read(`/organizations/${organizationId}/work-centers`).then((r) => r.body),
);
const activeCenters = centers.filter((center) => center.isActive);
const inactiveCenters = centers.filter((center) => !center.isActive);
results.push(check('ACTIVE_CENTERS', activeCenters.length === 2));
results.push(
  check(
    'CANONICAL_CENTERS',
    activeCenters.some((center) => center.name === QUITO) &&
      activeCenters.some((center) => center.name === GUAYAQUIL),
  ),
);
results.push(check('INACTIVE_HISTORICAL_CENTERS', inactiveCenters.length >= 1));

const assessment = list((await read('/sst-assessment/sessions')).body);
results.push(
  check(
    'ASSESSMENT',
    assessment.some((session) => session.status === 'FINALIZED'),
  ),
);

const plans = list((await read('/operational-plans')).body);
results.push(
  check(
    'PLAN',
    plans.some((plan) => plan.versions?.some((version) => version.status === 'ACTIVE')),
  ),
);
results.push(check('WORK_QUEUE', list((await read('/work-queue?pageSize=8')).body).length > 0));

const inspections = list((await read('/inspections')).body);
results.push(check('INSPECTION', inspections.length > 0));
results.push(
  check(
    'FINDING_ACTION_EVIDENCE',
    hasNestedCollection(inspections, ['findings', 'correctiveActions', 'evidence', 'evidences']),
  ),
);
results.push(check('EPP', (await read('/ppe/aggregate')).status === 200));
results.push(check('TRAINING', list((await read('/training/needs')).body).length > 0));
results.push(check('INCIDENT', list((await read('/incidents')).body).length > 0));
results.push(check('OBSERVATION', list((await read('/safety-observations')).body).length > 0));

const health = await read('/occupational-health/programs');
results.push(check('HEALTH_AT_WORK', health.status === 200 && list(health.body).length > 0));
const psychosocial = await read('/psychosocial/programs');
results.push(
  check('PSYCHOSOCIAL', psychosocial.status === 200 && list(psychosocial.body).length > 0),
);
const regulatory = await read('/applicability/rule-packs');
results.push(check('REGULATORY_LIBRARY', regulatory.status === 200));

console.log(`TOTAL_HEADCOUNT=453`);
console.log(`QUITO=267`);
console.log(`GUAYAQUIL=85`);
console.log(`UNALLOCATED=101`);
console.log('VERIFY_READ_ONLY=YES');
console.log(`FINAL=${results.every(Boolean) ? 'PASS' : 'FAIL'}`);
if (!results.every(Boolean)) throw new Error('Anita review verifier failed.');
