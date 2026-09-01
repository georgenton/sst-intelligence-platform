import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('training and competency integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => app.close());

  async function register(label: string) {
    const email = `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`;
    const user = await prisma.user.create({
      data: { email, displayName: label, passwordHash: 'integration-fixture-not-for-login' },
      select: { id: true },
    });
    return { token: await jwt.signAsync({ id: user.id, email, sub: user.id }), userId: user.id };
  }

  async function organization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    return response.body.id as string;
  }

  function api(token: string, organizationId: string) {
    const operation = (method: 'get' | 'post', path: string) => {
      const client = request(app.getHttpServer());
      const pending =
        method === 'get' ? client.get(`/api/v1${path}`) : client.post(`/api/v1${path}`);
      return pending
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
    };
  }

  it('preserves tenant, Worker participation, competency, renewal and queue invariants', async () => {
    const owner = await register('Training Owner');
    const technician = await register('Training Technician');
    const viewer = await register('Training Viewer');
    const orgA = await organization(owner.token, 'Training Organization A');
    const orgB = await organization(owner.token, 'Training Organization B');
    await prisma.organization.updateMany({
      where: { id: { in: [orgA, orgB] } },
      data: { demoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await prisma.membership.createMany({
      data: [
        { organizationId: orgA, userId: technician.userId, role: 'SST_TECHNICIAN' },
        { organizationId: orgA, userId: viewer.userId, role: 'VIEWER' },
      ],
    });
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const worker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Mónica Operadora',
        workCenterId: centerA.id,
        createdById: owner.userId,
      },
    });
    const inactiveWorker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Persona histórica',
        status: 'INACTIVE',
        createdById: owner.userId,
      },
    });

    await api(viewer.token, orgA)
      .post('/training/definitions')
      .send({ title: 'No autorizada', category: 'Interna' })
      .expect(403);
    const definition = await api(owner.token, orgA)
      .post('/training/definitions')
      .send({
        title: `Trabajo seguro ${suffix}`,
        description: 'Definición interna sin afirmar obligación legal.',
        category: 'Seguridad operativa',
        validityDays: 30,
      })
      .expect(201);
    const definitionId = definition.body.id as string;
    const otherDefinition = await api(owner.token, orgB)
      .post('/training/definitions')
      .send({ title: `Definición ajena ${suffix}`, category: 'Interna' })
      .expect(201);
    const definitions = await api(viewer.token, orgA).get('/training/definitions').expect(200);
    expect(definitions.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: definitionId })]),
    );
    expect(definitions.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherDefinition.body.id })]),
    );

    await api(technician.token, orgA)
      .post('/training/requirements')
      .send({
        workerId: worker.id,
        trainingDefinitionId: otherDefinition.body.id,
        reason: 'Cruce tenant no permitido.',
      })
      .expect(400);
    await api(technician.token, orgA)
      .post('/training/requirements')
      .send({
        workerId: inactiveWorker.id,
        trainingDefinitionId: definitionId,
        reason: 'No se asigna trabajo nuevo a una persona inactiva.',
      })
      .expect(400);

    const regulatoryRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `TRAINING_TEST_${suffix.replaceAll(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
        title: 'Requisito candidato de prueba',
        description: 'Fixture de integración; no representa una obligación publicada.',
        editorialStatus: 'DRAFT',
        scopeHint: 'ORGANIZATION',
      },
    });
    const requirement = await api(technician.token, orgA)
      .post('/training/requirements')
      .send({
        workerId: worker.id,
        trainingDefinitionId: definitionId,
        linkedRegulatoryRequirementId: regulatoryRequirement.id,
        reason: 'Necesidad profesional interna documentada.',
        requiredByDate: '2026-01-15',
        renewalRequired: true,
      })
      .expect(201);
    const requirementId = requirement.body.id as string;
    expect(requirement.body.linkedRegulatoryRequirement).toMatchObject({
      id: regulatoryRequirement.id,
      editorialStatus: 'DRAFT',
    });

    const requiredQueue = await api(owner.token, orgA)
      .get('/work-queue?module=TRAINING')
      .expect(200);
    expect(requiredQueue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TRAINING_REQUIRED',
          sourceId: requirementId,
          deepLink: `/app/workers/${worker.id}#training-requirement-${requirementId}`,
          regulatoryContext: expect.objectContaining({ candidate: true }),
        }),
      ]),
    );

    await api(technician.token, orgA)
      .post('/training/sessions')
      .send({
        trainingDefinitionId: definitionId,
        workCenterId: centerB.id,
        scheduledStart: '2026-01-10T08:00:00.000Z',
        scheduledEnd: '2026-01-10T10:00:00.000Z',
        mode: 'IN_PERSON',
      })
      .expect(400);
    const session = await api(technician.token, orgA)
      .post('/training/sessions')
      .send({
        trainingDefinitionId: definitionId,
        workCenterId: centerA.id,
        scheduledStart: '2026-01-10T08:00:00.000Z',
        scheduledEnd: '2026-01-10T10:00:00.000Z',
        mode: 'IN_PERSON',
        instructorName: 'Profesional SST',
        location: 'Sala interna',
      })
      .expect(201);
    const sessionId = session.body.id as string;
    await api(owner.token, orgB).get(`/training/sessions/${sessionId}`).expect(404);
    await api(technician.token, orgA)
      .post(`/training/sessions/${sessionId}/participants`)
      .send({ workerId: inactiveWorker.id })
      .expect(400);
    const participant = await api(technician.token, orgA)
      .post(`/training/sessions/${sessionId}/participants`)
      .send({ workerId: worker.id })
      .expect(201);
    const participantId = participant.body.id as string;
    await api(technician.token, orgA)
      .post(`/training/sessions/${sessionId}/participants`)
      .send({ workerId: worker.id })
      .expect(409);
    expect(
      await prisma.trainingParticipant.findUniqueOrThrow({ where: { id: participantId } }),
    ).toMatchObject({ workerId: worker.id });
    expect(
      await prisma.worker.findUniqueOrThrow({
        where: { id: worker.id },
        select: { linkedUserId: true },
      }),
    ).toEqual({ linkedUserId: null });

    await api(technician.token, orgA)
      .post(`/training/sessions/${sessionId}/participants/${participantId}/attendance`)
      .send({ attendance: 'PRESENT', expectedVersion: 1 })
      .expect(400);
    await api(owner.token, orgA)
      .post(`/training/sessions/${sessionId}/transition`)
      .send({ status: 'SCHEDULED', expectedVersion: 1 })
      .expect(201);
    const attendance = await api(technician.token, orgA)
      .post(`/training/sessions/${sessionId}/participants/${participantId}/attendance`)
      .send({
        attendance: 'PRESENT',
        expectedVersion: 1,
        evidenceNote: 'Lista de asistencia verificada por el actor autenticado.',
      })
      .expect(201);
    expect(attendance.body).toMatchObject({ attendance: 'PRESENT', version: 2 });

    const completionRequest = () =>
      api(technician.token, orgA)
        .post(`/training/sessions/${sessionId}/participants/${participantId}/complete`)
        .send({
          expectedVersion: 2,
          completedAt: '2026-01-10T10:00:00.000Z',
          requirementId,
          completionNote: 'Participación completada sin puntaje numérico.',
          certificateReference: `CERT-${suffix}`,
        });
    const completionResponses = await Promise.all([completionRequest(), completionRequest()]);
    expect(completionResponses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const firstCompletion = completionResponses.find(({ status }) => status === 201)!;
    expect(firstCompletion.body).toMatchObject({
      workerId: worker.id,
      requirementId,
      validUntil: '2026-02-09T00:00:00.000Z',
      renewsCompletionId: null,
    });
    expect(await prisma.workerTrainingCompletion.count({ where: { participantId } })).toBe(1);
    expect(
      await prisma.workerCompetencyRequirement.findUniqueOrThrow({ where: { id: requirementId } }),
    ).toMatchObject({ status: 'FULFILLED' });

    const followUpQueue = await api(owner.token, orgA)
      .get('/work-queue?module=TRAINING')
      .expect(200);
    expect(followUpQueue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TRAINING_DUE',
          sourceId: firstCompletion.body.id,
          status: 'EXPIRED',
        }),
        expect.objectContaining({
          type: 'TRAINING_SESSION_FOLLOW_UP',
          sourceId: sessionId,
          deepLink: `/app/training/sessions/${sessionId}`,
        }),
      ]),
    );
    await api(owner.token, orgA)
      .post(`/training/sessions/${sessionId}/transition`)
      .send({ status: 'COMPLETED', expectedVersion: 2 })
      .expect(201);

    const renewalSession = await api(owner.token, orgA)
      .post('/training/sessions')
      .send({
        trainingDefinitionId: definitionId,
        workCenterId: centerA.id,
        scheduledStart: '2026-08-31T08:00:00.000Z',
        scheduledEnd: '2026-08-31T10:00:00.000Z',
        mode: 'HYBRID',
      })
      .expect(201);
    const renewalSessionId = renewalSession.body.id as string;
    const renewalParticipant = await api(owner.token, orgA)
      .post(`/training/sessions/${renewalSessionId}/participants`)
      .send({ workerId: worker.id })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/training/sessions/${renewalSessionId}/transition`)
      .send({ status: 'SCHEDULED', expectedVersion: 1 })
      .expect(201);
    await api(owner.token, orgA)
      .post(
        `/training/sessions/${renewalSessionId}/participants/${renewalParticipant.body.id}/attendance`,
      )
      .send({ attendance: 'PARTIAL', expectedVersion: 1, evidenceNote: 'Asistencia parcial.' })
      .expect(201);
    const renewal = await api(owner.token, orgA)
      .post(
        `/training/sessions/${renewalSessionId}/participants/${renewalParticipant.body.id}/complete`,
      )
      .send({
        expectedVersion: 2,
        completedAt: '2026-08-31T10:00:00.000Z',
        completionNote: 'Renovación registrada sin alterar el certificado histórico.',
      })
      .expect(201);
    expect(renewal.body.renewsCompletionId).toBe(firstCompletion.body.id);
    expect(
      await prisma.workerTrainingCompletion.count({
        where: { organizationId: orgA, workerId: worker.id, trainingDefinitionId: definitionId },
      }),
    ).toBe(2);

    const workspace = await api(viewer.token, orgA)
      .get(`/training/workers/${worker.id}`)
      .expect(200);
    expect(workspace.body.requirements[0]).toMatchObject({
      id: requirementId,
      competencyStatus: 'DUE_SOON',
      regulatoryContext: expect.objectContaining({ candidate: true }),
    });
    expect(workspace.body.completions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: renewal.body.id, competencyStatus: 'DUE_SOON' }),
        expect.objectContaining({ id: firstCompletion.body.id, competencyStatus: 'HISTORICAL' }),
      ]),
    );
    await api(owner.token, orgB).get(`/training/workers/${worker.id}`).expect(404);

    await prisma.worker.update({ where: { id: worker.id }, data: { status: 'INACTIVE' } });
    await api(viewer.token, orgA)
      .get(`/training/workers/${worker.id}`)
      .expect(200)
      .expect(({ body }) => expect(body.completions).toHaveLength(2));
    await api(owner.token, orgA)
      .post(`/training/sessions/${renewalSessionId}/participants`)
      .send({ workerId: worker.id })
      .expect(400);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: orgA, action: { startsWith: 'TRAINING_' } },
      }),
    ).toBeGreaterThanOrEqual(10);
  });
});
