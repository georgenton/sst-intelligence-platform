import { Prisma, PrismaClient } from '@prisma/client';
import { argon2id, hash } from 'argon2';
import {
  assertStagingBootstrapAllowed,
  requireStagingBootstrapPassword,
} from './staging-bootstrap-policy';
import { RISK_METHOD_REFERENCE_IDS } from '../risk-methodology/risk-method-reference-data';

const prisma = new PrismaClient();

export const STAGING_SYNTHETIC_IDS = {
  organization: '71000000-0000-4000-8000-000000000001',
  owner: '71000000-0000-4000-8000-000000000002',
  workCenterQuito: '71000000-0000-4000-8000-000000000010',
  workCenterCuenca: '71000000-0000-4000-8000-000000000011',
  areaMaintenance: '71000000-0000-4000-8000-000000000020',
  areaWarehouse: '71000000-0000-4000-8000-000000000021',
  worker: '71000000-0000-4000-8000-000000000030',
  inspection: '71000000-0000-4000-8000-000000000040',
  findings: [
    '71000000-0000-4000-8000-000000000041',
    '71000000-0000-4000-8000-000000000042',
    '71000000-0000-4000-8000-000000000043',
  ],
  actions: [
    '71000000-0000-4000-8000-000000000051',
    '71000000-0000-4000-8000-000000000052',
    '71000000-0000-4000-8000-000000000053',
  ],
  repeatedSignal: '71000000-0000-4000-8000-000000000061',
  overdueSignal: '71000000-0000-4000-8000-000000000062',
  ppeCatalogItem: '71000000-0000-4000-8000-000000000070',
  ppeRequirement: '71000000-0000-4000-8000-000000000071',
  ppeIssue: '71000000-0000-4000-8000-000000000072',
  ppeInspection: '71000000-0000-4000-8000-000000000073',
  trainingDefinition: '71000000-0000-4000-8000-000000000080',
  trainingRequirement: '71000000-0000-4000-8000-000000000081',
  trainingSession: '71000000-0000-4000-8000-000000000082',
  trainingParticipant: '71000000-0000-4000-8000-000000000083',
  incident: '71000000-0000-4000-8000-000000000090',
} as const;

const DEMO_EXPIRES_AT = new Date('2099-12-31T23:59:59.000Z');
const FIXTURE_NOW = new Date('2026-09-01T12:00:00.000Z');
const FIXTURE_DUE_AT = new Date('2026-08-25T12:00:00.000Z');

const modules = [
  ['CORE', 'Núcleo SST sintético', 'Configuración base del laboratorio aislado.'],
  [
    'INSPECTIONS_INTELLIGENCE',
    'Inspecciones inteligentes sintéticas',
    'Inspecciones, hallazgos y acciones de prueba.',
  ],
  ['TECHNICAL_RISK', 'Riesgo técnico sintético', 'Valoraciones demostrativas no regulatorias.'],
  ['WORK_PERMITS', 'Permisos sintéticos', 'Flujos operativos del laboratorio.'],
  ['COMPLIANCE', 'Cumplimiento sintético', 'Evidencia pública y de demostración.'],
] as const;

async function upsertModuleDefinitions(transaction: Prisma.TransactionClient) {
  const moduleIds: string[] = [];
  for (const [key, name, description] of modules) {
    const definition = await transaction.moduleDefinition.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name,
        description,
        objective: description,
        demoContent: {
          synthetic: true,
          environment: 'staging',
          label: 'Contenido sintético del laboratorio aislado',
        },
        sortOrder: moduleIds.length,
      },
      select: { id: true },
    });
    moduleIds.push(definition.id);
  }
  return moduleIds;
}

export async function runStagingSyntheticBootstrap(environment = process.env) {
  assertStagingBootstrapAllowed(environment);
  const bootstrapPassword = requireStagingBootstrapPassword(environment);
  const riskMethod = await prisma.riskMethodVersion.findUniqueOrThrow({
    where: { id: RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5 },
    select: { id: true, semanticVersion: true, manifest: true, methodDefinition: true },
  });
  const existingOwner = await prisma.user.findUnique({
    where: { email: 'pilot.owner@synthetic.invalid' },
    select: { id: true, passwordHash: true },
  });
  const passwordHash =
    existingOwner?.passwordHash ??
    (await hash(bootstrapPassword, { type: argon2id, memoryCost: 65_536, timeCost: 3 }));

  await prisma.$transaction(async (transaction) => {
    const moduleIds = await upsertModuleDefinitions(transaction);
    const owner = await transaction.user.upsert({
      where: { email: 'pilot.owner@synthetic.invalid' },
      update: { displayName: 'Responsable SST sintético' },
      create: {
        id: STAGING_SYNTHETIC_IDS.owner,
        email: 'pilot.owner@synthetic.invalid',
        displayName: 'Responsable SST sintético',
        passwordHash,
      },
      select: { id: true },
    });
    const organization = await transaction.organization.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.organization },
      update: {
        name: 'Laboratorio SST Sintético — Staging',
        status: 'DEMO',
        demoExpiresAt: DEMO_EXPIRES_AT,
      },
      create: {
        id: STAGING_SYNTHETIC_IDS.organization,
        name: 'Laboratorio SST Sintético — Staging',
        country: 'Ecuador',
        sector: 'Manufactura sintética para pruebas',
        status: 'DEMO',
        demoStartedAt: FIXTURE_NOW,
        demoExpiresAt: DEMO_EXPIRES_AT,
      },
    });
    await transaction.membership.upsert({
      where: {
        userId_organizationId: { userId: owner.id, organizationId: organization.id },
      },
      update: { role: 'ORG_OWNER', status: 'ACTIVE' },
      create: {
        userId: owner.id,
        organizationId: organization.id,
        role: 'ORG_OWNER',
        status: 'ACTIVE',
      },
    });
    for (const moduleId of moduleIds) {
      await transaction.organizationModule.upsert({
        where: { organizationId_moduleId: { organizationId: organization.id, moduleId } },
        update: { status: 'DEMO', source: 'MANUAL', expiresAt: DEMO_EXPIRES_AT },
        create: {
          organizationId: organization.id,
          moduleId,
          status: 'DEMO',
          source: 'MANUAL',
          startsAt: FIXTURE_NOW,
          expiresAt: DEMO_EXPIRES_AT,
          metadata: { synthetic: true, environment: 'staging' },
        },
      });
    }

    const quito = await transaction.workCenter.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.workCenterQuito },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.workCenterQuito,
        organizationId: organization.id,
        name: 'Planta Quito — Sintética',
        city: 'Quito',
        isDemo: true,
      },
    });
    await transaction.workCenter.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.workCenterCuenca },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.workCenterCuenca,
        organizationId: organization.id,
        name: 'Bodega Cuenca — Sintética',
        city: 'Cuenca',
        isDemo: true,
      },
    });
    const maintenance = await transaction.workArea.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.areaMaintenance },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.areaMaintenance,
        organizationId: organization.id,
        workCenterId: quito.id,
        name: 'Mantenimiento mecánico — Sintético',
      },
    });
    await transaction.workArea.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.areaWarehouse },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.areaWarehouse,
        organizationId: organization.id,
        workCenterId: quito.id,
        name: 'Almacenamiento de insumos — Sintético',
      },
    });
    const worker = await transaction.worker.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.worker },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.worker,
        organizationId: organization.id,
        displayName: 'Persona trabajadora sintética 001',
        internalCode: 'SYN-001',
        workCenterId: quito.id,
        jobTitle: 'Técnico de mantenimiento — posición sintética',
        notes: 'Registro ficticio sin identidad, salud ni información de una persona real.',
        createdById: owner.id,
      },
    });
    const inspection = await transaction.inspection.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.inspection },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.inspection,
        organizationId: organization.id,
        workCenterId: quito.id,
        workAreaId: maintenance.id,
        title: 'Inspección sintética de mantenimiento y almacenamiento',
        description:
          'Actividades ficticias: mantenimiento de equipos y movimiento de insumos. Sin datos reales.',
        inspectorUserId: owner.id,
        status: 'IN_PROGRESS',
        startedAt: FIXTURE_NOW,
        isDemo: true,
        riskMethodVersionId: riskMethod.id,
        riskMethodSnapshot: riskMethod.manifest as Prisma.InputJsonValue,
        inspectionDomain: 'MACHINERY',
      },
    });

    const findingTitles = [
      'Guarda de equipo pendiente de ajuste — sintético',
      'Ruta peatonal parcialmente obstruida — sintético',
      'Señalización temporal incompleta — sintético',
    ];
    for (const [index, findingId] of STAGING_SYNTHETIC_IDS.findings.entries()) {
      const finding = await transaction.inspectionFinding.upsert({
        where: { id: findingId },
        update: {},
        create: {
          id: findingId,
          organizationId: organization.id,
          inspectionId: inspection.id,
          workCenterId: quito.id,
          workAreaId: maintenance.id,
          category: 'Controles operacionales sintéticos',
          title: findingTitles[index]!,
          description:
            'Peligro sintético de contacto mecánico o tránsito interno; requiere verificar controles de ingeniería, demarcación y orden.',
          status: index === 0 ? 'ACTION_IN_PROGRESS' : 'OPEN',
          riskMethodKey: 'DEMO_5X5',
          riskMethodVersion: riskMethod.semanticVersion,
          riskMethodVersionId: riskMethod.id,
          riskMethodSnapshot: riskMethod.manifest as Prisma.InputJsonValue,
          initialMethodInput: { likelihood: 3, consequence: 3, synthetic: true },
          initialMethodResult: { score: 9, level: 'MODERATE', synthetic: true },
          initialLikelihood: 3,
          initialConsequence: 3,
          initialScore: 9,
          initialRiskLevel: 'MODERATE',
          initialResultLabel: 'Moderado — demostrativo',
          recurrenceCount: 3,
          recurrenceStatus: 'REPEATED',
          createdById: owner.id,
          createdAt: FIXTURE_NOW,
        },
      });
      await transaction.correctiveAction.upsert({
        where: { id: STAGING_SYNTHETIC_IDS.actions[index]! },
        update: {},
        create: {
          id: STAGING_SYNTHETIC_IDS.actions[index]!,
          organizationId: organization.id,
          findingId: finding.id,
          title: `${index + 1}. Verificar control operacional sintético`,
          description:
            'Acción ficticia para revisar un control en la fuente, el medio y la organización del trabajo.',
          assignedToUserId: owner.id,
          status: index === 0 ? 'IN_PROGRESS' : 'OPEN',
          priority: index === 0 ? 'HIGH' : 'MEDIUM',
          dueAt: FIXTURE_DUE_AT,
          createdById: owner.id,
          createdAt: FIXTURE_NOW,
        },
      });
    }

    const sourceRecords = {
      synthetic: true,
      findingIds: [...STAGING_SYNTHETIC_IDS.findings],
      actionIds: [...STAGING_SYNTHETIC_IDS.actions],
    } as Prisma.InputJsonValue;
    await transaction.operationalSignal.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.repeatedSignal },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.repeatedSignal,
        organizationId: organization.id,
        workCenterId: quito.id,
        type: 'REPEATED_FINDING',
        fingerprint: 'a'.repeat(64),
        title: 'Repetición sintética de controles operacionales',
        explanation: 'Tres hallazgos ficticios requieren revisión profesional de recurrencia.',
        attention: 'REVIEW',
        ruleKey: 'REPEATED_FINDING_90D_V1',
        ruleVersion: '1.0.0',
        threshold: 3,
        observedCount: 3,
        windowStart: new Date('2026-06-01T00:00:00.000Z'),
        windowEnd: FIXTURE_NOW,
        sourceRecords,
        sourceDigest: 'b'.repeat(64),
        firstDetectedAt: FIXTURE_NOW,
        lastDetectedAt: FIXTURE_NOW,
      },
    });
    await transaction.operationalSignal.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.overdueSignal },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.overdueSignal,
        organizationId: organization.id,
        workCenterId: quito.id,
        type: 'OVERDUE_ACTION_CLUSTER',
        fingerprint: 'c'.repeat(64),
        title: 'Acciones sintéticas vencidas',
        explanation: 'Tres acciones ficticias vencidas requieren priorización en Work Queue.',
        attention: 'PRIORITY_REVIEW',
        ruleKey: 'OVERDUE_ACTION_CLUSTER_V1',
        ruleVersion: '1.0.0',
        threshold: 3,
        observedCount: 3,
        windowStart: new Date('2026-08-01T00:00:00.000Z'),
        windowEnd: FIXTURE_NOW,
        sourceRecords,
        sourceDigest: 'd'.repeat(64),
        firstDetectedAt: FIXTURE_NOW,
        lastDetectedAt: FIXTURE_NOW,
      },
    });

    const ppe = await transaction.ppeCatalogItem.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.ppeCatalogItem },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.ppeCatalogItem,
        organizationId: organization.id,
        name: 'Guantes de protección mecánica — sintéticos',
        category: 'HAND_ARM',
        description: 'Elemento ficticio para verificar el flujo de EPP.',
        referenceStandard: 'Referencia interna sintética; no constituye requisito legal.',
        defaultReplacementIntervalDays: 180,
        createdById: owner.id,
      },
    });
    const ppeRequirement = await transaction.workerPpeRequirement.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.ppeRequirement },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.ppeRequirement,
        organizationId: organization.id,
        workerId: worker.id,
        ppeCatalogItemId: ppe.id,
        workCenterId: quito.id,
        linkedFindingId: STAGING_SYNTHETIC_IDS.findings[0],
        reason: 'Control sintético asociado a tarea ficticia de mantenimiento.',
        assignedById: owner.id,
        assignedAt: FIXTURE_NOW,
      },
    });
    const ppeIssue = await transaction.ppeIssue.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.ppeIssue },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.ppeIssue,
        organizationId: organization.id,
        workerId: worker.id,
        ppeCatalogItemId: ppe.id,
        requirementId: ppeRequirement.id,
        issuedAt: FIXTURE_NOW,
        issuedById: owner.id,
        assetReference: 'SYN-EPP-001',
        expectedReplacementAt: new Date('2027-02-28T12:00:00.000Z'),
        status: 'IN_SERVICE',
        acknowledgementStatus: 'RECORDED',
        acknowledgedAt: FIXTURE_NOW,
        acknowledgedById: owner.id,
        acknowledgementNote: 'Aceptación ficticia para flujo de demostración.',
      },
    });
    await transaction.ppeInspection.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.ppeInspection },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.ppeInspection,
        organizationId: organization.id,
        issueId: ppeIssue.id,
        inspectedAt: FIXTURE_NOW,
        condition: 'SERVICEABLE',
        note: 'Inspección de EPP completamente sintética.',
        recordedById: owner.id,
      },
    });

    const training = await transaction.trainingDefinition.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.trainingDefinition },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.trainingDefinition,
        organizationId: organization.id,
        title: 'Bloqueo y etiquetado — capacitación sintética',
        description: 'Contenido ficticio para validar planificación y seguimiento.',
        category: 'Control de energías peligrosas — sintético',
        validityDays: 365,
        createdById: owner.id,
      },
    });
    await transaction.workerCompetencyRequirement.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.trainingRequirement },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.trainingRequirement,
        organizationId: organization.id,
        workerId: worker.id,
        trainingDefinitionId: training.id,
        reason: 'Requisito interno ficticio para actividad sintética de mantenimiento.',
        requiredByDate: new Date('2026-09-15T00:00:00.000Z'),
        assignedById: owner.id,
        assignedAt: FIXTURE_NOW,
      },
    });
    const trainingSession = await transaction.trainingSession.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.trainingSession },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.trainingSession,
        organizationId: organization.id,
        trainingDefinitionId: training.id,
        workCenterId: quito.id,
        scheduledStart: new Date('2026-09-15T14:00:00.000Z'),
        scheduledEnd: new Date('2026-09-15T16:00:00.000Z'),
        status: 'SCHEDULED',
        instructorName: 'Facilitador sintético',
        location: 'Aula virtual de staging',
        mode: 'VIRTUAL',
        createdById: owner.id,
      },
    });
    await transaction.trainingParticipant.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.trainingParticipant },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.trainingParticipant,
        organizationId: organization.id,
        sessionId: trainingSession.id,
        workerId: worker.id,
      },
    });
    await transaction.incident.upsert({
      where: { id: STAGING_SYNTHETIC_IDS.incident },
      update: {},
      create: {
        id: STAGING_SYNTHETIC_IDS.incident,
        organizationId: organization.id,
        workCenterId: quito.id,
        occurredAt: new Date('2026-08-28T16:00:00.000Z'),
        reportedAt: FIXTURE_NOW,
        reportedByUserId: owner.id,
        title: 'Casi incidente sintético durante traslado de herramienta',
        description:
          'Evento completamente ficticio, sin personas reales ni datos médicos, creado para probar el flujo local.',
        eventType: 'NEAR_MISS',
        status: 'REPORTED',
        activityContext: 'Traslado ficticio de herramienta en área sintética de mantenimiento.',
        linkedInspectionId: inspection.id,
        linkedFindingId: STAGING_SYNTHETIC_IDS.findings[1],
      },
    });
  });

  return {
    environment: 'staging',
    synthetic: true,
    organizationId: STAGING_SYNTHETIC_IDS.organization,
    ownerUserId: existingOwner?.id ?? STAGING_SYNTHETIC_IDS.owner,
    counts: {
      organizations: 1,
      users: 1,
      workCenters: 2,
      areas: 2,
      workers: 1,
      inspections: 1,
      findings: 3,
      actions: 3,
      operationalSignals: 2,
      ppeItems: 1,
      trainingDefinitions: 1,
      incidents: 1,
    },
  };
}

if (require.main === module) {
  runStagingSyntheticBootstrap()
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'STAGING_BOOTSTRAP_FAILED');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
