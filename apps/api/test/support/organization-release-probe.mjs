import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function organizationBaselineSnapshot(prisma) {
  return {
    plan: await prisma.plan.findUnique({
      where: { key: 'FREE' },
      include: { planFeatures: { orderBy: { featureId: 'asc' } } },
    }),
    core: await prisma.moduleDefinition.findUnique({ where: { key: 'CORE' } }),
  };
}

export async function verifyOrganizationCreationWithoutSeed(origin, prisma) {
  const registration = await globalThis.fetch(`${origin}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Synthetic Release Owner',
      email: `release-${randomUUID()}@example.test`,
      password: randomUUID() + randomUUID(),
    }),
  });
  assert.equal(registration.status, 201);
  const account = await registration.json();
  const key = randomUUID();
  const input = { name: 'Synthetic Release Organization', country: 'Ecuador', sector: 'Servicios' };
  const create = () =>
    globalThis.fetch(`${origin}/api/v1/organizations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${account.accessToken}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(input),
    });
  const first = await create();
  assert.equal(first.status, 201);
  const organization = await first.json();
  const repeated = await create();
  assert.equal(repeated.status, 201);
  assert.equal((await repeated.json()).id, organization.id);
  assert.equal(
    await prisma.organization.count({
      where: { memberships: { some: { userId: account.user.id } } },
    }),
    1,
  );
  const stored = await prisma.organization.findUniqueOrThrow({
    where: { id: organization.id },
    include: {
      memberships: true,
      workCenters: true,
      subscriptions: { include: { plan: true } },
      modules: { include: { module: true } },
    },
  });
  assert.equal(stored.country, input.country);
  assert.equal(stored.sector, input.sector);
  assert.equal(stored.memberships.length, 1);
  assert.equal(stored.memberships[0].role, 'ORG_OWNER');
  assert.equal(stored.workCenters.length, 1);
  assert.deepEqual(
    stored.modules.map(({ module }) => module.key),
    ['CORE'],
  );
  assert.deepEqual(
    stored.subscriptions.map(({ plan }) => plan.key),
    ['FREE'],
  );
  assert.equal(stored.demoStartedAt, null);
  assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id } }), 2);
}
