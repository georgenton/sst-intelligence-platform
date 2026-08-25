import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RISK_METHOD_REFERENCE_IDS } from '../src/risk-methodology/risk-method-reference-data';

describe('risk methodology runtime integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let organizationId: string;
  let workCenterId: string;
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
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `risk-method-${suffix}@example.test`,
        displayName: 'Risk Method Owner',
        password: 'risk-method-password-strong-123',
      })
      .expect(201);
    token = registered.body.accessToken as string;
    userId = registered.body.user.id as string;
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Risk Method Org ${suffix}`, country: 'Ecuador' })
      .expect(201);
    organizationId = organization.body.id as string;
    const moduleDefinition = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.upsert({
      where: {
        organizationId_moduleId: { organizationId, moduleId: moduleDefinition.id },
      },
      update: { status: 'ACTIVE', source: 'MANUAL' },
      create: {
        organizationId,
        moduleId: moduleDefinition.id,
        status: 'ACTIVE',
        source: 'MANUAL',
      },
    });
    workCenterId = (await prisma.workCenter.findFirstOrThrow({ where: { organizationId } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const authorized = () => ({
    Authorization: `Bearer ${token}`,
    'x-organization-id': organizationId,
  });

  async function createStartedInspection(methodVersionId: string, title: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(authorized())
      .send({ workCenterId, title, riskMethodVersionId: methodVersionId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${created.body.id as string}/start`)
      .set(authorized())
      .expect(201);
    return created.body.id as string;
  }

  it('exposes the authenticated global catalog without legal endorsement', async () => {
    await request(app.getHttpServer()).get('/api/v1/risk-methods').expect(401);
    const response = await request(app.getHttpServer())
      .get('/api/v1/risk-methods')
      .set(authorized())
      .expect(200);
    expect(response.body).toHaveLength(3);
    expect(response.body.map((method: { methodKey: string }) => method.methodKey).sort()).toEqual([
      'DEMO_5X5',
      'GTC45_2010',
      'GUIDED_5X5',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('Normativa obligatoria Ecuador');
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          methodKey: 'GTC45_2010',
          publicationStatus: 'CANDIDATE',
          regulatory: false,
        }),
      ]),
    );
  });

  it('binds guided initial and residual valuation to the same exact version', async () => {
    const inspectionId = await createStartedInspection(
      RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
      `Guided inspection ${suffix}`,
    );
    const finding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings`)
      .set(authorized())
      .send({
        title: 'Exposición guiada',
        description: 'Fixture determinístico sin datos personales.',
        category: 'ELECTRICAL',
        methodInput: {
          probability: 4,
          severity: 5,
          severityDimension: 'HUMAN',
          checkedProbabilityCueKeys: ['FREQUENT_EXPOSURE'],
          checkedSeverityCueKeys: ['FATALITY_POSSIBLE'],
          selectionRationale:
            'La exposición es frecuente y la consecuencia humana puede ser fatal.',
        },
      })
      .expect(201);
    expect(finding.body).toMatchObject({
      riskMethodKey: 'GUIDED_5X5',
      riskMethodVersion: '1.0.0',
      riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
      initialScore: 20,
      initialRiskLevel: 'CRITICAL',
    });
    await expect(
      prisma.inspection.update({
        where: { id: inspectionId },
        data: { riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010 },
      }),
    ).rejects.toThrow(/INSPECTION_RISK_METHOD_LOCKED_AFTER_VALUATION/);
    const action = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions`)
      .set(authorized())
      .send({ title: 'Aislar el peligro', assignedToUserId: userId, priority: 'URGENT' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions/${action.body.id as string}/evidence`,
      )
      .set(authorized())
      .send({ type: 'NOTE', note: 'Control aplicado y verificado.' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions/${action.body.id as string}/complete`,
      )
      .set(authorized())
      .expect(201);
    const residualInput = {
      probability: 1,
      severity: 2,
      severityDimension: 'HUMAN',
      checkedProbabilityCueKeys: ['STRONG_INDEPENDENT_CONTROLS'],
      checkedSeverityCueKeys: ['SHORT_RECOVERY'],
      selectionRationale: 'Los controles posteriores reducen exposición y consecuencia razonable.',
    };
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/verify`)
      .set(authorized())
      .send({
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        methodInput: residualInput,
        basis: 'RECORDED_EVIDENCE',
        selfVerificationAcknowledged: true,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('RESIDUAL_METHOD_VERSION_MISMATCH'));
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/verify`)
      .set(authorized())
      .send({
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
        methodInput: residualInput,
        basis: 'RECORDED_EVIDENCE',
        selfVerificationAcknowledged: true,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.residualMethodVersionId).toBe(RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5);
        expect(body.residualScore).toBe(2);
        expect(body.residualRationale).toBe(residualInput.selectionRationale);
      });
  });

  it('executes canonical GTC45 including the LOW direct-IV path without ND zero', async () => {
    const inspectionId = await createStartedInspection(
      RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      `GTC inspection ${suffix}`,
    );
    const finding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings`)
      .set(authorized())
      .send({
        title: 'Peligro con deficiencia baja',
        description: 'Caso sintético para el tratamiento especial documentado.',
        category: 'MECHANICAL',
        methodInput: {
          deficiency: 'LOW',
          exposure: 4,
          consequence: 100,
          existingControls: { source: 'Resguardo fijo verificado.' },
          guidanceResponses: { CONTROL_EFFECTIVENESS: 'Cobertura observada en campo.' },
          professionalRationale: 'La deficiencia baja se seleccionó por el control observado.',
        },
      })
      .expect(201);
    expect(finding.body).toMatchObject({
      riskMethodKey: 'GTC45_2010',
      riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      initialLikelihood: null,
      initialScore: null,
      initialRiskLevel: null,
      initialResultLabel: 'Nivel de intervención IV',
      guidanceVersionId: RISK_METHOD_REFERENCE_IDS.guidance.ANITA_GTC45,
    });
    expect(finding.body.initialMethodResult).toMatchObject({
      deficiencyValue: null,
      probabilityValue: null,
      riskValue: null,
      riskLevel: 'IV',
      specialHandling: 'LOW_DEFICIENCY_DIRECT_TO_IV',
    });
  });

  it('rejects unavailable versions and protects published reference rows in the database', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(authorized())
      .send({
        workCenterId,
        title: 'Unavailable method',
        riskMethodVersionId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('RISK_METHOD_UNAVAILABLE'));
    await expect(
      prisma.riskMethodVersion.update({
        where: { id: RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5 },
        data: { displayName: 'Mutation forbidden' },
      }),
    ).rejects.toThrow(/PUBLISHED_REFERENCE_IMMUTABLE/);
  });
});
