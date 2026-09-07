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
  const [
    sources,
    sourceVersions,
    definitions,
    versions,
    links,
    guidance,
    contexts,
    regulatorySources,
    regulatorySourceVersions,
    regulatoryUnits,
    regulatoryProvisions,
    regulatoryProvisionUnits,
    regulatoryRequirements,
    regulatoryRequirementSources,
    regulatoryRuleDrafts,
    regulatoryRuleDraftRequirements,
    regulatorySourceRelationships,
    regulatoryInterpretationReviews,
    workPermitFeatureDefinitions,
    workPermitPlanFeatures,
    inspectionStandardSources,
    inspectionStandardVersions,
    inspectionStandardSections,
    inspectionStandardCriteria,
    inspectionResourceTaxonomies,
    inspectionResourceTaxonomyVersions,
    inspectionResources,
    inspectionResourceMappingVersions,
    inspectionResourceMappings,
  ] = await Promise.all([
    prisma.methodologySource.findMany({ orderBy: { id: 'asc' } }),
    prisma.methodologySourceVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.riskMethodDefinition.findMany({ orderBy: { id: 'asc' } }),
    prisma.riskMethodVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.riskMethodSourceLink.findMany({ orderBy: { id: 'asc' } }),
    prisma.riskMethodExpertGuidanceVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.riskMethodRegulatoryContext.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatorySource.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatorySourceVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryUnit.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryProvision.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryProvisionUnit.findMany({
      orderBy: [{ provisionId: 'asc' }, { unitId: 'asc' }],
    }),
    prisma.regulatoryRequirement.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryRequirementSource.findMany({ orderBy: { id: 'asc' } }),
    prisma.adaptiveRuleDraft.findMany({
      where: { regulatory: true },
      orderBy: { id: 'asc' },
    }),
    prisma.regulatoryRuleDraftRequirement.findMany({
      orderBy: [{ ruleDraftId: 'asc' }, { requirementId: 'asc' }],
    }),
    prisma.regulatorySourceRelationship.findMany({ orderBy: { id: 'asc' } }),
    prisma.regulatoryInterpretationReview.findMany({ orderBy: { id: 'asc' } }),
    prisma.featureDefinition.findMany({
      where: { key: 'module.work_permits' },
      orderBy: { id: 'asc' },
    }),
    prisma.planFeature.findMany({
      where: { feature: { key: 'module.work_permits' } },
      orderBy: { id: 'asc' },
    }),
    prisma.inspectionStandardSource.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionStandardVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionStandardSection.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionStandardCriterion.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionResourceTaxonomy.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionResourceTaxonomyVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionResource.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionResourceCriterionMappingVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.inspectionResourceCriterionMapping.findMany({
      orderBy: [{ mappingVersionId: 'asc' }, { resourceId: 'asc' }, { displayOrder: 'asc' }],
    }),
  ]);
  return {
    sources,
    sourceVersions,
    definitions,
    versions,
    links,
    guidance,
    contexts,
    regulatorySources,
    regulatorySourceVersions,
    regulatoryUnits,
    regulatoryProvisions,
    regulatoryProvisionUnits,
    regulatoryRequirements,
    regulatoryRequirementSources,
    regulatoryRuleDrafts,
    regulatoryRuleDraftRequirements,
    regulatorySourceRelationships,
    regulatoryInterpretationReviews,
    workPermitFeatureDefinitions,
    workPermitPlanFeatures,
    inspectionStandardSources,
    inspectionStandardVersions,
    inspectionStandardSections,
    inspectionStandardCriteria,
    inspectionResourceTaxonomies,
    inspectionResourceTaxonomyVersions,
    inspectionResources,
    inspectionResourceMappingVersions,
    inspectionResourceMappings,
  };
}

async function existingGlobalReferenceSnapshot(prisma) {
  const [technicalDefinitions, technicalVersions, applicabilityPacks] = await Promise.all([
    prisma.technicalMethodDefinition.findMany({ orderBy: { id: 'asc' } }),
    prisma.technicalMethodVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.applicabilityRulePackVersion.findMany({ orderBy: { id: 'asc' } }),
  ]);
  return { technicalDefinitions, technicalVersions, applicabilityPacks };
}

async function operationalCounts(prisma) {
  const [
    users,
    memberships,
    organizations,
    workCenters,
    inspections,
    findings,
    actions,
    obligations,
    permits,
    operationalPlans,
    operationalPlanItems,
    inspectionDraftProposals,
    privateInspectionResourceTaxonomies,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.membership.count(),
    prisma.organization.count(),
    prisma.workCenter.count(),
    prisma.inspection.count(),
    prisma.inspectionFinding.count(),
    prisma.correctiveAction.count(),
    prisma.obligationExecution.count(),
    prisma.workPermit.count(),
    prisma.operationalPlan.count(),
    prisma.operationalPlanItem.count(),
    prisma.inspectionDraftProposal.count(),
    prisma.inspectionResourceTaxonomy.count({ where: { organizationId: { not: null } } }),
  ]);
  return {
    users,
    memberships,
    organizations,
    workCenters,
    inspections,
    findings,
    actions,
    obligations,
    permits,
    operationalPlans,
    operationalPlanItems,
    inspectionDraftProposals,
    privateInspectionResourceTaxonomies,
  };
}

function assertExpectedReferences(snapshot) {
  assert.equal(snapshot.sources.length, 1);
  assert.equal(snapshot.sourceVersions.length, 1);
  assert.equal(snapshot.definitions.length, 3);
  assert.equal(snapshot.versions.length, 3);
  assert.equal(snapshot.links.length, 1);
  assert.equal(snapshot.guidance.length, 1);
  assert.equal(snapshot.contexts.length, 2);
  assert.equal(snapshot.regulatorySources.length, 15);
  assert.equal(snapshot.regulatorySourceVersions.length, 25);
  assert.equal(snapshot.regulatoryUnits.length, 1112);
  assert.equal(
    snapshot.regulatoryUnits.filter(({ unitType }) => unitType === 'ARTICLE').length,
    893,
  );
  assert.equal(snapshot.regulatoryProvisions.length, 2);
  assert.equal(snapshot.regulatoryProvisionUnits.length, 2);
  assert.equal(snapshot.regulatoryRequirements.length, 5);
  assert.equal(snapshot.regulatoryRequirementSources.length, 6);
  assert.equal(
    snapshot.regulatoryRequirements.filter(
      ({ editorialStatus }) => editorialStatus === 'TECHNICAL_REVIEW_PENDING',
    ).length,
    5,
  );
  assert.equal(snapshot.regulatoryRuleDrafts.length, 5);
  assert.equal(snapshot.regulatoryRuleDraftRequirements.length, 5);
  assert.equal(snapshot.regulatorySourceRelationships.length, 9);
  assert.equal(snapshot.regulatoryInterpretationReviews.length, 0);
  assert.deepEqual(
    snapshot.workPermitFeatureDefinitions.map(({ key, description, valueType }) => ({
      key,
      description,
      valueType,
    })),
    [{ key: 'module.work_permits', description: 'Módulo de permisos', valueType: 'BOOLEAN' }],
  );
  assert.equal(snapshot.workPermitPlanFeatures.length, 0);
  assert.equal(snapshot.inspectionStandardSources.length, 8);
  assert.equal(snapshot.inspectionStandardVersions.length, 9);
  assert.equal(snapshot.inspectionStandardSections.length, 9);
  assert.equal(snapshot.inspectionStandardCriteria.length, 16);
  assert.equal(snapshot.inspectionResourceTaxonomies.length, 1);
  assert.equal(snapshot.inspectionResourceTaxonomyVersions.length, 1);
  assert.equal(snapshot.inspectionResources.length, 21);
  assert.equal(snapshot.inspectionResourceMappingVersions.length, 4);
  assert.equal(snapshot.inspectionResourceMappings.length, 231);
  assert.equal(snapshot.inspectionResourceTaxonomies[0].organizationId, null);
  assert.equal(snapshot.inspectionResourceTaxonomies[0].code, 'DEMO_ELECTRICAL_RESOURCE_SCOPE_V1');
  assert.deepEqual(
    snapshot.inspectionResources.reduce(
      (counts, resource) => ({ ...counts, [resource.level]: (counts[resource.level] ?? 0) + 1 }),
      {},
    ),
    { INDUSTRIAL_SERVICE: 7, MAJOR: 7, MINOR: 7 },
  );
  assert.equal(
    snapshot.inspectionStandardSources.filter(({ rightsType }) => rightsType === 'DEMO_SYNTHETIC')
      .length,
    3,
  );
  assert.equal(
    snapshot.inspectionStandardVersions.filter(
      ({ metadata }) => metadata && typeof metadata === 'object' && metadata.synthetic === true,
    ).length,
    3,
  );
  assert.equal(
    snapshot.inspectionStandardCriteria.filter(({ standardVersionId }) =>
      snapshot.inspectionStandardVersions.some(
        ({ id, metadata }) =>
          id === standardVersionId &&
          metadata &&
          typeof metadata === 'object' &&
          metadata.synthetic === true,
      ),
    ).length,
    10,
  );
  assert.equal(
    snapshot.inspectionStandardSources.every(
      ({ organizationId, rightsType, sourceType, status }) =>
        organizationId === null &&
        ['DEMO_SYNTHETIC', 'PUBLIC_OFFICIAL', 'REFERENCE_ONLY'].includes(rightsType) &&
        sourceType === 'GLOBAL_REFERENCE' &&
        status === 'ACTIVE',
    ),
    true,
  );
  const officialPilots = snapshot.inspectionStandardSources.filter(
    ({ rightsType }) => rightsType === 'PUBLIC_OFFICIAL',
  );
  assert.deepEqual(officialPilots.map(({ code }) => code).sort(), [
    'PILOT_CLP_EU_1272_2008',
    'PILOT_REBT_ES_2002',
    'PILOT_RETIE_CO_2026',
    'PILOT_RTQ_EC_UIO_2026',
  ]);
  assert.equal(
    officialPilots.every(({ referenceUrl }) => referenceUrl?.startsWith('https://')),
    true,
  );
  const officialVersions = snapshot.inspectionStandardVersions.filter(({ sourceId }) =>
    officialPilots.some(({ id }) => id === sourceId),
  );
  assert.equal(officialVersions.length, 5);
  assert.equal(
    officialVersions.filter(
      ({ metadata }) =>
        metadata && typeof metadata === 'object' && metadata.professionalReview === 'PENDING_ANITA',
    ).length,
    5,
  );
  assert.equal(
    officialVersions.find(({ versionCode }) => versionCode === 'CELEX-32008R1272-METADATA-1')
      ?.status,
    'DRAFT',
  );
  assert.equal(
    snapshot.inspectionStandardCriteria.filter(({ standardVersionId }) =>
      officialVersions.some(({ id }) => id === standardVersionId),
    ).length,
    6,
  );
  const nfpaReference = snapshot.inspectionStandardSources.find(
    ({ code }) => code === 'REFERENCE_NFPA_70E_2024',
  );
  assert.equal(nfpaReference?.rightsType, 'REFERENCE_ONLY');
  const nfpaVersion = snapshot.inspectionStandardVersions.find(
    ({ sourceId }) => sourceId === nfpaReference?.id,
  );
  assert.equal(nfpaVersion?.status, 'DRAFT');
  assert.equal(
    snapshot.inspectionStandardCriteria.filter(
      ({ standardVersionId }) => standardVersionId === nfpaVersion?.id,
    ).length,
    0,
  );

  const currentVersions = snapshot.regulatorySources.map((source) => {
    const versionsForSource = snapshot.regulatorySourceVersions.filter(
      ({ sourceId }) => sourceId === source.id,
    );
    return versionsForSource.toSorted(
      (left, right) => right.catalogVersion - left.catalogVersion,
    )[0];
  });
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

  const cd517 = snapshot.regulatorySources.find(({ sourceKey }) => sourceKey === 'EC_IESS_CD_517');
  assert.equal(
    currentVersions.find(({ sourceId }) => sourceId === cd517?.id)?.vigenciaReviewStatus,
    'REPEALED',
  );
  assert.equal(
    snapshot.regulatorySourceRelationships.find(
      ({ id }) => id === 'a3000000-0000-4000-8000-000000000001',
    )?.reviewStatus,
    'CONFIRMED',
  );

  const versionIds = new Set(snapshot.regulatorySourceVersions.map(({ id }) => id));
  const unitIds = new Set(snapshot.regulatoryUnits.map(({ id }) => id));
  const provisionIdsWithUnits = new Set(
    snapshot.regulatoryProvisionUnits.map(({ provisionId }) => provisionId),
  );
  const requirementIdsWithSources = new Set(
    snapshot.regulatoryRequirementSources
      .filter(({ provisionId }) => provisionIdsWithUnits.has(provisionId))
      .map(({ requirementId }) => requirementId),
  );
  const tracedRuleDraftIds = new Set(
    snapshot.regulatoryRuleDraftRequirements
      .filter(({ requirementId }) => requirementIdsWithSources.has(requirementId))
      .map(({ ruleDraftId }) => ruleDraftId),
  );
  assert.equal(
    snapshot.regulatoryUnits.filter(({ sourceVersionId }) => !versionIds.has(sourceVersionId))
      .length,
    0,
  );
  assert.equal(
    snapshot.regulatoryRequirements.filter(({ id }) => !requirementIdsWithSources.has(id)).length,
    0,
  );
  assert.equal(
    snapshot.regulatoryRuleDrafts.filter(({ id }) => !tracedRuleDraftIds.has(id)).length,
    0,
  );
  assert.equal(
    snapshot.regulatoryInterpretationReviews.filter(
      ({ unitId, sourceVersionIdSnapshot }) =>
        !unitIds.has(unitId) || !versionIds.has(sourceVersionIdSnapshot),
    ).length,
    0,
  );

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
      obligations: 0,
      permits: 0,
      operationalPlans: 0,
      operationalPlanItems: 0,
      inspectionDraftProposals: 0,
      privateInspectionResourceTaxonomies: 0,
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
    const legacyWorkPermitFeature = await productionLike.prisma.featureDefinition.create({
      data: { key: 'module.work_permits', description: 'Módulo de permisos', valueType: 'BOOLEAN' },
    });
    const legacyGrowthPlan = await productionLike.prisma.plan.create({
      data: {
        key: 'GROWTH',
        name: 'Growth fixture',
        description: 'Disposable legacy commercial assignment fixture.',
        sortOrder: 30,
      },
    });
    await productionLike.prisma.planFeature.create({
      data: { planId: legacyGrowthPlan.id, featureId: legacyWorkPermitFeature.id, value: 'true' },
    });
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
    await drift.prisma.featureDefinition.update({
      where: { key: 'module.work_permits' },
      data: { description: 'Disposable feature drift' },
    });
    const catalogDriftOutput = runPackageScript('reference:sync', drift.url, false);
    assert.match(catalogDriftOutput, /CATALOG_REFERENCE_DRIFT:FEATURE:module\.work_permits/);
    await drift.prisma.featureDefinition.update({
      where: { key: 'module.work_permits' },
      data: { description: 'Módulo de permisos' },
    });
    await drift.prisma.riskMethodVersion.update({
      where: { id: '54000000-0000-4000-8000-000000000003' },
      data: { displayName: 'Mutated disposable GTC45 reference' },
    });
    const output = runPackageScript('reference:sync', drift.url, false);
    assert.match(output, /RISK_METHOD_REFERENCE_DRIFT:METHOD:GTC45_2010:1\.0\.0/);
    await drift.prisma.riskMethodVersion.update({
      where: { id: '54000000-0000-4000-8000-000000000003' },
      data: { displayName: 'GTC 45 — edición 2010' },
    });
    await drift.prisma.inspectionStandardCriterion.update({
      where: { id: '57300000-0000-4000-8000-000000000001' },
      data: { title: 'Mutated synthetic criterion' },
    });
    const inspectionOutput = runPackageScript('reference:sync', drift.url, false);
    assert.match(
      inspectionOutput,
      /INSPECTION_STANDARD_REFERENCE_DRIFT:DEMO_ELECTRICAL_STANDARD_A:A-PANEL-CLOSURE/,
    );
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
