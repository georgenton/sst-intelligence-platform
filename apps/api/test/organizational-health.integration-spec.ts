import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { syncGlobalReferenceData } from '../src/reference-data/risk-methodology-reference-sync';

describe('B3 organizational health and psychosocial foundation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const admin = new PrismaService();
  const schema = `b3_health_${randomUUID().replaceAll('-', '')}`;
  let owner: { id: string; token: string };
  let organizationId: string;

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', schema);
    const result = spawnSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        join(__dirname, '../prisma/schema.prisma'),
      ],
      { env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error('B3 disposable schema migration failed');
    prisma = new PrismaService({ datasources: { db: { url: url.toString() } } });
    await syncGlobalReferenceData(prisma);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `b3-owner-${randomUUID()}@example.test`,
        displayName: 'B3 Synthetic Owner',
        password: `${randomUUID()}${randomUUID()}`,
      })
      .expect(201);
    owner = { id: registered.body.user.id, token: registered.body.accessToken };
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'B3 Synthetic Ecuador', country: 'Ecuador', sector: 'Servicios' })
      .expect(201);
    organizationId = organization.body.id;
    const psychosocialModule = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'PSYCHOSOCIAL' },
      select: { id: true },
    });
    await prisma.organizationModule.create({
      data: { organizationId, moduleId: psychosocialModule.id, status: 'ACTIVE', source: 'MANUAL' },
    });
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    else if (prisma) await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  });

  const auth = () => ({
    Authorization: `Bearer ${owner.token}`,
    'x-organization-id': organizationId,
  });

  it('creates a tenant-scoped occupational program, activity evidence and audit trail', async () => {
    const program = await request(app.getHttpServer())
      .post('/api/v1/occupational-health/programs')
      .set(auth())
      .send({
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        title: 'Programa preventivo B3',
        scopeSummary: 'Coordinación preventiva organizacional.',
      })
      .expect(201);
    const activity = await request(app.getHttpServer())
      .post(`/api/v1/occupational-health/programs/${program.body.id}/activities`)
      .set(auth())
      .send({
        componentKey: 'PREVENTIVE_COORDINATION',
        title: 'Revisión preventiva trimestral',
        evidenceType: 'NOTE',
        evidenceNote: 'Acta sintética de coordinación.',
      })
      .expect(201);
    expect(activity.body.activities).toHaveLength(1);
    expect(activity.body.activities[0]).toMatchObject({
      componentKey: 'PREVENTIVE_COORDINATION',
      evidenceType: 'NOTE',
    });
    expect(JSON.stringify(activity.body)).not.toMatch(/diagnosis|workerId|medical|answers/i);
    expect(
      await prisma.auditLog.count({
        where: { organizationId, entityId: activity.body.activities[0].id },
      }),
    ).toBe(2);
  });

  it('requires the entitlement and preserves aggregate-only psychosocial data', async () => {
    const program = await request(app.getHttpServer())
      .post('/api/v1/psychosocial/programs')
      .set(auth())
      .send({
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        title: 'Programa psicosocial B3',
      })
      .expect(201);
    const cycle = await request(app.getHttpServer())
      .post(`/api/v1/psychosocial/programs/${program.body.id}/cycles`)
      .set(auth())
      .send({
        instrumentName: 'Cuestionario de Riesgo Psicosocial',
        instrumentVersion: '2026',
        instrumentProvider: 'Ministerio del Trabajo',
        instrumentSourceType: 'MINISTRY_QUESTIONNAIRE',
        targetPopulationCount: 25,
        participantCount: 20,
        evidenceNote: 'Informe agregado sintético.',
      })
      .expect(201);
    const savedCycle = cycle.body.assessmentCycles[0];
    expect(savedCycle).toMatchObject({ targetPopulationCount: 25, participantCount: 20 });
    expect(JSON.stringify(savedCycle)).not.toMatch(/workerId|answers|individualScore|diagnosis/i);

    const secondUser = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `b3-viewer-${randomUUID()}@example.test`,
        displayName: 'B3 Synthetic Viewer',
        password: `${randomUUID()}${randomUUID()}`,
      })
      .expect(201);
    await prisma.membership.update({
      where: { userId_organizationId: { userId: owner.id, organizationId } },
      data: { role: 'VIEWER' },
    });
    await request(app.getHttpServer())
      .post('/api/v1/psychosocial/programs')
      .set({
        Authorization: `Bearer ${secondUser.body.accessToken}`,
        'x-organization-id': organizationId,
      })
      .send({ periodStart: '2027-01-01', periodEnd: '2027-12-31', title: 'No autorizado' })
      .expect(403);
    await prisma.membership.update({
      where: { userId_organizationId: { userId: owner.id, organizationId } },
      data: { role: 'ORG_OWNER' },
    });
  });

  it('links a cycle to an existing Plan Operativo item only by explicit action', async () => {
    const program = await prisma.psychosocialProgram.findFirstOrThrow({
      where: { organizationId },
    });
    const cycle = await prisma.psychosocialAssessmentCycle.create({
      data: {
        organizationId,
        programId: program.id,
        instrumentName: 'Instrumento externo declarado',
        instrumentSourceType: 'EXTERNAL_VALIDATED',
        targetPopulationCount: 10,
        participantCount: 8,
        createdById: owner.id,
      },
    });
    const plan = await prisma.operationalPlan.create({ data: { organizationId, createdById: owner.id } });
    const version = await prisma.operationalPlanVersion.create({
      data: {
        planId: plan.id,
        organizationId,
        version: 1,
        origin: 'MANUAL',
        name: 'Plan B3',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        contentDigest: 'sha256:b3-test-plan',
        createdById: owner.id,
      },
    });
    const item = await prisma.operationalPlanItem.create({
      data: {
        organizationId,
        planVersionId: version.id,
        title: 'Intervención preventiva confirmada',
        provenanceType: 'MANUAL',
        displayOrder: 1,
      },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/psychosocial/cycles/${cycle.id}/plan-item`)
      .set(auth())
      .send({ operationalPlanItemId: item.id })
      .expect(201);
    const linked = await prisma.psychosocialAssessmentCycle.findUniqueOrThrow({
      where: { id: cycle.id },
    });
    expect(linked.linkedOperationalPlanItemId).toBe(item.id);
    expect(
      await prisma.auditLog.count({
        where: { organizationId, entityId: cycle.id, action: 'PSYCHOSOCIAL_CYCLE_PLAN_ITEM_LINKED' },
      }),
    ).toBe(1);
  });
});
