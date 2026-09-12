import assert from 'node:assert/strict';
import {
  DEMO_ADAPTIVE_RULE_PACK,
  adaptivePackContentHash,
  normalizeAdaptiveGroupVersion,
  normalizeAdaptiveRuleVersion,
} from '@sst/contracts';

export const HISTORICAL_ADAPTIVE_V1_PRODUCTION_HASH =
  'sha256:2f989b31020bd59c744ef3e8a3c0f29af0affcd0b4cf500e56313c8ab2bd681b';

export const LEGACY_PRODUCTION_ADAPTIVE_V1_FIXTURE = {
  facts: {
    'organization.country': [
      '51e74602-60b7-43b8-8466-18af14ce69be',
      'afde7593-7388-4695-9bac-7ff877f48cc5',
    ],
    'organization.sector': [
      '596f030d-24c4-4677-8782-593ccd3c91d8',
      'e354022d-02f3-4b3a-8116-fdc57ba02685',
    ],
    'organization.strategicProtectionPriorities': [
      '86d8ffb6-643c-4730-a8bc-d776afc87c24',
      '6ce26e45-1c25-4217-9c45-e8bbfafb904a',
    ],
    'organization.totalWorkerCount': [
      '3a801e78-3ce0-4c82-b4aa-0ef8fa681d22',
      '733ef330-de00-4be4-b33e-8cd70b37dd32',
    ],
    'organization.workCenterCount': [
      '3e9e102e-aeaf-4ae9-b1c4-a2c46a80d286',
      '5a9da2e0-c4da-429f-85f3-093c26bcfcaf',
    ],
    'workCenter.activityCategory': [
      '36b72806-392b-46db-86d9-98f3eb81a94a',
      '75e89da3-6728-40a6-96a5-962483392282',
    ],
    'workCenter.activityDescription': [
      '49d77dcf-d002-4e62-9007-12732ca19cfe',
      'a1f06224-b68d-4964-a5bc-2b3fa9f90b21',
    ],
    'workCenter.facilityType': [
      'b49dca48-bcb2-43ac-b78f-c27203c4cdb9',
      'bf19913f-953b-4d2d-90d0-27a405df414f',
    ],
    'workCenter.hasChemicalProcesses': [
      'f5c3d09f-e053-422d-b48d-f08d56773e03',
      '3ea9b569-7c57-4a43-8759-dfc2758f3802',
    ],
    'workCenter.hasConfinedSpaces': [
      'e4970876-df57-47d3-801a-0bb37d57e6b4',
      'e54fc745-9090-4d58-8167-1883966729e5',
    ],
    'workCenter.hasCriticalMachinery': [
      '76e3bd06-e336-473b-90ab-b10e86a2e083',
      'fba0e0d3-0b5d-4797-a7af-2c5f8d81aaf2',
    ],
    'workCenter.hasDistinctOperationalZones': [
      '1b6e1d71-f5b7-4452-90fb-995aea51ab41',
      '1269c0d6-b7f8-47f4-924c-a734500bf590',
    ],
    'workCenter.hasExternalWorkforce': [
      'bf562f29-bedf-409f-83bf-712f5b85038c',
      'e8e50180-60e4-473b-a8ed-cf67b7be5d73',
    ],
    'workCenter.hasHighEnergyOperations': [
      '5e1bffb6-3d76-45ee-a8d5-7aa2bf9d826a',
      'cee40ff0-01b1-4fc1-9a28-666483cf96c9',
    ],
    'workCenter.hasWorkAtHeight': [
      'ccf79ab3-2f3e-4561-8323-2af202948405',
      'bd2662f8-69ee-4e21-ad70-3e6420e0458d',
    ],
    'workCenter.workArrangement': [
      '285de17a-2655-4057-87eb-cd4a4912f6ad',
      'b5ef6129-5b51-4aa6-8720-3ab88f08f845',
    ],
    'workCenter.workerCount': [
      '3ed3c705-b56a-44ed-88d1-ba985e171681',
      '9b6919eb-3e12-4e97-8a3d-1d223497b3ac',
    ],
  },
  targets: {
    CHEMICAL_PROCESS_CONTROLS: [
      'cb9a329a-184d-4643-ab46-363e32fde15b',
      'd2459236-91e4-4414-b4b7-15720a927b4e',
    ],
    EMERGENCY_PREPAREDNESS: [
      '69863b86-4f7a-4846-b9ed-1dd00dfef7ef',
      '5359e862-6029-45ab-9348-f44298994a0b',
    ],
    EXTERNAL_WORKFORCE_COORDINATION: [
      '8e988233-16ea-4c62-848b-852b910ddf04',
      'c242df06-7efb-41a6-95b3-21b088c25b2d',
    ],
    HIGH_ENERGY_PROFESSIONAL_REVIEW: [
      'd34445e4-aedc-45c2-97f3-4c5df1e16bfc',
      '76f7a577-a407-4848-86a0-ce3dd8b35cd1',
    ],
    HIGH_RISK_WORK_CONTROLS: [
      'cec6c661-a59f-4ae4-95c4-589687e05397',
      '9710f4b1-b5d8-4b67-8f3a-a5694a5bd6e9',
    ],
    MULTI_CENTER_COORDINATION: [
      '5ad53f90-3462-4b9e-a2d8-81fddf9f22f9',
      'cd32fdc1-8194-46dc-9d9e-96ce716683ce',
    ],
    REMOTE_WORK_REVIEW: [
      '804358d9-fcd3-4ea8-854c-4b83588fdabd',
      'a3aae694-e6d8-4cd6-8d89-a2393f32fd32',
    ],
    SST_MANAGEMENT_BASELINE: [
      '685f5157-c6ae-4de1-b42a-fd6cbbd1c6e0',
      'b30c8091-ec43-4fa3-bb67-7f26b0e87c1b',
    ],
    TECHNICAL_INSPECTION_PLANNING: [
      '9db758e7-311e-4077-b708-fe4e2d56a66c',
      '825a9d95-bf50-443c-ad3e-511e6a556006',
    ],
  },
  rules: {
    AMBIGUOUS_ACTIVITY_CLARIFICATION: [
      '2a9fbd7a-4386-425c-bd50-736893631821',
      'a6f90a65-82aa-4d9e-b2a0-5e07fdba6936',
      '3b71d202-e202-49a6-9d50-8d03df95da17',
    ],
    CHEMICAL_PROCESS_RULE: [
      'baaa8f76-f922-4245-b3cf-c03b451d40ed',
      '53e5f275-d859-41bc-8f01-08a810f25248',
      '00ee0fbb-8b01-4fbd-8c8c-162bce342cf8',
    ],
    CONSTRUCTION_CONFINED_RULE: [
      'f4faad0d-0998-4c72-9125-1ed026a555bb',
      '05d0b90f-c763-4cbd-9e2e-024fb4ac66eb',
      '2394ced7-b4c5-4bb7-904f-35da4a87be33',
    ],
    CONSTRUCTION_HEIGHT_RULE: [
      'f1c65fd4-fd42-47ca-95fc-7a02386de851',
      'a0f75b31-6184-41c9-8190-c6e130ba6bac',
      'b2f629f3-8d1b-4049-89dd-76821327ecd8',
    ],
    CONSTRUCTION_MACHINERY_RULE: [
      '6766ca5e-7f6b-4bf9-ba05-44dcc40f0c40',
      'd38263e3-caa1-4ed2-a160-982e091ab422',
      '5ced65f6-db84-422b-9c04-d520ff71bb73',
    ],
    EXTERNAL_WORKFORCE_RULE: [
      '9299e655-7802-4a7e-a05d-e48090b58274',
      '164e0b43-e543-46e6-a91b-60193162ffea',
      '02294ee5-94e6-489e-bdf6-67c2273c3c2d',
    ],
    GENERAL_MANAGEMENT_BASELINE: [
      'fc51b1c9-c916-4cdb-be9e-22101b96e3e5',
      '7411c50f-3439-4273-a587-7e32cea3c2f5',
      'db9649f6-63f1-4e4f-a66f-ebeb32905bc9',
    ],
    HIGH_ENERGY_RULE: [
      '6995720f-8ef4-4ba7-ac4a-107c852d4567',
      '283e9237-2242-4f35-8ffb-a668ab2b1fcd',
      'da556793-034c-4c67-8999-19807db6fe22',
    ],
    MULTI_CENTER_COORDINATION_RULE: [
      'f8f5eb1a-b1f7-4e1d-9d63-b60fb9c96809',
      '071a9d39-abc9-48ab-b9ea-a8f5378b58a6',
      'a32becff-2fbe-44f3-97f1-a4d22025261d',
    ],
    PHYSICAL_EMERGENCY_REVIEW: [
      'c4d2b9ea-ff07-4ea1-8c5e-433a334c28e9',
      'a771aec2-fdcd-46a3-a3f9-49e2886d96c4',
      'fd5b2f51-3fa0-426b-b3bd-167850aff49f',
    ],
    PHYSICAL_TECHNICAL_INSPECTION: [
      'a58aa1dc-5af3-4536-987a-508f65782e67',
      '4c3c73e2-ac8b-483c-bcf2-411247676464',
      '95e9391b-0243-4c2a-8c9a-144932f7afae',
    ],
    REMOTE_WELLBEING_REVIEW: [
      'a71203ce-98d9-41a3-b836-ddd9ebe4c636',
      'a13acb63-1811-4660-bdc4-c30fdcc04038',
      '87388bd2-bf34-4968-9f2b-7e52b5ca267e',
    ],
  },
  groups: {
    CHEMICAL_PROCESS: [
      '4c204cf8-be6b-4188-b328-ac194005f2ee',
      'a7dae897-505d-443c-ae3e-623c20d57f0f',
    ],
    CONSTRUCTION_HIGH_RISK: [
      '1d473edd-1adc-48b6-8f31-fc4a68f57ed8',
      'e459d7e2-754b-4f63-b765-ca70e572239f',
    ],
    EXTERNAL_WORKFORCE: [
      '7d834e0b-e6e3-48ed-a42b-2d388e491a13',
      'fdc2a441-23a3-43d0-b25d-4e42e0d2c0a2',
    ],
    GENERAL: ['640629f2-8097-4d95-87ac-40c051243f35', '980a1fc9-3a24-49e9-a0cc-a158cde0c2b4'],
    HIGH_ENERGY: ['f42b5fb9-463e-44c9-b65b-82b545335859', '8419671c-d283-4f9d-a3bb-d0f1931044e1'],
    MULTI_CENTER: ['10b4c939-b27e-4852-90cd-92e0d3dfde06', '19470b50-038f-489c-a950-e6aa33530a56'],
    PHYSICAL_WORKPLACE: [
      '35be2708-fd0a-40e5-8840-db5b7625a2ce',
      '90023958-8ba2-4bee-b6da-e338281d5d91',
    ],
    REMOTE_HYBRID: ['9aed1498-5fe3-425b-9d07-d3289329eff3', '79455dad-b132-45ee-b1a6-99b0b10aeb27'],
  },
  pack: ['40882591-7a82-4d91-8e6c-4571eda39d35', 'bffef433-bc0b-4a72-b7b3-4b9070a9656b'],
};

const publishedAt = new Date('2026-08-21T16:11:13.858Z');

export async function createHistoricalAdaptiveV1ProductionFixture(prisma) {
  const identities = LEGACY_PRODUCTION_ADAPTIVE_V1_FIXTURE;
  const workerFact = DEMO_ADAPTIVE_RULE_PACK.factVersions.find(
    ({ factKey }) => factKey === 'organization.totalWorkerCount',
  );
  assert.equal(workerFact?.collectionMode, 'DERIVED_ONLY');

  for (const fact of DEMO_ADAPTIVE_RULE_PACK.factVersions) {
    const [definitionId, versionId] = identities.facts[fact.factKey];
    await prisma.adaptiveFactDefinition.create({
      data: {
        id: definitionId,
        factKey: fact.factKey,
        category: fact.category,
        defaultScope: fact.defaultScope,
      },
    });
    await prisma.adaptiveFactVersion.create({
      data: {
        id: versionId,
        factDefinitionId: definitionId,
        version: fact.version,
        valueType: fact.valueType,
        questionText: fact.questionText,
        helpText: fact.helpText,
        unknownAllowed: fact.unknownAllowed,
        collectionMode: fact.collectionMode,
        validation: {
          ...(fact.min === undefined ? {} : { min: fact.min }),
          ...(fact.max === undefined ? {} : { max: fact.max }),
          ...(fact.maxLength === undefined ? {} : { maxLength: fact.maxLength }),
        },
        choiceOptions: fact.choices,
        priority: fact.priority,
        publishedAt,
      },
    });
  }

  for (const target of DEMO_ADAPTIVE_RULE_PACK.targetVersions) {
    const [definitionId, versionId] = identities.targets[target.targetKey];
    await prisma.adaptiveConfigurationTargetDefinition.create({
      data: { id: definitionId, targetKey: target.targetKey },
    });
    await prisma.adaptiveConfigurationTargetVersion.create({
      data: {
        id: versionId,
        targetDefinitionId: definitionId,
        version: target.version,
        title: target.title,
        description: target.description,
        category: target.category,
        currentStateQuestion: target.currentStateQuestion,
        evidenceSuggestions: target.evidenceSuggestions,
        isDemo: true,
        publishedAt,
      },
    });
  }

  for (const rule of DEMO_ADAPTIVE_RULE_PACK.rules) {
    const [definitionId, draftId, versionId] = identities.rules[rule.ruleKey];
    const schema = normalizeAdaptiveRuleVersion(rule);
    await prisma.adaptiveRuleDefinition.create({
      data: { id: definitionId, ruleKey: rule.ruleKey },
    });
    await prisma.adaptiveRuleDraft.create({
      data: {
        id: draftId,
        ruleDefinitionId: definitionId,
        revision: 1,
        status: 'READY_TO_PUBLISH',
        schema,
        isDemo: true,
        regulatory: false,
        demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
        technicalReviewedAt: publishedAt,
        legalReviewedAt: publishedAt,
      },
    });
    await prisma.adaptiveRuleVersion.create({
      data: {
        id: versionId,
        ruleDefinitionId: definitionId,
        version: rule.version,
        schema,
        isDemo: true,
        regulatory: false,
        demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
        sourceDraftId: draftId,
      },
    });
    await prisma.adaptiveRuleVersion.update({
      where: { id: versionId },
      data: { publishedAt, sealedAt: publishedAt },
    });
    await prisma.adaptiveRuleDraft.update({
      where: { id: draftId },
      data: { status: 'PUBLISHED' },
    });
  }

  for (const group of DEMO_ADAPTIVE_RULE_PACK.groups) {
    const [definitionId, versionId] = identities.groups[group.groupKey];
    const normalized = normalizeAdaptiveGroupVersion(group);
    await prisma.adaptiveRuleGroupDefinition.create({
      data: { id: definitionId, groupKey: group.groupKey },
    });
    await prisma.adaptiveRuleGroupVersion.create({
      data: {
        id: versionId,
        groupDefinitionId: definitionId,
        version: group.version,
        title: normalized.title,
        priority: normalized.priority,
        scopeMode: normalized.scopeMode,
        activationExpression: normalized.activation,
        isDemo: true,
        regulatory: false,
        groupRules: {
          create: normalized.ruleKeys.map((ruleKey, sortOrder) => ({
            ruleVersionId: identities.rules[ruleKey][2],
            sortOrder,
          })),
        },
      },
    });
    await prisma.adaptiveRuleGroupVersion.update({
      where: { id: versionId },
      data: { publishedAt, sealedAt: publishedAt },
    });
  }

  const calculatedHash = adaptivePackContentHash(DEMO_ADAPTIVE_RULE_PACK, {
    factVersions: DEMO_ADAPTIVE_RULE_PACK.factVersions.map(({ factKey, version }) => ({
      id: identities.facts[factKey][1],
      factKey,
      version,
    })),
    targetVersions: DEMO_ADAPTIVE_RULE_PACK.targetVersions.map(({ targetKey, version }) => ({
      id: identities.targets[targetKey][1],
      targetKey,
      version,
    })),
    ruleVersions: DEMO_ADAPTIVE_RULE_PACK.rules.map(({ ruleKey, version }) => ({
      id: identities.rules[ruleKey][2],
      ruleKey,
      version,
    })),
    groupVersions: DEMO_ADAPTIVE_RULE_PACK.groups.map(({ groupKey, version }) => ({
      id: identities.groups[groupKey][1],
      groupKey,
      version,
    })),
  });
  assert.equal(calculatedHash, HISTORICAL_ADAPTIVE_V1_PRODUCTION_HASH);

  const [packDefinitionId, packVersionId] = identities.pack;
  await prisma.adaptiveRulePackDefinition.create({
    data: {
      id: packDefinitionId,
      packKey: DEMO_ADAPTIVE_RULE_PACK.packKey,
      name: DEMO_ADAPTIVE_RULE_PACK.name,
    },
  });
  await prisma.adaptiveRulePackVersion.create({
    data: {
      id: packVersionId,
      packDefinitionId,
      version: DEMO_ADAPTIVE_RULE_PACK.version,
      engineSchemaVersion: DEMO_ADAPTIVE_RULE_PACK.engineSchemaVersion,
      schema: DEMO_ADAPTIVE_RULE_PACK,
      contentHash: calculatedHash,
      isDemo: true,
      regulatory: false,
      disclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
      facts: {
        create: Object.values(identities.facts)
          .map(([, factVersionId]) => factVersionId)
          .sort()
          .map((factVersionId) => ({ factVersionId })),
      },
      targets: {
        create: Object.values(identities.targets)
          .map(([, targetVersionId]) => targetVersionId)
          .sort()
          .map((targetVersionId) => ({ targetVersionId })),
      },
      rules: {
        create: Object.values(identities.rules)
          .map(([, , ruleVersionId]) => ruleVersionId)
          .sort()
          .map((ruleVersionId) => ({ ruleVersionId })),
      },
      groups: {
        create: Object.values(identities.groups)
          .map(([, groupVersionId]) => groupVersionId)
          .sort()
          .map((groupVersionId) => ({ groupVersionId })),
      },
    },
  });
  await prisma.adaptiveRulePackVersion.update({
    where: { id: packVersionId },
    data: { publishedAt, sealedAt: publishedAt },
  });

  return { packDefinitionId, packVersionId, contentHash: calculatedHash };
}
