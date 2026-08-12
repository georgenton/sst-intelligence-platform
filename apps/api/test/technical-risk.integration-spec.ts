import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('technical risk integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => app.close());

  async function createContext(label: string) {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `technical-risk-${label}-${suffix}@example.test`,
        displayName: `Responsable ${label}`,
        password: 'technical-risk-password-123',
      })
      .expect(201);
    const token = register.body.accessToken as string;
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Technical ${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const organizationId = organization.body.id as string;
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'TECHNICAL_RISK' },
      select: { id: true },
    });
    await prisma.organizationModule.create({
      data: {
        organizationId,
        moduleId: module.id,
        status: 'DEMO',
        source: 'MANUAL',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const stored = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { workCenters: { select: { id: true } } },
    });
    return {
      token,
      userId: register.body.user.id as string,
      organizationId,
      workCenterId: stored.workCenters[0]!.id,
    };
  }

  it('calculates, persists, reviews and tenant-scopes a versioned assessment', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `technical-risk-${suffix}@example.test`,
        displayName: 'Responsable técnico',
        password: 'technical-risk-password-123',
      })
      .expect(201);
    const token = register.body.accessToken as string;
    const userId = register.body.user.id as string;
    const orgA = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Technical A ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const orgB = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Technical B ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const orgAId = orgA.body.id as string;
    const orgBId = orgB.body.id as string;
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'TECHNICAL_RISK' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(403);

    for (const organizationId of [orgAId, orgBId]) {
      await prisma.organizationModule.create({
        data: {
          organizationId,
          moduleId: module.id,
          status: 'DEMO',
          source: 'MANUAL',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
    }

    const methods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    expect(methods.body).toHaveLength(1);
    expect(methods.body[0]).toMatchObject({
      key: 'DEMO_TECHNICAL_RISK',
      version: '1.0.0',
      regulatory: false,
      isDemo: true,
    });
    const demoMethodVersionId = methods.body[0].id as string;
    const tenantBMethod = await prisma.technicalMethodDefinition.create({
      data: {
        organizationId: orgBId,
        key: `TENANT_B_DEMO_${suffix}`,
        name: 'Método sintético tenant B',
        description: 'Método aislado para integración.',
        category: 'GENERAL_RISK',
        status: 'ACTIVE',
        versions: {
          create: {
            organizationId: orgBId,
            version: '1.0.0',
            schema: methods.body[0].schema,
            calculationKey: 'DEMO_TECHNICAL_RISK_5X5',
            regulatory: false,
            status: 'ACTIVE',
          },
        },
      },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/methods/${tenantBMethod.key}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/methods/${tenantBMethod.key}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(200);
    const nonDemoMethod = await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/methods/${tenantBMethod.key}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(200);
    expect(nonDemoMethod.body).toMatchObject({
      regulatory: false,
      isDemo: false,
      disclaimer: null,
    });

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: orgAId },
      select: { workCenters: { select: { id: true } } },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        methodVersionId: demoMethodVersionId,
        workCenterId: organization.workCenters[0]!.id,
        title: 'Evaluación de integración',
        score: 1,
      })
      .expect(400);
    expect(created.body).not.toHaveProperty('result');

    const assessment = await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        methodVersionId: demoMethodVersionId,
        workCenterId: organization.workCenters[0]!.id,
        title: 'Evaluación de integración',
      })
      .expect(201);
    const assessmentId = assessment.body.id as string;
    expect(assessment.body.methodSnapshot).toMatchObject({
      methodKey: 'DEMO_TECHNICAL_RISK',
      methodVersion: '1.0.0',
      isDemo: true,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ decision: 'APPROVED' })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(201);

    await request(app.getHttpServer())
      .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/likelihood`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .send({ value: 4 })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .send({ type: 'NOTE', note: 'No debe cruzar tenants.' })
      .expect(404);

    await request(app.getHttpServer())
      .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/unknown`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ value: 4 })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/likelihood`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ value: '4' })
      .expect(400);

    for (const [questionKey, value] of Object.entries({
      activityDescription: 'Actividad sintética de integración',
      likelihood: 4,
      consequence: 5,
    })) {
      await request(app.getHttpServer())
        .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/${questionKey}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', orgAId)
        .send({ value })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        type: 'NOTE',
        questionKey: 'likelihood',
        note: 'Evidencia sintética de integración.',
      })
      .expect(201);

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(201);
    expect(completed.body).toMatchObject({ score: 20, level: 'CRITICAL' });
    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .send({ decision: 'APPROVED' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ASSESSMENT_ALREADY_COMPLETED'));

    await prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgAId } },
      data: { role: 'SST_TECHNICIAN' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ decision: 'APPROVED' })
      .expect(403);
    await prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgAId } },
      data: { role: 'VIEWER' },
    });
    await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        methodVersionId: demoMethodVersionId,
        workCenterId: organization.workCenters[0]!.id,
        title: 'Viewer no puede crear',
      })
      .expect(403);
    await prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgAId } },
      data: { role: 'ORG_OWNER' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ decision: 'APPROVED', comment: 'Revisión profesional de integración.' })
      .expect(201);
    const reviewed = await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    expect(reviewed.body).toMatchObject({ status: 'REVIEWED', result: { score: 20 } });
    expect(reviewed.body.reviews).toHaveLength(1);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: orgAId,
          action: {
            in: [
              'TECHNICAL_ASSESSMENT_CREATED',
              'TECHNICAL_ASSESSMENT_STARTED',
              'TECHNICAL_RESPONSE_SAVED',
              'TECHNICAL_EVIDENCE_ADDED',
              'TECHNICAL_ASSESSMENT_COMPLETED',
              'TECHNICAL_ASSESSMENT_REVIEWED',
            ],
          },
        },
      }),
    ).toBe(8);
  }, 60_000);

  it('enforces validity windows and preserves an explicitly selected method version', async () => {
    const context = await createContext('versions');
    const demoMethods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const baseSchema = demoMethods.body.find(
      (method: { key: string }) => method.key === 'DEMO_TECHNICAL_RISK',
    ).schema;
    const schemaV1 = structuredClone(baseSchema);
    const schemaV2 = structuredClone(baseSchema);
    schemaV1.sections[0].title = 'Contexto versión uno';
    schemaV2.sections[0].title = 'Contexto versión dos';
    const definition = await prisma.technicalMethodDefinition.create({
      data: {
        organizationId: context.organizationId,
        key: `TEST_VERSIONED_METHOD_${suffix}`,
        name: 'Método versionado de prueba',
        description: 'Método no regulatorio y no demostrativo.',
        category: 'GENERAL_RISK',
        status: 'ACTIVE',
      },
    });
    const createVersion = (version: string, data: Record<string, unknown> = {}) =>
      prisma.technicalMethodVersion.create({
        data: {
          organizationId: context.organizationId,
          methodDefinitionId: definition.id,
          version,
          schema: version === '1.0.0' ? schemaV1 : schemaV2,
          calculationKey: 'DEMO_TECHNICAL_RISK_5X5',
          regulatory: false,
          isDemo: false,
          disclaimer: null,
          status: 'ACTIVE',
          ...data,
        },
      });
    const activeV1 = await createVersion('1.0.0');
    const activeV2 = await createVersion('2.0.0');
    const future = await createVersion('3.0.0', {
      validFrom: new Date(Date.now() + 86_400_000),
    });
    const expired = await createVersion('0.9.0', {
      validTo: new Date(Date.now() - 86_400_000),
    });
    const inactive = await createVersion('4.0.0', { status: 'INACTIVE' });

    const catalog = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const visibleIds = new Set(catalog.body.map((method: { id: string }) => method.id));
    expect(visibleIds.has(activeV1.id)).toBe(true);
    expect(visibleIds.has(activeV2.id)).toBe(true);
    expect(visibleIds.has(future.id)).toBe(false);
    expect(visibleIds.has(expired.id)).toBe(false);
    expect(visibleIds.has(inactive.id)).toBe(false);

    for (const unavailable of [future, expired, inactive]) {
      await request(app.getHttpServer())
        .post('/api/v1/technical-risk/assessments')
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId)
        .send({
          methodVersionId: unavailable.id,
          workCenterId: context.workCenterId,
          title: `Versión no disponible ${unavailable.version}`,
        })
        .expect(404);
    }

    await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .send({
        methodKey: definition.key,
        workCenterId: context.workCenterId,
        title: 'Sin versión exacta',
      })
      .expect(400);

    for (const [version, expectedTitle] of [
      [activeV1, 'Contexto versión uno'],
      [activeV2, 'Contexto versión dos'],
    ] as const) {
      const created = await request(app.getHttpServer())
        .post('/api/v1/technical-risk/assessments')
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId)
        .send({
          methodVersionId: version.id,
          workCenterId: context.workCenterId,
          title: `Selección exacta ${version.version}`,
        })
        .expect(201);
      expect(created.body).toMatchObject({
        methodVersionId: version.id,
        methodVersion: version.version,
        isDemo: false,
        methodSnapshot: {
          methodVersion: version.version,
          isDemo: false,
          regulatory: false,
          disclaimer: null,
        },
      });
      expect(created.body.methodSnapshot.schema.sections[0].title).toBe(expectedTitle);
    }
  }, 60_000);

  it('serializes concurrent completion and review decisions without duplicate records', async () => {
    const context = await createContext('concurrency');
    const methods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const methodVersionId = methods.body.find(
      (method: { key: string }) => method.key === 'DEMO_TECHNICAL_RISK',
    ).id as string;
    const headers = (call: SuperTestRequest) =>
      call
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId);

    const createReady = async (title: string) => {
      const created = await headers(
        request(app.getHttpServer()).post('/api/v1/technical-risk/assessments'),
      )
        .send({ methodVersionId, workCenterId: context.workCenterId, title })
        .expect(201);
      const id = created.body.id as string;
      await headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${id}/start`),
      ).expect(201);
      for (const [questionKey, value] of Object.entries({
        activityDescription: 'Actividad concurrente',
        likelihood: 3,
        consequence: 4,
      })) {
        await headers(
          request(app.getHttpServer()).put(
            `/api/v1/technical-risk/assessments/${id}/responses/${questionKey}`,
          ),
        )
          .send({ value })
          .expect(200);
      }
      return id;
    };

    const assessmentId = await createReady('Finalización concurrente');
    const completions = await Promise.all([
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/complete`,
        ),
      ),
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/complete`,
        ),
      ),
    ]);
    expect(completions.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(completions.find(({ status }) => status === 409)?.body.code).toBe(
      'ASSESSMENT_ALREADY_COMPLETED',
    );
    expect(await prisma.technicalAssessmentResult.count({ where: { assessmentId } })).toBe(1);

    const approvals = await Promise.all([
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/review`,
        ),
      ).send({ decision: 'APPROVED' }),
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/review`,
        ),
      ).send({ decision: 'APPROVED' }),
    ]);
    expect(approvals.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(approvals.find(({ status }) => status === 409)?.body.code).toBe(
      'ASSESSMENT_NOT_READY_FOR_REVIEW',
    );
    expect(await prisma.technicalAssessmentReview.count({ where: { assessmentId } })).toBe(1);

    const mixedId = await createReady('Revisión concurrente mixta');
    await headers(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${mixedId}/complete`),
    ).expect(201);
    const mixed = await Promise.all([
      headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${mixedId}/review`),
      ).send({ decision: 'NEEDS_REVISION' }),
      headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${mixedId}/review`),
      ).send({ decision: 'APPROVED' }),
    ]);
    expect(mixed.find(({ body }) => body.decision === 'APPROVED')?.status).toBe(201);
    const stored = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: mixedId },
      include: { reviews: true },
    });
    expect(stored.status).toBe('REVIEWED');
    expect(stored.reviews.filter(({ decision }) => decision === 'APPROVED')).toHaveLength(1);
    for (const revision of stored.reviews.filter(({ decision }) => decision === 'NEEDS_REVISION')) {
      expect(revision.createdAt.getTime()).toBeLessThanOrEqual(stored.reviewedAt!.getTime());
    }
  }, 60_000);
});
