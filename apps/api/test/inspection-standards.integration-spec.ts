import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('inspection standards integration', () => {
  const demoRiskMethodVersionId = '54000000-0000-4000-8000-000000000001';
  const electricalStandardAId = '57100000-0000-4000-8000-000000000001';
  const electricalStandardBId = '57100000-0000-4000-8000-000000000002';
  const fireStandardAId = '57100000-0000-4000-8000-000000000003';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`,
        displayName: label,
        password: 'inspection-standard-password-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
  }

  async function createOrganization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const organizationId = response.body.id as string;
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId, moduleId: module.id } },
      update: { status: 'ACTIVE', source: 'MANUAL' },
      create: { organizationId, moduleId: module.id, status: 'ACTIVE', source: 'MANUAL' },
    });
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    return { organizationId, centerId: center.id };
  }

  function authorized(token: string, organizationId: string) {
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`/api/v1${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
      post: (path: string) =>
        request(app.getHttpServer())
          .post(`/api/v1${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
      put: (path: string) =>
        request(app.getHttpServer())
          .put(`/api/v1${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
      patch: (path: string) =>
        request(app.getHttpServer())
          .patch(`/api/v1${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
    };
  }

  it('resolves versioned standards by tenant and preserves criterion and finding provenance', async () => {
    const ownerA = await register('Standard Owner A');
    const ownerB = await register('Standard Owner B');
    const viewerA = await register('Standard Viewer A');
    const technicianA = await register('Standard Technician A');
    const orgA = await createOrganization(ownerA.token, 'Standard Organization A');
    const orgB = await createOrganization(ownerB.token, 'Standard Organization B');
    await prisma.membership.createMany({
      data: [
        {
          organizationId: orgA.organizationId,
          userId: viewerA.userId,
          role: 'VIEWER',
          status: 'ACTIVE',
        },
        {
          organizationId: orgA.organizationId,
          userId: technicianA.userId,
          role: 'SST_TECHNICIAN',
          status: 'ACTIVE',
        },
      ],
    });
    const apiA = authorized(ownerA.token, orgA.organizationId);
    const apiB = authorized(ownerB.token, orgB.organizationId);

    await apiA
      .get('/inspection-standards/catalog')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(7);
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: electricalStandardAId,
              inspectionDomain: 'ELECTRICAL',
              source: expect.objectContaining({
                code: 'DEMO_ELECTRICAL_STANDARD_A',
                rightsType: 'DEMO_SYNTHETIC',
                sourceType: 'GLOBAL_REFERENCE',
              }),
            }),
            expect.objectContaining({ id: electricalStandardBId }),
            expect.objectContaining({ id: fireStandardAId }),
            expect.objectContaining({
              versionCode: 'RES-40284-2026-PILOT-1',
              inspectionDomain: 'ELECTRICAL',
              source: expect.objectContaining({
                rightsType: 'PUBLIC_OFFICIAL',
                originCountry: 'Colombia (CO)',
              }),
            }),
            expect.objectContaining({
              versionCode: 'RTQ1-2026-PILOT-1',
              source: expect.objectContaining({
                originCountry: 'Distrito Metropolitano de Quito (EC-UIO)',
              }),
            }),
          ]),
        );
      });

    await authorized(viewerA.token, orgA.organizationId)
      .get('/inspection-standards/organization/policy')
      .expect(200);
    await authorized(viewerA.token, orgA.organizationId)
      .put('/inspection-standards/organization/policy')
      .send({
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: electricalStandardAId }],
      })
      .expect(403);
    await authorized(technicianA.token, orgA.organizationId)
      .put('/inspection-standards/organization/policy')
      .send({
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: electricalStandardAId }],
      })
      .expect(403);

    const policyA1 = await apiA
      .put('/inspection-standards/organization/policy')
      .send({
        reason: 'Primera base sintética para pruebas',
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: electricalStandardAId }],
      })
      .expect(200);
    expect(policyA1.body.version).toBe(1);
    const policyB1 = await apiB
      .put('/inspection-standards/organization/policy')
      .send({
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: electricalStandardBId }],
      })
      .expect(200);
    expect(policyB1.body.version).toBe(1);

    await apiA
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'Electrical without silent fallback',
        inspectionDomain: 'FIRE_PROTECTION',
        riskMethodVersionId: demoRiskMethodVersionId,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('INSPECTION_STANDARD_CONFIGURATION_REQUIRED');
      });

    const createInspection = (
      api: ReturnType<typeof authorized>,
      centerId: string,
      title: string,
    ) =>
      api.post('/inspections').send({
        workCenterId: centerId,
        title,
        inspectionDomain: 'ELECTRICAL',
        riskMethodVersionId: demoRiskMethodVersionId,
      });

    const inspectionA1 = await createInspection(apiA, orgA.centerId, 'Tenant A standard A').expect(
      201,
    );
    const inspectionB1 = await createInspection(apiB, orgB.centerId, 'Tenant B standard B').expect(
      201,
    );
    expect(inspectionA1.body).toMatchObject({
      inspectionDomain: 'ELECTRICAL',
      standardPolicyVersionId: policyA1.body.id,
      standardVersionId: electricalStandardAId,
    });
    expect(inspectionA1.body.criterionResults).toHaveLength(4);
    expect(inspectionB1.body).toMatchObject({
      standardPolicyVersionId: policyB1.body.id,
      standardVersionId: electricalStandardBId,
    });
    expect(inspectionB1.body.criterionResults).toHaveLength(3);

    await apiA
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'No arbitrary standard override',
        inspectionDomain: 'ELECTRICAL',
        standardVersionId: electricalStandardBId,
        riskMethodVersionId: demoRiskMethodVersionId,
      })
      .expect(400);

    const privateStandard = await apiB
      .post('/inspection-standards/organization/sources')
      .send({
        code: 'INTERNAL_ELECTRICAL',
        name: 'Lista eléctrica interna B',
        publisher: 'Organización B',
        rightsType: 'INTERNAL_ORGANIZATION_STANDARD',
        inspectionDomain: 'ELECTRICAL',
        versionCode: '1.0',
        editionLabel: 'Edición interna 1',
        sections: [
          {
            code: 'AREA',
            title: 'Verificación interna',
            displayOrder: 1,
            criteria: [
              {
                code: 'B-PRIVATE-1',
                title: 'La referencia interna se encuentra disponible para el equipo observado.',
                guidance: 'Registre únicamente la referencia interna visible.',
                displayOrder: 1,
                notApplicableAllowed: true,
                required: true,
              },
            ],
          },
        ],
      })
      .expect(201);
    await apiA.get(`/inspection-standards/sources/${privateStandard.body.source.id}`).expect(404);
    await apiA
      .put('/inspection-standards/organization/policy')
      .send({
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: privateStandard.body.id }],
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INSPECTION_STANDARD_NOT_AVAILABLE'));
    await apiB
      .put('/inspection-standards/organization/policy')
      .send({
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: privateStandard.body.id }],
      })
      .expect(200);

    await apiA.post(`/inspections/${inspectionA1.body.id}/start`).expect(201);
    const inspectionADetail = await apiA.get(`/inspections/${inspectionA1.body.id}`).expect(200);
    expect(inspectionADetail.body.standardVersion).toMatchObject({
      id: electricalStandardAId,
      source: { code: 'DEMO_ELECTRICAL_STANDARD_A' },
    });
    expect(inspectionADetail.body.criterionResults).toHaveLength(4);
    const firstCriterionResult = inspectionADetail.body.criterionResults[0];

    await apiA
      .patch(`/inspections/${inspectionA1.body.id}/criteria/${firstCriterionResult.criterion.id}`)
      .send({ outcome: 'NO_APLICA' })
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('INSPECTION_CRITERION_NOT_APPLICABLE_FORBIDDEN'),
      );
    await apiA
      .patch(`/inspections/${inspectionA1.body.id}/criteria/${firstCriterionResult.criterion.id}`)
      .send({ outcome: 'NO_CONFORME' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_INSPECTION_CRITERION_RESULT'));
    await apiA
      .patch(`/inspections/${inspectionA1.body.id}/criteria/${firstCriterionResult.criterion.id}`)
      .send({
        outcome: 'NO_CONFORME',
        note: 'Se observó el cerramiento abierto durante el recorrido sintético.',
        evidenceReferences: ['Fotografía interna demo A-1'],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: firstCriterionResult.id,
          outcome: 'NO_CONFORME',
          note: 'Se observó el cerramiento abierto durante el recorrido sintético.',
          actor: { id: ownerA.userId },
        });
        expect(body.evidenceReferences).toEqual(['Fotografía interna demo A-1']);
      });
    await apiB
      .patch(`/inspections/${inspectionA1.body.id}/criteria/${firstCriterionResult.criterion.id}`)
      .send({ outcome: 'CONFORME' })
      .expect(404);

    const finding = await apiA
      .post(`/inspections/${inspectionA1.body.id}/findings`)
      .send({
        criterionResultId: firstCriterionResult.id,
        title: 'Hallazgo explícito desde criterio sintético',
        description: 'La persona inspectora decidió crear el hallazgo de forma explícita.',
        category: 'ELECTRICAL',
        likelihood: 2,
        consequence: 3,
      })
      .expect(201);
    expect(finding.body).toMatchObject({
      criterionResultId: firstCriterionResult.id,
      riskMethodKey: 'DEMO_5X5',
    });
    await apiA
      .patch(`/inspections/${inspectionA1.body.id}/criteria/${firstCriterionResult.criterion.id}`)
      .send({ outcome: 'CONFORME' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INSPECTION_CRITERION_HAS_FINDING'));
    expect(
      await prisma.inspectionFinding.findUniqueOrThrow({
        where: { id: finding.body.id },
        select: {
          criterionResult: {
            select: {
              criterion: { select: { id: true, standardVersionId: true } },
            },
          },
        },
      }),
    ).toEqual({
      criterionResult: {
        criterion: {
          id: firstCriterionResult.criterion.id,
          standardVersionId: electricalStandardAId,
        },
      },
    });
    await apiA
      .post(`/inspections/${inspectionA1.body.id}/findings`)
      .send({
        criterionResultId: firstCriterionResult.id,
        title: 'Duplicate criterion finding',
        description: 'No debe crearse un segundo hallazgo para el mismo resultado.',
        category: 'ELECTRICAL',
        likelihood: 1,
        consequence: 1,
      })
      .expect(400);

    const policyA2 = await apiA
      .put('/inspection-standards/organization/policy')
      .send({
        reason: 'Cambio controlado de A a B',
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: electricalStandardBId }],
      })
      .expect(200);
    expect(policyA2.body.version).toBe(2);
    const inspectionA2 = await createInspection(apiA, orgA.centerId, 'Tenant A standard B').expect(
      201,
    );
    expect(inspectionA2.body).toMatchObject({
      standardPolicyVersionId: policyA2.body.id,
      standardVersionId: electricalStandardBId,
    });
    expect(inspectionA2.body.criterionResults).toHaveLength(3);

    await apiA
      .get(`/inspections/${inspectionA1.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.standardVersion.id).toBe(electricalStandardAId);
        expect(body.standardPolicyVersion.version).toBe(1);
        expect(body.criterionResults).toHaveLength(4);
        expect(body.criterionResults[0]).toMatchObject({
          outcome: 'NO_CONFORME',
          finding: { id: finding.body.id },
        });
      });
    await apiA
      .get('/inspection-standards/organization/policy')
      .expect(200)
      .expect(({ body }) => {
        expect(body.current.version).toBe(2);
        expect(body.history.map(({ version }: { version: number }) => version)).toEqual([2, 1]);
      });
  });
});
