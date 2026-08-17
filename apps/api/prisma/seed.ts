import { PrismaClient, FeatureValueType, ModuleKey, PlanKey, Prisma } from '@prisma/client';
import { DEMO_APPLICABILITY_RULE_PACK, DEMO_TECHNICAL_RISK_METHOD } from '@sst/contracts';

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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
