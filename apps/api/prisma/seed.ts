import {
  PrismaClient,
  FeatureValueType,
  ModuleKey,
  PlanKey,
  Prisma,
  type RegulatoryCandidateStatus,
  type RegulatoryDocumentType,
  type RegulatoryRelationshipReviewStatus,
  type RegulatoryRelationshipType,
  type RegulatorySupersessionStatus,
} from '@prisma/client';
import {
  DEMO_ADAPTIVE_RULE_PACK,
  DEMO_APPLICABILITY_RULE_PACK,
  DEMO_TECHNICAL_RISK_METHOD,
  adaptiveContentHash,
} from '@sst/contracts';
import {
  REGULATORY_SOURCE_RECORDED_AT,
  REGULATORY_SOURCE_RELATIONSHIPS_V1,
  REGULATORY_SOURCE_V1,
} from './regulatory-source-reference-data';

const prisma = new PrismaClient();

async function provisionAdaptiveDemoReferenceData() {
  const factVersionIds = new Map<string, string>();
  for (const fact of DEMO_ADAPTIVE_RULE_PACK.factVersions) {
    const definition = await prisma.adaptiveFactDefinition.upsert({
      where: { factKey: fact.factKey },
      update: {},
      create: {
        factKey: fact.factKey,
        category: fact.category,
        defaultScope: fact.defaultScope,
      },
      select: { id: true },
    });
    const existing = await prisma.adaptiveFactVersion.findUnique({
      where: {
        factDefinitionId_version: { factDefinitionId: definition.id, version: fact.version },
      },
      select: { id: true },
    });
    const version =
      existing ??
      (await prisma.adaptiveFactVersion.create({
        data: {
          factDefinitionId: definition.id,
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
        },
        select: { id: true },
      }));
    factVersionIds.set(fact.factKey, version.id);
  }

  const targetVersionIds = new Map<string, string>();
  for (const target of DEMO_ADAPTIVE_RULE_PACK.targetVersions) {
    const definition = await prisma.adaptiveConfigurationTargetDefinition.upsert({
      where: { targetKey: target.targetKey },
      update: {},
      create: { targetKey: target.targetKey },
      select: { id: true },
    });
    const existing = await prisma.adaptiveConfigurationTargetVersion.findUnique({
      where: {
        targetDefinitionId_version: {
          targetDefinitionId: definition.id,
          version: target.version,
        },
      },
      select: { id: true },
    });
    const version =
      existing ??
      (await prisma.adaptiveConfigurationTargetVersion.create({
        data: {
          targetDefinitionId: definition.id,
          version: target.version,
          title: target.title,
          description: target.description,
          category: target.category,
          currentStateQuestion: target.currentStateQuestion,
          evidenceSuggestions: target.evidenceSuggestions,
          isDemo: true,
        },
        select: { id: true },
      }));
    targetVersionIds.set(target.targetKey, version.id);
  }

  const ruleVersionIds = new Map<string, string>();
  for (const rule of DEMO_ADAPTIVE_RULE_PACK.rules) {
    const definition = await prisma.adaptiveRuleDefinition.upsert({
      where: { ruleKey: rule.ruleKey },
      update: {},
      create: { ruleKey: rule.ruleKey },
      select: { id: true },
    });
    await prisma.adaptiveRuleDraft.upsert({
      where: { ruleDefinitionId_revision: { ruleDefinitionId: definition.id, revision: 1 } },
      update: {},
      create: {
        ruleDefinitionId: definition.id,
        revision: 1,
        status: 'READY_TO_PUBLISH',
        schema: rule as Prisma.InputJsonValue,
        isDemo: true,
        regulatory: false,
        demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
        technicalReviewedAt: new Date(),
        legalReviewedAt: new Date(),
      },
    });
    const existing = await prisma.adaptiveRuleVersion.findUnique({
      where: {
        ruleDefinitionId_version: { ruleDefinitionId: definition.id, version: rule.version },
      },
      select: { id: true },
    });
    const version =
      existing ??
      (await prisma.adaptiveRuleVersion.create({
        data: {
          ruleDefinitionId: definition.id,
          version: rule.version,
          schema: rule as Prisma.InputJsonValue,
          isDemo: true,
          regulatory: false,
          demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
        },
        select: { id: true },
      }));
    ruleVersionIds.set(rule.ruleKey, version.id);
  }

  const groupVersionIds = new Map<string, string>();
  for (const group of DEMO_ADAPTIVE_RULE_PACK.groups) {
    const definition = await prisma.adaptiveRuleGroupDefinition.upsert({
      where: { groupKey: group.groupKey },
      update: {},
      create: { groupKey: group.groupKey },
      select: { id: true },
    });
    const existing = await prisma.adaptiveRuleGroupVersion.findUnique({
      where: {
        groupDefinitionId_version: { groupDefinitionId: definition.id, version: group.version },
      },
      select: { id: true },
    });
    const version =
      existing ??
      (await prisma.adaptiveRuleGroupVersion.create({
        data: {
          groupDefinitionId: definition.id,
          version: group.version,
          title: group.title,
          priority: group.priority,
          scopeMode: group.scopeMode,
          activationExpression: group.activation as Prisma.InputJsonValue,
          isDemo: true,
          regulatory: false,
        },
        select: { id: true },
      }));
    groupVersionIds.set(group.groupKey, version.id);
    await prisma.adaptiveRuleGroupRule.createMany({
      data: group.ruleKeys.map((ruleKey, sortOrder) => ({
        groupVersionId: version.id,
        ruleVersionId: ruleVersionIds.get(ruleKey)!,
        sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  const packDefinition = await prisma.adaptiveRulePackDefinition.upsert({
    where: { packKey: DEMO_ADAPTIVE_RULE_PACK.packKey },
    update: {},
    create: {
      packKey: DEMO_ADAPTIVE_RULE_PACK.packKey,
      name: DEMO_ADAPTIVE_RULE_PACK.name,
    },
    select: { id: true },
  });
  const packContentHash = adaptiveContentHash(DEMO_ADAPTIVE_RULE_PACK);
  let packVersion = await prisma.adaptiveRulePackVersion.findUnique({
    where: {
      packDefinitionId_version: {
        packDefinitionId: packDefinition.id,
        version: DEMO_ADAPTIVE_RULE_PACK.version,
      },
    },
    select: { id: true },
  });
  packVersion ??= await prisma.adaptiveRulePackVersion.create({
    data: {
      packDefinitionId: packDefinition.id,
      version: DEMO_ADAPTIVE_RULE_PACK.version,
      engineSchemaVersion: DEMO_ADAPTIVE_RULE_PACK.engineSchemaVersion,
      schema: DEMO_ADAPTIVE_RULE_PACK as Prisma.InputJsonValue,
      contentHash: packContentHash,
      isDemo: true,
      regulatory: false,
      disclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
    },
    select: { id: true },
  });
  await Promise.all([
    prisma.adaptiveRulePackFact.createMany({
      data: [...factVersionIds.values()].map((factVersionId) => ({
        packVersionId: packVersion.id,
        factVersionId,
      })),
      skipDuplicates: true,
    }),
    prisma.adaptiveRulePackTarget.createMany({
      data: [...targetVersionIds.values()].map((targetVersionId) => ({
        packVersionId: packVersion.id,
        targetVersionId,
      })),
      skipDuplicates: true,
    }),
    prisma.adaptiveRulePackRule.createMany({
      data: [...ruleVersionIds.values()].map((ruleVersionId) => ({
        packVersionId: packVersion.id,
        ruleVersionId,
      })),
      skipDuplicates: true,
    }),
    prisma.adaptiveRulePackGroup.createMany({
      data: [...groupVersionIds.values()].map((groupVersionId) => ({
        packVersionId: packVersion.id,
        groupVersionId,
      })),
      skipDuplicates: true,
    }),
  ]);
}

const modules = [
  ['CORE', 'Núcleo SST', 'Organización, acceso, evidencias y trazabilidad común.'],
  ['INSPECTIONS_INTELLIGENCE', 'Inspecciones inteligentes', 'Centraliza hallazgos y recurrencias.'],
  ['TECHNICAL_RISK', 'Riesgo técnico', 'Presenta controles e indicadores técnicos sintéticos.'],
  ['WORK_PERMITS', 'Permisos de trabajo', 'Prepara la trazabilidad de actividades críticas.'],
  ['PSYCHOSOCIAL', 'Gestión psicosocial', 'Organiza campañas y seguimiento agregado no clínico.'],
  ['COMPLIANCE', 'Cumplimiento', 'Ordena evidencias, compromisos y reportería.'],
] as const;

const plans = [
  ['FREE', 'Free', 'Exploración y diagnóstico inicial.'],
  ['STARTER', 'Starter', 'Inicio gradual para equipos pequeños.'],
  ['GROWTH', 'Growth', 'Operaciones con varios centros y módulos.'],
  ['ENTERPRISE', 'Enterprise', 'Gobierno y escala empresarial.'],
] as const;

const features = [
  ['organization.max_work_centers', 'Máximo de centros de trabajo', 'INTEGER'],
  ['organization.max_members', 'Máximo de miembros', 'INTEGER'],
  ['demo.enabled', 'Permite activar demostración', 'BOOLEAN'],
  ['demo.duration_days', 'Duración de demostración', 'INTEGER'],
  ['ai.monthly_actions', 'Acciones mensuales de IA', 'INTEGER'],
  ['module.inspections', 'Módulo de inspecciones', 'BOOLEAN'],
  ['module.technical_risk', 'Módulo de riesgo técnico', 'BOOLEAN'],
  ['module.work_permits', 'Módulo de permisos', 'BOOLEAN'],
  ['module.psychosocial', 'Módulo psicosocial', 'BOOLEAN'],
  ['module.compliance', 'Módulo de cumplimiento', 'BOOLEAN'],
] as const;

const planValues: Record<PlanKey, Record<string, string>> = {
  FREE: {
    'organization.max_work_centers': '1',
    'organization.max_members': '2',
    'demo.enabled': 'true',
    'demo.duration_days': '14',
    'ai.monthly_actions': '0',
    'module.inspections': 'false',
    'module.technical_risk': 'false',
    'module.work_permits': 'false',
    'module.psychosocial': 'false',
    'module.compliance': 'false',
  },
  STARTER: {
    'organization.max_work_centers': '3',
    'organization.max_members': '10',
    'demo.enabled': 'true',
    'demo.duration_days': '14',
    'ai.monthly_actions': '25',
    'module.inspections': 'true',
    'module.technical_risk': 'false',
    'module.work_permits': 'false',
    'module.psychosocial': 'false',
    'module.compliance': 'true',
  },
  GROWTH: {
    'organization.max_work_centers': '12',
    'organization.max_members': '50',
    'demo.enabled': 'true',
    'demo.duration_days': '21',
    'ai.monthly_actions': '150',
    'module.inspections': 'true',
    'module.technical_risk': 'true',
    'module.work_permits': 'true',
    'module.psychosocial': 'true',
    'module.compliance': 'true',
  },
  ENTERPRISE: {
    'organization.max_work_centers': '10000',
    'organization.max_members': '10000',
    'demo.enabled': 'true',
    'demo.duration_days': '30',
    'ai.monthly_actions': '1000',
    'module.inspections': 'true',
    'module.technical_risk': 'true',
    'module.work_permits': 'true',
    'module.psychosocial': 'true',
    'module.compliance': 'true',
  },
};

async function main() {
  for (const [index, [key, name, description]] of modules.entries()) {
    await prisma.moduleDefinition.upsert({
      where: { key: key as ModuleKey },
      update: { name, description },
      create: {
        key: key as ModuleKey,
        name,
        description,
        objective: description,
        sortOrder: index,
        demoContent: {
          label: 'Demostración conceptual',
          indicators: [
            { label: 'Registros sintéticos', value: 12 },
            { label: 'Seguimiento de ejemplo', value: '83%' },
          ],
        },
      },
    });
  }

  const planRows = new Map<PlanKey, string>();
  for (const [index, [key, name, description]] of plans.entries()) {
    const plan = await prisma.plan.upsert({
      where: { key: key as PlanKey },
      update: { name, description, sortOrder: index },
      create: { key: key as PlanKey, name, description, sortOrder: index },
    });
    planRows.set(key as PlanKey, plan.id);
  }

  const featureRows = new Map<string, string>();
  for (const [key, description, valueType] of features) {
    const feature = await prisma.featureDefinition.upsert({
      where: { key },
      update: { description, valueType: valueType as FeatureValueType },
      create: { key, description, valueType: valueType as FeatureValueType },
    });
    featureRows.set(key, feature.id);
  }

  for (const [planKey, values] of Object.entries(planValues) as [
    PlanKey,
    Record<string, string>,
  ][]) {
    for (const [featureKey, value] of Object.entries(values)) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: planRows.get(planKey)!,
            featureId: featureRows.get(featureKey)!,
          },
        },
        update: { value },
        create: {
          planId: planRows.get(planKey)!,
          featureId: featureRows.get(featureKey)!,
          value,
        },
      });
    }
  }

  await prisma.guidedFlowDefinition.upsert({
    where: { key_version: { key: 'solution-finder', version: '1.0.0' } },
    update: { active: true },
    create: {
      key: 'solution-finder',
      version: '1.0.0',
      schema: {
        steps: ['company', 'operation', 'management', 'people', 'objectives', 'commercial'],
      },
    },
  });

  let demoMethod = await prisma.technicalMethodDefinition.findFirst({
    where: { organizationId: null, key: DEMO_TECHNICAL_RISK_METHOD.methodKey },
  });
  demoMethod ??= await prisma.technicalMethodDefinition.create({
    data: {
      key: DEMO_TECHNICAL_RISK_METHOD.methodKey,
      name: DEMO_TECHNICAL_RISK_METHOD.methodName,
      description:
        'Método sintético para demostrar evaluaciones técnicas determinísticas y versionadas.',
      category: 'GENERAL_RISK',
      status: 'ACTIVE',
    },
  });
  const existingVersion = await prisma.technicalMethodVersion.findUnique({
    where: {
      methodDefinitionId_version: {
        methodDefinitionId: demoMethod.id,
        version: DEMO_TECHNICAL_RISK_METHOD.methodVersion,
      },
    },
  });
  if (!existingVersion) {
    await prisma.technicalMethodVersion.create({
      data: {
        methodDefinitionId: demoMethod.id,
        version: DEMO_TECHNICAL_RISK_METHOD.methodVersion,
        schema: DEMO_TECHNICAL_RISK_METHOD.schema as Prisma.InputJsonValue,
        calculationKey: DEMO_TECHNICAL_RISK_METHOD.calculationKey,
        regulatory: false,
        isDemo: true,
        disclaimer: DEMO_TECHNICAL_RISK_METHOD.disclaimer,
        country: null,
        status: 'ACTIVE',
      },
    });
  } else if (
    !existingVersion.isDemo ||
    existingVersion.disclaimer !== DEMO_TECHNICAL_RISK_METHOD.disclaimer
  ) {
    await prisma.technicalMethodVersion.update({
      where: { id: existingVersion.id },
      data: {
        isDemo: true,
        disclaimer: DEMO_TECHNICAL_RISK_METHOD.disclaimer,
      },
    });
  }

  const existingApplicabilityPack = await prisma.applicabilityRulePackVersion.findUnique({
    where: {
      key_version: {
        key: DEMO_APPLICABILITY_RULE_PACK.key,
        version: DEMO_APPLICABILITY_RULE_PACK.version,
      },
    },
    select: { id: true },
  });
  if (!existingApplicabilityPack) {
    await prisma.applicabilityRulePackVersion.create({
      data: {
        key: DEMO_APPLICABILITY_RULE_PACK.key,
        name: DEMO_APPLICABILITY_RULE_PACK.name,
        version: DEMO_APPLICABILITY_RULE_PACK.version,
        schema: DEMO_APPLICABILITY_RULE_PACK as Prisma.InputJsonValue,
        status: 'ACTIVE',
        sourceType: DEMO_APPLICABILITY_RULE_PACK.source.type,
        sourceReference: DEMO_APPLICABILITY_RULE_PACK.source.reference,
        regulatory: DEMO_APPLICABILITY_RULE_PACK.regulatory,
        isDemo: DEMO_APPLICABILITY_RULE_PACK.isDemo,
        disclaimer: DEMO_APPLICABILITY_RULE_PACK.disclaimer,
        activatedAt: new Date(),
      },
    });
  }

  const sourceIds = new Map<string, string>();
  for (const source of REGULATORY_SOURCE_V1) {
    const row = await prisma.regulatorySource.upsert({
      where: { sourceKey: source.sourceKey },
      update: {},
      create: {
        id: source.id,
        sourceKey: source.sourceKey,
        countryCode: source.countryCode,
        issuer: source.issuer,
        documentType: source.documentType as RegulatoryDocumentType,
        referenceNumber: source.referenceNumber,
        canonicalTitle: source.canonicalTitle,
      },
      select: { id: true },
    });
    sourceIds.set(source.sourceKey, row.id);
  }

  await prisma.regulatorySourceVersion.createMany({
    data: REGULATORY_SOURCE_V1.map((source, index) => ({
      id: `a2000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sourceId: sourceIds.get(source.sourceKey)!,
      catalogVersion: 1,
      candidateStatus: source.candidateStatus as RegulatoryCandidateStatus,
      officialDocumentLocated: source.officialDocumentLocated,
      officialUrl: source.officialUrl,
      publicationDate: null,
      effectiveFrom: null,
      effectiveTo: null,
      supersessionStatus: source.supersessionStatus as RegulatorySupersessionStatus,
      readyForExtraction: false,
      readyForRules: false,
      reviewNotes: source.reviewNotes,
      recordedAt: REGULATORY_SOURCE_RECORDED_AT,
    })),
    skipDuplicates: true,
  });

  await prisma.regulatorySourceRelationship.createMany({
    data: REGULATORY_SOURCE_RELATIONSHIPS_V1.map((relationship) => ({
      id: relationship.id,
      fromSourceId: sourceIds.get(relationship.fromSourceKey)!,
      toSourceId: sourceIds.get(relationship.toSourceKey)!,
      relationshipType: relationship.relationshipType as RegulatoryRelationshipType,
      reviewStatus: relationship.reviewStatus as RegulatoryRelationshipReviewStatus,
      notes: relationship.notes,
      createdAt: REGULATORY_SOURCE_RECORDED_AT,
    })),
    skipDuplicates: true,
  });

  await provisionAdaptiveDemoReferenceData();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
