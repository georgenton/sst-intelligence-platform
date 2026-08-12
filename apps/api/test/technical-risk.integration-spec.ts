import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
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
    });
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

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: orgAId },
      select: { workCenters: { select: { id: true } } },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        methodKey: 'DEMO_TECHNICAL_RISK',
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
        methodKey: 'DEMO_TECHNICAL_RISK',
        workCenterId: organization.workCenters[0]!.id,
        title: 'Evaluación de integración',
      })
      .expect(201);
    const assessmentId = assessment.body.id as string;
    expect(assessment.body.methodSnapshot).toMatchObject({
      methodKey: 'DEMO_TECHNICAL_RISK',
      methodVersion: '1.0.0',
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
        methodKey: 'DEMO_TECHNICAL_RISK',
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
});
