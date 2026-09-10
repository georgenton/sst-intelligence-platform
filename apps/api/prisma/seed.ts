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
import { DEMO_APPLICABILITY_RULE_PACK, DEMO_TECHNICAL_RISK_METHOD } from '@sst/contracts';
import {
  MDT_2024_196_SOURCE_V2,
  REGULATORY_SOURCE_RECORDED_AT,
  REGULATORY_SOURCE_RELATIONSHIPS_V1,
  REGULATORY_SOURCE_V1,
} from './regulatory-source-reference-data';
import { assertPublishedVersionMatches } from '../src/adaptive-configuration/adaptive-reference-integrity';
import { syncGlobalReferenceData } from '../src/reference-data/risk-methodology-reference-sync';
import { provisionRegulatoryReviewCorpus } from './regulatory-review-corpus-reference-data';

const prisma = new PrismaClient();

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
  ['module.incidents', 'Módulo de incidentes', 'BOOLEAN'],
  ['module.ppe', 'Módulo de EPP', 'BOOLEAN'],
  ['module.training', 'Módulo de capacitación', 'BOOLEAN'],
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
    'module.psychosocial': 'true',
    'module.compliance': 'true',
  },
};

async function main() {
  await syncGlobalReferenceData(prisma);
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

  const sourceV2 = MDT_2024_196_SOURCE_V2;
  const sourceV2Payload = {
    candidateStatus: sourceV2.candidateStatus as RegulatoryCandidateStatus,
    officialDocumentLocated: sourceV2.officialDocumentLocated,
    officialUrl: sourceV2.officialUrl,
    officialDocumentSha256: sourceV2.officialDocumentSha256,
    officialDocumentRetrievedAt: new Date(sourceV2.officialDocumentRetrievedAt),
    officialDocumentMediaType: sourceV2.officialDocumentMediaType,
    officialPublicationReference: sourceV2.officialPublicationReference,
    publicationDate: new Date(sourceV2.publicationDate),
    effectiveFrom: sourceV2.effectiveFrom,
    effectiveTo: sourceV2.effectiveTo,
    supersessionStatus: sourceV2.supersessionStatus as RegulatorySupersessionStatus,
    readyForExtraction: sourceV2.readyForExtraction,
    readyForRules: sourceV2.readyForRules,
    reviewNotes: sourceV2.reviewNotes,
    recordedAt: new Date(sourceV2.recordedAt),
  };
  const existingSourceV2 = await prisma.regulatorySourceVersion.findUnique({
    where: {
      sourceId_catalogVersion: {
        sourceId: sourceIds.get(sourceV2.sourceKey)!,
        catalogVersion: sourceV2.catalogVersion,
      },
    },
  });
  if (existingSourceV2) {
    assertPublishedVersionMatches(
      `REGULATORY_SOURCE:${sourceV2.sourceKey}:${sourceV2.catalogVersion}`,
      {
        candidateStatus: existingSourceV2.candidateStatus,
        officialDocumentLocated: existingSourceV2.officialDocumentLocated,
        officialUrl: existingSourceV2.officialUrl,
        officialDocumentSha256: existingSourceV2.officialDocumentSha256,
        officialDocumentRetrievedAt: existingSourceV2.officialDocumentRetrievedAt?.toISOString(),
        officialDocumentMediaType: existingSourceV2.officialDocumentMediaType,
        officialPublicationReference: existingSourceV2.officialPublicationReference,
        publicationDate: existingSourceV2.publicationDate?.toISOString(),
        effectiveFrom: existingSourceV2.effectiveFrom?.toISOString() ?? null,
        effectiveTo: existingSourceV2.effectiveTo?.toISOString() ?? null,
        supersessionStatus: existingSourceV2.supersessionStatus,
        readyForExtraction: existingSourceV2.readyForExtraction,
        readyForRules: existingSourceV2.readyForRules,
        reviewNotes: existingSourceV2.reviewNotes,
        recordedAt: existingSourceV2.recordedAt.toISOString(),
      },
      {
        ...sourceV2Payload,
        officialDocumentRetrievedAt: sourceV2Payload.officialDocumentRetrievedAt.toISOString(),
        publicationDate: sourceV2Payload.publicationDate.toISOString(),
        recordedAt: sourceV2Payload.recordedAt.toISOString(),
      },
    );
  } else {
    await prisma.regulatorySourceVersion.create({
      data: {
        id: sourceV2.id,
        sourceId: sourceIds.get(sourceV2.sourceKey)!,
        catalogVersion: sourceV2.catalogVersion,
        ...sourceV2Payload,
      },
    });
  }

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

  await provisionRegulatoryReviewCorpus(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
