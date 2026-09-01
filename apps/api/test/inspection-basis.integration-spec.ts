import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Inspection Basis V2 integration', () => {
  const methodId = '54000000-0000-4000-8000-000000000001';
  const standardA = '57100000-0000-4000-8000-000000000001';
  const standardB = '57100000-0000-4000-8000-000000000002';
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

  afterAll(async () => app.close());

  async function actor(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label}-${suffix}@example.test`,
        displayName: label,
        password: 'inspection-basis-password-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
  }

  async function organization(token: string, name: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${name} ${suffix}`, country: 'Ecuador' })
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
    return { id: organizationId, centerId: center.id };
  }

  function api(token: string, organizationId: string) {
    const operation = (method: 'get' | 'post' | 'put', path: string) => {
      const client = request(app.getHttpServer());
      const pending =
        method === 'get'
          ? client.get(`/api/v1${path}`)
          : method === 'post'
            ? client.post(`/api/v1${path}`)
            : client.put(`/api/v1${path}`);
      return pending
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
      put: (path: string) => operation('put', path),
    };
  }

  it('versions multi-source bases and preserves basis and legacy inspection history', async () => {
    const ownerA = await actor('basis-owner-a');
    const ownerB = await actor('basis-owner-b');
    const viewer = await actor('basis-viewer-a');
    const orgA = await organization(ownerA.token, 'Basis A');
    const orgB = await organization(ownerB.token, 'Basis B');
    await prisma.membership.create({
      data: { organizationId: orgA.id, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });
    const units = await prisma.regulatoryUnit.findMany({
      take: 2,
      orderBy: [{ sourceVersionId: 'asc' }, { ordinal: 'asc' }],
      select: { id: true },
    });
    expect(units).toHaveLength(2);
    const composition = {
      name: 'Base eléctrica multifuente',
      inspectionDomain: 'ELECTRICAL',
      reason: 'Composición controlada para integración',
      technicalSources: [
        { standardVersionId: standardA, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
        { standardVersionId: standardB, role: 'SUPPLEMENTAL_TECHNICAL', displayOrder: 2 },
      ],
      regulatoryUnits: units.map(({ id }, index) => ({
        regulatoryUnitId: id,
        displayOrder: index + 1,
      })),
    };

    await api(viewer.token, orgA.id).post('/inspection-bases').send(composition).expect(403);
    await api(ownerA.token, orgA.id)
      .post('/inspection-bases')
      .send({
        ...composition,
        technicalSources: [
          { standardVersionId: standardA, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
          { standardVersionId: standardB, role: 'PRIMARY_TECHNICAL', displayOrder: 2 },
        ],
      })
      .expect(400);
    await api(ownerA.token, orgA.id)
      .post('/inspection-bases')
      .send({
        ...composition,
        technicalSources: [
          { standardVersionId: standardA, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
          { standardVersionId: standardA, role: 'SUPPLEMENTAL_TECHNICAL', displayOrder: 2 },
        ],
      })
      .expect(400);

    const draftV1 = await api(ownerA.token, orgA.id)
      .post('/inspection-bases')
      .send(composition)
      .expect(201);
    expect(draftV1.body).toMatchObject({
      version: 1,
      status: 'DRAFT',
      technicalSources: [
        expect.objectContaining({ role: 'PRIMARY_TECHNICAL' }),
        expect.objectContaining({ role: 'SUPPLEMENTAL_TECHNICAL' }),
      ],
    });
    expect(draftV1.body.regulatoryUnits).toHaveLength(2);
    await api(ownerB.token, orgB.id)
      .get(`/inspection-bases/versions/${draftV1.body.id as string}`)
      .expect(404);

    const activeV1 = await api(ownerA.token, orgA.id)
      .post(`/inspection-bases/versions/${draftV1.body.id as string}/activate`)
      .expect(201);
    expect(activeV1.body.status).toBe('ACTIVE');

    const inspectionV1 = await api(ownerA.token, orgA.id)
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'Inspection Basis snapshot v1',
        inspectionDomain: 'ELECTRICAL',
        riskMethodVersionId: methodId,
      })
      .expect(201);
    expect(inspectionV1.body).toMatchObject({
      inspectionBasisVersionId: draftV1.body.id,
      standardVersionId: standardA,
      standardPolicyVersionId: null,
    });
    expect(inspectionV1.body.criterionResults).toHaveLength(7);

    const definitionId = draftV1.body.definition.id as string;
    const draftV2 = await api(ownerA.token, orgA.id)
      .post(`/inspection-bases/${definitionId}/versions`)
      .send({
        reason: 'Segunda versión controlada',
        technicalSources: [
          { standardVersionId: standardB, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
        ],
        regulatoryUnits: [],
      })
      .expect(201);
    expect(draftV2.body.version).toBe(2);
    await api(ownerA.token, orgA.id)
      .post(`/inspection-bases/versions/${draftV2.body.id as string}/activate`)
      .expect(201);
    await api(ownerA.token, orgA.id)
      .get(`/inspection-bases/versions/${draftV1.body.id as string}`)
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('RETIRED'));

    const inspectionV2 = await api(ownerA.token, orgA.id)
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'Inspection Basis snapshot v2',
        inspectionDomain: 'ELECTRICAL',
        riskMethodVersionId: methodId,
      })
      .expect(201);
    expect(inspectionV2.body).toMatchObject({
      inspectionBasisVersionId: draftV2.body.id,
      standardVersionId: standardB,
    });
    expect(inspectionV2.body.criterionResults).toHaveLength(3);
    await api(ownerA.token, orgA.id)
      .get(`/inspections/${inspectionV1.body.id as string}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.inspectionBasisVersion.id).toBe(draftV1.body.id);
        expect(body.inspectionBasisVersion.status).toBe('RETIRED');
        expect(body.criterionResults).toHaveLength(7);
        expect(body.inspectionBasisSnapshot.contentDigest).toBe(activeV1.body.contentDigest);
      });

    await api(ownerB.token, orgB.id)
      .put('/inspection-standards/organization/policy')
      .send({
        reason: 'Legacy direct-standard compatibility',
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: standardA }],
      })
      .expect(200);
    const legacy = await api(ownerB.token, orgB.id)
      .post('/inspections')
      .send({
        workCenterId: orgB.centerId,
        title: 'Legacy standard inspection remains valid',
        inspectionDomain: 'ELECTRICAL',
        riskMethodVersionId: methodId,
      })
      .expect(201);
    expect(legacy.body.inspectionBasisVersionId).toBeNull();
    expect(legacy.body.standardVersionId).toBe(standardA);
    expect(await prisma.inspectionBasisVersion.count({ where: { organizationId: orgB.id } })).toBe(
      0,
    );
    await api(ownerB.token, orgB.id).get('/inspection-bases/active/ELECTRICAL').expect(404);

    const [concurrentDraftA, concurrentDraftB] = await Promise.all([
      api(ownerA.token, orgA.id)
        .post('/inspection-bases')
        .send({
          name: `Base concurrente A ${suffix}`,
          inspectionDomain: 'ELECTRICAL',
          technicalSources: [
            { standardVersionId: standardA, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
          ],
        })
        .expect(201),
      api(ownerA.token, orgA.id)
        .post('/inspection-bases')
        .send({
          name: `Base concurrente B ${suffix}`,
          inspectionDomain: 'ELECTRICAL',
          technicalSources: [
            { standardVersionId: standardB, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
          ],
        })
        .expect(201),
    ]);
    await Promise.all([
      api(ownerA.token, orgA.id)
        .post(`/inspection-bases/versions/${concurrentDraftA.body.id as string}/activate`)
        .expect(201),
      api(ownerA.token, orgA.id)
        .post(`/inspection-bases/versions/${concurrentDraftB.body.id as string}/activate`)
        .expect(201),
    ]);
    expect(
      await prisma.inspectionBasisVersion.count({
        where: { organizationId: orgA.id, inspectionDomain: 'ELECTRICAL', status: 'ACTIVE' },
      }),
    ).toBe(1);
  });
});
