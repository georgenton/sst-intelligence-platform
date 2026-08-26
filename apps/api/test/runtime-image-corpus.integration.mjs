import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const image = process.env.RUNTIME_IMAGE_TAG ?? 'sst-api-regulatory:runtime-corpus-test';
const dockerNetwork = process.env.RUNTIME_IMAGE_DOCKER_NETWORK;
const schemaNames = [];
const apiContainers = [];
const admin = clientFor(databaseUrl);

function clientFor(url) {
  return new PrismaClient({ datasources: { db: { url } } });
}

function run(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, {
    cwd: repositoryRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${command} unexpectedly succeeded`);
    return output;
  }
  if (result.status !== 0)
    throw new Error(`${command} failed (${String(result.status)}):\n${output}`);
  return output.trim();
}

function urlForSchema(schema) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

function containerUrl(scopedUrl) {
  if (process.env.RUNTIME_IMAGE_DATABASE_URL) {
    const url = new URL(process.env.RUNTIME_IMAGE_DATABASE_URL);
    url.searchParams.set('schema', new URL(scopedUrl).searchParams.get('schema') ?? 'public');
    return url.toString();
  }
  const url = new URL(scopedUrl);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    url.hostname = 'host.docker.internal';
  return url.toString();
}

function dockerRuntimeArguments(scopedUrl) {
  const argumentsList = ['run', '--rm'];
  if (dockerNetwork) argumentsList.push('--network', dockerNetwork);
  else argumentsList.push('--add-host', 'host.docker.internal:host-gateway');
  argumentsList.push(
    '-e',
    `DATABASE_URL=${containerUrl(scopedUrl)}`,
    '-e',
    'JWT_ACCESS_SECRET=runtime-image-test-only-secret-with-32-characters',
    '-e',
    'WEB_ORIGIN=http://localhost:3000',
    '-e',
    'API_ORIGIN=http://localhost:3001',
    '-e',
    'COOKIE_SECURE=true',
    '-e',
    'AI_ENABLED=false',
    '-e',
    'AI_PROVIDER=template',
  );
  return argumentsList;
}

function runImage(scopedUrl, command, options = {}) {
  return run('docker', [...dockerRuntimeArguments(scopedUrl), image, ...command], options);
}

async function createSchema(label) {
  const schema = `runtime_image_${label}_${randomUUID().replaceAll('-', '')}`;
  schemaNames.push(schema);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const url = urlForSchema(schema);
  return { url, prisma: clientFor(url) };
}

function filesBelow(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? filesBelow(`${directory}/${entry.name}`, relative) : [relative];
  });
}

function inspectRuntimeCorpus() {
  const script = `
    const { readdirSync } = require('node:fs');
    const paths = require('./apps/api/dist/reference-data/regulatory-resource-path.js');
    function filesBelow(directory, prefix = '') {
      return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix ? prefix + '/' + entry.name : entry.name;
        return entry.isDirectory()
          ? filesBelow(directory + '/' + entry.name, relative)
          : [relative];
      });
    }
    paths.assertRegulatoryRuntimeResources();
    process.stdout.write(JSON.stringify({ root: paths.REGULATORY_RESOURCE_ROOT, files: filesBelow(paths.REGULATORY_RESOURCE_ROOT).sort() }));
  `;
  const output = run('docker', ['run', '--rm', image, 'node', '-e', script], { capture: true });
  const inspected = JSON.parse(output);
  const sourceFiles = filesBelow(`${repositoryRoot}/regulatory`).sort();
  assert.equal(inspected.root, '/app/regulatory');
  assert.deepEqual(inspected.files, sourceFiles);
  assert.equal(inspected.files.length, 35);
  assert.equal(
    inspected.files.some((file) => /\.pdf$/i.test(file)),
    false,
  );
  assert.equal(
    inspected.files.some((file) => /gtc.?45/i.test(file)),
    false,
  );
  return inspected;
}

async function referenceSnapshot(prisma) {
  const [
    sources,
    sourceVersions,
    units,
    provisions,
    provisionUnits,
    requirements,
    requirementSources,
    ruleDrafts,
    ruleDraftRequirements,
    regulatoryRuleVersions,
    relationships,
  ] = await Promise.all([
    prisma.regulatorySource.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatorySourceVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryUnit.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryProvision.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryProvisionUnit.findMany({
      orderBy: [{ provisionId: 'asc' }, { unitId: 'asc' }],
    }),
    prisma.regulatoryRequirement.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryRequirementSource.findMany({ orderBy: { id: 'asc' } }),
    prisma.adaptiveRuleDraft.findMany({ where: { regulatory: true }, orderBy: { id: 'asc' } }),
    prisma.regulatoryRuleDraftRequirement.findMany({
      orderBy: [{ ruleDraftId: 'asc' }, { requirementId: 'asc' }],
    }),
    prisma.adaptiveRuleVersion.findMany({
      where: { regulatory: true },
      orderBy: { id: 'asc' },
    }),
    prisma.regulatorySourceRelationship.findMany({ orderBy: { id: 'asc' } }),
  ]);
  return {
    sources,
    sourceVersions,
    units,
    provisions,
    provisionUnits,
    requirements,
    requirementSources,
    ruleDrafts,
    ruleDraftRequirements,
    regulatoryRuleVersions,
    relationships,
  };
}

function assertExpectedReferences(snapshot) {
  assert.equal(snapshot.sources.length, 15);
  assert.equal(snapshot.sourceVersions.length, 25);
  assert.equal(snapshot.units.length, 1112);
  assert.equal(snapshot.units.filter(({ unitType }) => unitType === 'ARTICLE').length, 893);
  assert.equal(snapshot.requirements.length, 5);
  assert.equal(snapshot.ruleDrafts.length, 5);
  assert.equal(snapshot.regulatoryRuleVersions.length, 0);
  assert.equal(snapshot.provisions.length, 2);
  assert.equal(snapshot.provisionUnits.length, 2);
  assert.equal(snapshot.requirementSources.length, 6);
  assert.equal(snapshot.ruleDraftRequirements.length, 5);
  assert.equal(snapshot.relationships.length, 9);

  const currentVersions = snapshot.sources.map(
    (source) =>
      snapshot.sourceVersions
        .filter(({ sourceId }) => sourceId === source.id)
        .toSorted((left, right) => right.catalogVersion - left.catalogVersion)[0],
  );
  assert.equal(
    currentVersions.filter(
      ({ artifactVerificationStatus }) =>
        artifactVerificationStatus === 'OFFICIAL_ARTIFACT_VERIFIED',
    ).length,
    13,
  );
  assert.equal(
    currentVersions.filter(
      ({ artifactVerificationStatus }) => artifactVerificationStatus === 'OFFICIAL_REFERENCE_ONLY',
    ).length,
    1,
  );
  assert.equal(
    currentVersions.filter(
      ({ artifactVerificationStatus }) => artifactVerificationStatus === 'ARTIFACT_PENDING',
    ).length,
    0,
  );
  assert.equal(
    currentVersions.filter(
      ({ artifactVerificationStatus }) => artifactVerificationStatus === 'REJECTED_UNVERIFIED',
    ).length,
    1,
  );
  assert.equal(
    currentVersions.filter(({ textExtractionStatus }) => textExtractionStatus === 'COMPLETE')
      .length,
    8,
  );

  const mdt196 = snapshot.sources.find(({ sourceKey }) => sourceKey === 'EC_MDT_2024_196');
  const mdt196Version = currentVersions.find(({ sourceId }) => sourceId === mdt196?.id);
  assert.equal(
    snapshot.units.find(
      ({ sourceVersionId, identifier }) =>
        sourceVersionId === mdt196Version?.id && identifier === 'ARTICLE_18',
    )?.normalizedTextHash,
    'sha256:705e19bb526601ad14b90e018769f4a3ff0519fc62270b080d35275e3c06723e',
  );
  assert.equal(
    snapshot.units.find(
      ({ sourceVersionId, identifier }) =>
        sourceVersionId === mdt196Version?.id && identifier === 'ARTICLE_19',
    )?.normalizedTextHash,
    'sha256:7a73870dcabba4ce845c50027eb7ab959c182c27f6a1fa517120cfa6a3fdd6f9',
  );
}

async function operationalCounts(prisma) {
  const [users, organizations, inspections, findings, technicalAssessments] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.inspection.count(),
    prisma.inspectionFinding.count(),
    prisma.technicalAssessment.count(),
  ]);
  return { users, organizations, inspections, findings, technicalAssessments };
}

async function createHistoricalCustomerFixture(prisma) {
  const [historicalRiskMethod, technicalMethod] = await Promise.all([
    prisma.riskMethodVersion.findUniqueOrThrow({
      where: { id: '54000000-0000-4000-8000-000000000001' },
    }),
    prisma.technicalMethodVersion.findFirstOrThrow({
      include: { methodDefinition: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  const user = await prisma.user.create({
    data: {
      email: `runtime-image-${randomUUID()}@example.test`,
      displayName: 'Runtime image fixture',
      passwordHash: 'non-authenticating-test-fixture',
    },
  });
  const organization = await prisma.organization.create({
    data: { name: 'Runtime image organization fixture', country: 'Ecuador' },
  });
  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: 'ORG_OWNER' },
  });
  const workCenter = await prisma.workCenter.create({
    data: { organizationId: organization.id, name: 'Runtime image center fixture' },
  });
  const inspection = await prisma.inspection.create({
    data: {
      organizationId: organization.id,
      workCenterId: workCenter.id,
      inspectorUserId: user.id,
      title: 'Historical inspection fixture',
      riskMethodVersionId: historicalRiskMethod.id,
      riskMethodSnapshot: historicalRiskMethod.manifest,
    },
  });
  const finding = await prisma.inspectionFinding.create({
    data: {
      organizationId: organization.id,
      inspectionId: inspection.id,
      workCenterId: workCenter.id,
      category: 'UNSAFE_CONDITION',
      title: 'Historical finding fixture',
      description: 'Synthetic customer-safety fixture for runtime synchronization.',
      riskMethodKey: 'DEMO_5X5',
      riskMethodVersion: '1.0.0',
      riskMethodVersionId: historicalRiskMethod.id,
      riskMethodSnapshot: historicalRiskMethod.manifest,
      initialMethodInput: { likelihood: 4, consequence: 3 },
      initialMethodResult: { score: 12, level: 'HIGH' },
      initialLikelihood: 4,
      initialConsequence: 3,
      initialScore: 12,
      initialRiskLevel: 'HIGH',
      initialResultLabel: 'HIGH',
      createdById: user.id,
    },
  });
  const assessment = await prisma.technicalAssessment.create({
    data: {
      organizationId: organization.id,
      workCenterId: workCenter.id,
      methodVersionId: technicalMethod.id,
      methodKey: technicalMethod.methodDefinition.key,
      methodVersion: technicalMethod.version,
      calculationKey: technicalMethod.calculationKey,
      methodSnapshot: technicalMethod.schema,
      title: 'Historical Technical Risk fixture',
      status: 'DRAFT',
      createdById: user.id,
    },
  });
  return {
    userId: user.id,
    organizationId: organization.id,
    inspectionId: inspection.id,
    findingId: finding.id,
    assessmentId: assessment.id,
  };
}

async function customerSnapshot(prisma, ids) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userId } });
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: ids.organizationId },
  });
  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: ids.inspectionId },
  });
  const finding = await prisma.inspectionFinding.findUniqueOrThrow({
    where: { id: ids.findingId },
  });
  const assessment = await prisma.technicalAssessment.findUniqueOrThrow({
    where: { id: ids.assessmentId },
  });
  return { user, organization, inspection, finding, assessment };
}

async function verifyContainerReadiness(scopedUrl) {
  const name = `sst-runtime-api-${randomUUID()}`;
  apiContainers.push(name);
  const argumentsList = dockerRuntimeArguments(scopedUrl).filter((argument) => argument !== '--rm');
  argumentsList.splice(1, 0, '-d');
  argumentsList.push('--name', name, '-p', '127.0.0.1::3001', '-e', 'PORT=3001', image);
  run('docker', argumentsList);
  const portOutput = run('docker', ['port', name, '3001/tcp'], { capture: true });
  const port = portOutput.trim().split(':').at(-1);
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const running = run('docker', ['inspect', '--format', '{{.State.Running}}', name], {
        capture: true,
      });
      if (running !== 'true') {
        const logs = run('docker', ['logs', name], { capture: true });
        throw new Error(`Runtime image API exited before readiness:\n${logs}`);
      }
      try {
        const response = await globalThis.fetch(`http://127.0.0.1:${port}/api/v1/health`);
        if (response.status === 200 && (await response.json()).status === 'ok') return;
      } catch {
        // Container is still starting.
      }
      await delay(125);
    }
    throw new Error('Runtime image API readiness timed out');
  } finally {
    run('docker', ['rm', '--force', name]);
    apiContainers.splice(apiContainers.indexOf(name), 1);
  }
}

const evidence = {
  runtimeCorpus: false,
  freshRelease: false,
  readiness: false,
  repeatedSync: false,
  driftProtection: false,
  alreadyMigratedRelease: false,
  productionLikeUpgrade: false,
  customerDataUnchanged: false,
  historicalRiskUnchanged: false,
  legacyTechnicalRiskUnchanged: false,
};

try {
  run('docker', ['build', '--file', 'apps/api/Dockerfile', '--tag', image, '.']);
  const runtimeCorpus = inspectRuntimeCorpus();
  evidence.runtimeCorpus = true;

  const fresh = await createSchema('fresh');
  try {
    runImage(fresh.url, ['pnpm', '--filter', '@sst/api', 'production:release']);
    const first = await referenceSnapshot(fresh.prisma);
    assertExpectedReferences(first);
    assert.deepEqual(await operationalCounts(fresh.prisma), {
      users: 0,
      organizations: 0,
      inspections: 0,
      findings: 0,
      technicalAssessments: 0,
    });
    evidence.freshRelease = true;

    await verifyContainerReadiness(fresh.url);
    evidence.readiness = true;

    runImage(fresh.url, ['pnpm', '--filter', '@sst/api', 'reference:sync']);
    assert.deepEqual(await referenceSnapshot(fresh.prisma), first);
    evidence.repeatedSync = true;

    await fresh.prisma.regulatorySource.update({
      where: { sourceKey: 'EC_MDT_2024_196' },
      data: { canonicalTitle: 'Disposable drift' },
    });
    const driftOutput = runImage(fresh.url, ['pnpm', '--filter', '@sst/api', 'reference:sync'], {
      capture: true,
      expectFailure: true,
    });
    assert.match(driftOutput, /REGULATORY_REFERENCE_DRIFT:SOURCE_IDENTITY:EC_MDT_2024_196/);
    evidence.driftProtection = true;
  } finally {
    await fresh.prisma.$disconnect();
  }

  const alreadyMigrated = await createSchema('already_migrated');
  try {
    runImage(alreadyMigrated.url, ['pnpm', '--filter', '@sst/api', 'prisma:deploy']);
    assert.equal(await alreadyMigrated.prisma.regulatorySource.count(), 11);
    assert.equal(await alreadyMigrated.prisma.regulatorySourceVersion.count(), 11);
    assert.equal(await alreadyMigrated.prisma.regulatoryUnit.count(), 0);
    runImage(alreadyMigrated.url, ['pnpm', '--filter', '@sst/api', 'production:release']);
    assertExpectedReferences(await referenceSnapshot(alreadyMigrated.prisma));
    evidence.alreadyMigratedRelease = true;
  } finally {
    await alreadyMigrated.prisma.$disconnect();
  }

  const productionLike = await createSchema('production_like');
  try {
    runImage(productionLike.url, ['pnpm', '--filter', '@sst/api', 'prisma:deploy']);
    assert.equal(await productionLike.prisma.regulatorySource.count(), 11);
    assert.equal(await productionLike.prisma.regulatorySourceVersion.count(), 11);
    assert.equal(await productionLike.prisma.regulatoryUnit.count(), 0);
    const fixtureIds = await createHistoricalCustomerFixture(productionLike.prisma);
    const customerBefore = await customerSnapshot(productionLike.prisma, fixtureIds);
    const historicalRiskBefore = await productionLike.prisma.riskMethodVersion.findUniqueOrThrow({
      where: { id: '54000000-0000-4000-8000-000000000001' },
    });
    const technicalRiskBefore = await productionLike.prisma.technicalMethodVersion.findMany({
      orderBy: { id: 'asc' },
    });
    runImage(productionLike.url, ['pnpm', '--filter', '@sst/api', 'production:release']);
    assertExpectedReferences(await referenceSnapshot(productionLike.prisma));
    assert.deepEqual(await customerSnapshot(productionLike.prisma, fixtureIds), customerBefore);
    assert.deepEqual(
      await productionLike.prisma.riskMethodVersion.findUniqueOrThrow({
        where: { id: '54000000-0000-4000-8000-000000000001' },
      }),
      historicalRiskBefore,
    );
    assert.deepEqual(
      await productionLike.prisma.technicalMethodVersion.findMany({ orderBy: { id: 'asc' } }),
      technicalRiskBefore,
    );
    evidence.productionLikeUpgrade = true;
    evidence.customerDataUnchanged = true;
    evidence.historicalRiskUnchanged = true;
    evidence.legacyTechnicalRiskUnchanged = true;
  } finally {
    await productionLike.prisma.$disconnect();
  }

  assert.deepEqual(evidence, {
    runtimeCorpus: true,
    freshRelease: true,
    readiness: true,
    repeatedSync: true,
    driftProtection: true,
    alreadyMigratedRelease: true,
    productionLikeUpgrade: true,
    customerDataUnchanged: true,
    historicalRiskUnchanged: true,
    legacyTechnicalRiskUnchanged: true,
  });
  const imageSize = Number(
    run('docker', ['image', 'inspect', image, '--format', '{{.Size}}'], { capture: true }),
  );
  globalThis.console.log(
    JSON.stringify({
      status: 'ok',
      corpusRoot: runtimeCorpus.root,
      corpusFileCount: runtimeCorpus.files.length,
      imageSize,
      evidence,
    }),
  );
} finally {
  for (const name of apiContainers)
    spawnSync('docker', ['rm', '--force', name], { cwd: repositoryRoot, stdio: 'ignore' });
  for (const schema of schemaNames.reverse())
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.$disconnect();
}
