import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const apiDirectory = fileURLToPath(new URL('..', import.meta.url));
const schemaNames = [];
const admin = clientFor(databaseUrl);

function clientFor(url) {
  return new PrismaClient({ datasources: { db: { url } } });
}

function urlForSchema(schema) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

function runPackageScript(script, scopedDatabaseUrl, expectSuccess = true) {
  const result = spawnSync('pnpm', [script], {
    cwd: apiDirectory,
    env: { ...process.env, DATABASE_URL: scopedDatabaseUrl },
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (expectSuccess && result.status !== 0) {
    throw new Error(`${script} failed (${String(result.status)}):\n${output}`);
  }
  if (!expectSuccess && result.status === 0) {
    throw new Error(`${script} unexpectedly succeeded`);
  }
  return output;
}

async function createDisposableSchema(label) {
  const schema = `reference_sync_${label}_${randomUUID().replaceAll('-', '')}`;
  schemaNames.push(schema);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  return { schema, url: urlForSchema(schema), prisma: clientFor(urlForSchema(schema)) };
}

async function dropDisposableSchemas() {
  for (const schema of schemaNames.reverse()) {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}

async function referenceSnapshot(prisma) {
  const [sources, sourceVersions, definitions, versions, links, guidance, contexts] =
    await Promise.all([
      prisma.methodologySource.findMany({ orderBy: { id: 'asc' } }),
      prisma.methodologySourceVersion.findMany({ orderBy: { id: 'asc' } }),
      prisma.riskMethodDefinition.findMany({ orderBy: { id: 'asc' } }),
      prisma.riskMethodVersion.findMany({ orderBy: { id: 'asc' } }),
      prisma.riskMethodSourceLink.findMany({ orderBy: { id: 'asc' } }),
      prisma.riskMethodExpertGuidanceVersion.findMany({ orderBy: { id: 'asc' } }),
      prisma.riskMethodRegulatoryContext.findMany({ orderBy: { id: 'asc' } }),
    ]);
  return { sources, sourceVersions, definitions, versions, links, guidance, contexts };
}

async function existingGlobalReferenceSnapshot(prisma) {
  const [technicalDefinitions, technicalVersions, applicabilityPacks, regulatorySources] =
    await Promise.all([
      prisma.technicalMethodDefinition.findMany({ orderBy: { id: 'asc' } }),
      prisma.technicalMethodVersion.findMany({ orderBy: { id: 'asc' } }),
      prisma.applicabilityRulePackVersion.findMany({ orderBy: { id: 'asc' } }),
      prisma.regulatorySource.findMany({ orderBy: { id: 'asc' } }),
    ]);
  return { technicalDefinitions, technicalVersions, applicabilityPacks, regulatorySources };
}

async function operationalCounts(prisma) {
  const [users, memberships, organizations, workCenters, inspections, findings, actions] =
    await Promise.all([
      prisma.user.count(),
      prisma.membership.count(),
      prisma.organization.count(),
      prisma.workCenter.count(),
      prisma.inspection.count(),
      prisma.inspectionFinding.count(),
      prisma.correctiveAction.count(),
    ]);
  return { users, memberships, organizations, workCenters, inspections, findings, actions };
}

function assertExpectedReferences(snapshot) {
  assert.equal(snapshot.sources.length, 1);
  assert.equal(snapshot.sourceVersions.length, 1);
  assert.equal(snapshot.definitions.length, 3);
  assert.equal(snapshot.versions.length, 3);
  assert.equal(snapshot.links.length, 1);
  assert.equal(snapshot.guidance.length, 1);
  assert.equal(snapshot.contexts.length, 2);

  assert.deepEqual(snapshot.definitions.map(({ methodKey }) => methodKey).sort(), [
    'DEMO_5X5',
    'GTC45_2010',
    'GUIDED_5X5',
  ]);
  const gtc45 = snapshot.versions.find(({ displayName }) => displayName.includes('GTC 45'));
  assert.equal(gtc45?.publicationStatus, 'CANDIDATE');
  assert.equal(gtc45?.technicalReviewStatus, 'PENDING');
  assert.equal(gtc45?.legalReviewStatus, 'PENDING');
  assert.equal(gtc45?.regulatory, false);
  assert.equal(gtc45?.manifest.canonicalSpecification.deficiency[3].numericValue, null);
  assert.equal(snapshot.guidance[0]?.reviewStatus, 'PENDING');
  assert.equal(
    snapshot.contexts.every(
      ({ relationship, legalReviewStatus }) =>
        relationship === 'CONTEXT_NOT_LEGAL_ENDORSEMENT' && legalReviewStatus === 'PENDING',
    ),
    true,
  );
}

async function createHistoricalCustomerFixture(prisma) {
  const historicalMethod = await prisma.riskMethodVersion.findUniqueOrThrow({
    where: { id: '54000000-0000-4000-8000-000000000001' },
  });
  const user = await prisma.user.create({
    data: {
      email: `reference-sync-${randomUUID()}@example.test`,
      displayName: 'Reference sync fixture',
      passwordHash: 'non-authenticating-test-fixture',
    },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Reference sync organization fixture', country: 'Ecuador' },
  });
  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: 'ORG_OWNER' },
  });
  const workCenter = await prisma.workCenter.create({
    data: { organizationId: organization.id, name: 'Reference sync center fixture' },
  });
  const inspection = await prisma.inspection.create({
    data: {
      organizationId: organization.id,
      workCenterId: workCenter.id,
      inspectorUserId: user.id,
      title: 'Historical inspection fixture',
      riskMethodVersionId: historicalMethod.id,
      riskMethodSnapshot: historicalMethod.manifest,
    },
  });
  const finding = await prisma.inspectionFinding.create({
    data: {
      organizationId: organization.id,
      inspectionId: inspection.id,
      workCenterId: workCenter.id,
      category: 'UNSAFE_CONDITION',
      title: 'Historical finding fixture',
      description: 'Synthetic customer-safety fixture for reference synchronization.',
      riskMethodKey: 'DEMO_5X5',
      riskMethodVersion: '1.0.0',
      riskMethodVersionId: historicalMethod.id,
      riskMethodSnapshot: historicalMethod.manifest,
      initialMethodInput: { likelihood: 4, consequence: 3 },
      initialMethodResult: {
        methodKey: 'DEMO_5X5',
        methodVersion: '1.0.0',
        likelihood: 4,
        consequence: 3,
        score: 12,
        level: 'HIGH',
      },
      initialLikelihood: 4,
      initialConsequence: 3,
      initialScore: 12,
      initialRiskLevel: 'HIGH',
      initialResultLabel: 'HIGH',
      residualMethodInput: { likelihood: 2, consequence: 2 },
      residualMethodResult: {
        methodKey: 'DEMO_5X5',
        methodVersion: '1.0.0',
        likelihood: 2,
        consequence: 2,
        score: 4,
        level: 'LOW',
      },
      residualLikelihood: 2,
      residualConsequence: 2,
      residualScore: 4,
      residualRiskLevel: 'LOW',
      residualResultLabel: 'LOW',
      residualRationale: 'Synthetic residual fixture.',
      residualMethodVersionId: historicalMethod.id,
      createdById: user.id,
    },
  });
  return {
    userId: user.id,
    organizationId: organization.id,
    inspectionId: inspection.id,
    findingId: finding.id,
  };
}

async function customerSnapshot(prisma, ids) {
  const [user, membership, organization, workCenter, inspection, finding] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ids.userId } }),
    prisma.membership.findFirstOrThrow({
      where: { userId: ids.userId, organizationId: ids.organizationId },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: ids.organizationId } }),
    prisma.workCenter.findFirstOrThrow({ where: { organizationId: ids.organizationId } }),
    prisma.inspection.findUniqueOrThrow({ where: { id: ids.inspectionId } }),
    prisma.inspectionFinding.findUniqueOrThrow({ where: { id: ids.findingId } }),
  ]);
  return { user, membership, organization, workCenter, inspection, finding };
}

async function verifyReadiness(scopedDatabaseUrl) {
  const port = 42_000 + Math.floor(Math.random() * 5_000);
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: apiDirectory,
    env: { ...process.env, DATABASE_URL: scopedDatabaseUrl, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk.toString()));
  child.stderr.on('data', (chunk) => (output += chunk.toString()));

  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`API exited before readiness:\n${output}`);
      try {
        const response = await globalThis.fetch(`http://127.0.0.1:${port}/api/v1/health`);
        const body = await response.json();
        if (response.status === 200 && body.status === 'ok') return;
      } catch {
        // The process is still starting.
      }
      await delay(125);
    }
    throw new Error(`API readiness timed out:\n${output}`);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    if (child.exitCode === null) await once(child, 'exit');
  }
}

const evidence = {
  freshDatabaseWithoutGeneralSeed: false,
  productionLikeSync: false,
  repeatedSync: false,
  driftProtection: false,
  customerDataUnchanged: false,
  historicalMethodUuidUnchanged: false,
  readiness: false,
};

try {
  const fresh = await createDisposableSchema('fresh');
  try {
    runPackageScript('production:release', fresh.url);
    const firstSnapshot = await referenceSnapshot(fresh.prisma);
    assertExpectedReferences(firstSnapshot);
    const operationalAfterRelease = await operationalCounts(fresh.prisma);
    assert.deepEqual(operationalAfterRelease, {
      users: 0,
      memberships: 0,
      organizations: 0,
      workCenters: 0,
      inspections: 0,
      findings: 0,
      actions: 0,
    });
    evidence.freshDatabaseWithoutGeneralSeed = true;

    await verifyReadiness(fresh.url);
    evidence.readiness = true;

    runPackageScript('reference:sync', fresh.url);
    const secondSnapshot = await referenceSnapshot(fresh.prisma);
    assert.deepEqual(secondSnapshot, firstSnapshot);
    assert.deepEqual(await operationalCounts(fresh.prisma), operationalAfterRelease);
    evidence.repeatedSync = true;
  } finally {
    await fresh.prisma.$disconnect();
  }

  const productionLike = await createDisposableSchema('production_like');
  try {
    runPackageScript('prisma:deploy', productionLike.url);
    const existingGlobalReferences = await existingGlobalReferenceSnapshot(productionLike.prisma);
    const fixtureIds = await createHistoricalCustomerFixture(productionLike.prisma);
    const customerBefore = await customerSnapshot(productionLike.prisma, fixtureIds);
    assert.equal((await referenceSnapshot(productionLike.prisma)).versions.length, 1);

    runPackageScript('reference:sync', productionLike.url);
    const synchronized = await referenceSnapshot(productionLike.prisma);
    assertExpectedReferences(synchronized);
    assert.deepEqual(await customerSnapshot(productionLike.prisma, fixtureIds), customerBefore);
    assert.deepEqual(
      await existingGlobalReferenceSnapshot(productionLike.prisma),
      existingGlobalReferences,
    );
    assert.equal(
      synchronized.versions.find(({ id }) => id === '54000000-0000-4000-8000-000000000001')
        ?.semanticVersion,
      '1.0.0',
    );
    evidence.productionLikeSync = true;
    evidence.customerDataUnchanged = true;
    evidence.historicalMethodUuidUnchanged = true;
  } finally {
    await productionLike.prisma.$disconnect();
  }

  const drift = await createDisposableSchema('drift');
  try {
    runPackageScript('production:release', drift.url);
    await drift.prisma.riskMethodVersion.update({
      where: { id: '54000000-0000-4000-8000-000000000003' },
      data: { displayName: 'Mutated disposable GTC45 reference' },
    });
    const output = runPackageScript('reference:sync', drift.url, false);
    assert.match(output, /RISK_METHOD_REFERENCE_DRIFT:METHOD:GTC45_2010:1\.0\.0/);
    evidence.driftProtection = true;
  } finally {
    await drift.prisma.$disconnect();
  }

  assert.deepEqual(evidence, {
    freshDatabaseWithoutGeneralSeed: true,
    productionLikeSync: true,
    repeatedSync: true,
    driftProtection: true,
    customerDataUnchanged: true,
    historicalMethodUuidUnchanged: true,
    readiness: true,
  });
  globalThis.console.log(JSON.stringify({ status: 'ok', evidence }));
} finally {
  await dropDisposableSchemas();
  await admin.$disconnect();
}
