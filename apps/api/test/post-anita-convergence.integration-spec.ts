import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('post-Anita product convergence integration', () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const riskMethodVersionId = '54000000-0000-4000-8000-000000000001';
  const standardVersionId = '57100000-0000-4000-8000-000000000001';
  const outletResourceId = '71200000-0000-4000-8000-000000000001';
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

  async function register(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`,
        displayName: label,
        password: 'post-anita-convergence-password-123',
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
    const inspectionsModule = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.upsert({
      where: {
        organizationId_moduleId: { organizationId, moduleId: inspectionsModule.id },
      },
      update: { status: 'ACTIVE', source: 'MANUAL' },
      create: {
        organizationId,
        moduleId: inspectionsModule.id,
        status: 'ACTIVE',
        source: 'MANUAL',
      },
    });
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    return { organizationId, centerId: center.id };
  }

  function api(token: string, organizationId: string) {
    const authorize = <T extends SuperTestRequest>(operation: T) =>
      operation.set('Authorization', `Bearer ${token}`).set('x-organization-id', organizationId);
    return {
      get: (path: string) => authorize(request(app.getHttpServer()).get(`/api/v1${path}`)),
      post: (path: string) => authorize(request(app.getHttpServer()).post(`/api/v1${path}`)),
      put: (path: string) => authorize(request(app.getHttpServer()).put(`/api/v1${path}`)),
    };
  }

  it('keeps plans canonical, tenant-scoped, versioned and attention-only in Work Queue', async () => {
    const ownerA = await register('Plan Owner A');
    const ownerB = await register('Plan Owner B');
    const memberA = await register('Plan Member A');
    const orgA = await createOrganization(ownerA.token, 'Plan Organization A');
    const orgB = await createOrganization(ownerB.token, 'Plan Organization B');
    const membership = await prisma.membership.create({
      data: {
        organizationId: orgA.organizationId,
        userId: memberA.userId,
        role: 'VIEWER',
        status: 'ACTIVE',
      },
    });
    const ownerApi = api(ownerA.token, orgA.organizationId);
    const viewerApi = api(memberA.token, orgA.organizationId);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const body = {
      name: 'Plan operativo sintético',
      description: 'Plan estructurado para validar el recorrido de demostración.',
      periodStart: '2026-09-01',
      periodEnd: '2027-08-31',
      responsibleUserId: ownerA.userId,
      provenance: { source: 'DEMO_SYNTHETIC' },
      items: [
        {
          title: 'Corregir hallazgo eléctrico',
          dueAt: tomorrow,
          priority: 'HIGH',
          workCenterId: orgA.centerId,
          responsibleUserId: ownerA.userId,
          evidenceReferences: ['REF-DEMO-001'],
          provenanceType: 'MANUAL',
          provenanceReference: 'Plan existente',
          provenanceSnapshot: { source: 'DEMO_SYNTHETIC' },
        },
        {
          title: 'Actividad futura sin atención',
          dueAt: '2099-12-31',
          priority: 'LOW',
          provenanceType: 'MANUAL',
          provenanceSnapshot: { source: 'DEMO_SYNTHETIC' },
        },
      ],
    };

    await viewerApi.post('/operational-plans').send(body).expect(403);
    const created = await ownerApi.post('/operational-plans').send(body).expect(201);
    expect(created.body.versions[0]).toMatchObject({
      status: 'DRAFT',
      origin: 'MANUAL',
      version: 1,
    });
    expect(created.body.versions[0].items).toHaveLength(2);

    await api(ownerB.token, orgB.organizationId)
      .get(`/operational-plans/${created.body.id as string}`)
      .expect(404);
    await api(ownerB.token, orgA.organizationId).get('/operational-plans').expect(403);

    await ownerApi
      .post(
        `/operational-plans/${created.body.id as string}/versions/${created.body.versions[0].id as string}/activate`,
      )
      .expect(201);
    const queue = await ownerApi.get('/work-queue?module=PLAN').expect(200);
    expect(queue.body.items).toEqual([
      expect.objectContaining({
        type: 'OPERATIONAL_PLAN_ITEM',
        title: 'Corregir hallazgo eléctrico',
        deepLink: expect.stringMatching(
          new RegExp(`^/app/plans/${created.body.id as string}#item-`),
        ),
      }),
    ]);
    expect(queue.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Actividad futura sin atención' })]),
    );

    const highItem = created.body.versions[0].items[0];
    await expect(
      prisma.operationalPlanItem.update({
        where: { id: highItem.id as string },
        data: { title: 'Mutación prohibida' },
      }),
    ).rejects.toThrow('POST_ANITA_IMMUTABLE_PLAN_ITEM');
    await ownerApi
      .post(`/operational-plans/items/${highItem.id as string}/transition`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 })
      .expect(201)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'IN_PROGRESS', version: 2 }));

    const versioned = await ownerApi
      .post(`/operational-plans/${created.body.id as string}/versions`)
      .send({ ...body, name: 'Plan operativo sintético revisado' })
      .expect(201);
    expect(versioned.body.versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: 2, status: 'DRAFT' }),
        expect.objectContaining({ version: 1, status: 'ACTIVE' }),
      ]),
    );
    const secondVersion = versioned.body.versions.find(
      (candidate: { version: number }) => candidate.version === 2,
    );
    await ownerApi
      .post(
        `/operational-plans/${created.body.id as string}/versions/${secondVersion.id as string}/activate`,
      )
      .expect(201)
      .expect(({ body }) => {
        expect(body.versions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ version: 2, status: 'ACTIVE' }),
            expect.objectContaining({ version: 1, status: 'RETIRED' }),
          ]),
        );
      });
    await ownerApi
      .post(`/operational-plans/items/${highItem.id as string}/transition`)
      .send({ status: 'COMPLETED', expectedVersion: 2 })
      .expect(404);

    await ownerApi
      .post('/operational-execution/obligations')
      .send({
        title: 'Necesidad operativa sintética conocida',
        originType: 'MANUAL',
        manualReference: 'DEMO-SYNTHETIC',
        priority: 'MEDIUM',
      })
      .expect(201);
    const generated = await ownerApi
      .post('/operational-plans/generate-draft')
      .send({
        name: 'Plan sugerido determinista',
        periodStart: '2026-09-01',
        periodEnd: '2027-08-31',
      })
      .expect(201);
    expect(generated.body.versions[0]).toMatchObject({ origin: 'DETERMINISTIC_DRAFT' });
    expect(generated.body.versions[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provenanceType: 'OBLIGATION_EXECUTION',
          provenanceReference: expect.any(String),
        }),
      ]),
    );

    await prisma.membership.update({
      where: { id: membership.id },
      data: { role: 'SST_MANAGER' },
    });
    await viewerApi
      .post('/operational-plans')
      .send({ ...body, name: 'Autorización resuelta desde membership actual' })
      .expect(201);
  });

  it('snapshots exact resource mappings, preserves legacy records and isolates private scope', async () => {
    const ownerA = await register('Resource Owner A');
    const ownerB = await register('Resource Owner B');
    const orgA = await createOrganization(ownerA.token, 'Resource Organization A');
    const orgB = await createOrganization(ownerB.token, 'Resource Organization B');
    const ownerApi = api(ownerA.token, orgA.organizationId);

    const globalCatalog = await ownerApi
      .get(`/inspection-resources?domain=ELECTRICAL&standardVersionId=${standardVersionId}`)
      .expect(200);
    expect(globalCatalog.body.resources).toHaveLength(21);
    expect(globalCatalog.body.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: outletResourceId, code: 'OUTLET', level: 'MINOR' }),
        expect.objectContaining({ code: 'PANEL', level: 'MAJOR' }),
        expect.objectContaining({ code: 'GENERATOR', level: 'INDUSTRIAL_SERVICE' }),
      ]),
    );

    await ownerApi
      .put('/inspection-standards/organization/policy')
      .send({
        reason: 'Base sintética para Resource Scope V0',
        bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId }],
      })
      .expect(200);

    const legacy = await ownerApi
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'Inspección legacy explícita',
        inspectionDomain: 'ELECTRICAL',
        riskMethodVersionId,
      })
      .expect(201);
    expect(legacy.body.resourceScopeSnapshot).toBeNull();

    const scoped = await ownerApi
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'Inspección de tomacorriente',
        inspectionDomain: 'ELECTRICAL',
        resourceId: outletResourceId,
        riskMethodVersionId,
      })
      .expect(201);
    expect(scoped.body.resourceScopeSnapshot).toMatchObject({
      inspectionDomain: 'ELECTRICAL',
      taxonomy: { version: 1 },
      resource: { id: outletResourceId, code: 'OUTLET', level: 'MINOR' },
      mapping: { version: 1, standardVersionId },
    });
    expect(scoped.body.resourceScopeSnapshot.mapping.criterionIds).toHaveLength(
      scoped.body.criterionResults.length,
    );
    await expect(
      prisma.inspection.update({
        where: { id: scoped.body.id as string },
        data: { resourceScopeSnapshot: { rewritten: true } },
      }),
    ).rejects.toThrow('INSPECTION_RESOURCE_SCOPE_IMMUTABLE');
    const historical = await ownerApi.get(`/inspections/${scoped.body.id as string}`).expect(200);
    expect(historical.body.resourceScopeSnapshot).toEqual(scoped.body.resourceScopeSnapshot);

    const basisUnits = await prisma.regulatoryUnit.findMany({
      take: 2,
      orderBy: [{ sourceVersionId: 'asc' }, { ordinal: 'asc' }],
      select: { id: true },
    });
    const multiSourceBasis = await ownerApi
      .post('/inspection-bases')
      .send({
        name: 'Base eléctrica multifuente para alcance',
        inspectionDomain: 'ELECTRICAL',
        reason: 'Verificar que Resource Scope no reduzca fuentes suplementarias.',
        technicalSources: [
          { standardVersionId, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
          {
            standardVersionId: '57100000-0000-4000-8000-000000000002',
            role: 'SUPPLEMENTAL_TECHNICAL',
            displayOrder: 2,
          },
        ],
        regulatoryUnits: basisUnits.map(({ id }, index) => ({
          regulatoryUnitId: id,
          displayOrder: index + 1,
        })),
      })
      .expect(201);
    await ownerApi
      .post(`/inspection-bases/versions/${multiSourceBasis.body.id as string}/activate`)
      .expect(201);

    const inspectionCountBeforeBlockedScope = await prisma.inspection.count({
      where: { organizationId: orgA.organizationId },
    });
    await ownerApi
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'Scope parcial prohibido',
        inspectionDomain: 'ELECTRICAL',
        resourceId: outletResourceId,
        riskMethodVersionId,
      })
      .expect(400)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          code: 'INSPECTION_RESOURCE_MULTI_SOURCE_MAPPING_UNSUPPORTED',
        }),
      );
    expect(await prisma.inspection.count({ where: { organizationId: orgA.organizationId } })).toBe(
      inspectionCountBeforeBlockedScope,
    );

    const unscopedMultiSource = await ownerApi
      .post('/inspections')
      .send({
        workCenterId: orgA.centerId,
        title: 'Base multifuente sin alcance de recurso',
        inspectionDomain: 'ELECTRICAL',
        riskMethodVersionId,
      })
      .expect(201);
    expect(unscopedMultiSource.body).toMatchObject({
      inspectionBasisVersionId: multiSourceBasis.body.id,
      resourceScopeSnapshot: null,
    });
    expect(unscopedMultiSource.body.criterionResults).toHaveLength(7);
    await ownerApi
      .get(`/inspections/${scoped.body.id as string}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.resourceScopeSnapshot).toEqual(scoped.body.resourceScopeSnapshot),
      );

    const privateTaxonomyId = randomUUID();
    const privateVersionId = randomUUID();
    const privateResourceId = randomUUID();
    await prisma.inspectionResourceTaxonomy.create({
      data: {
        id: privateTaxonomyId,
        organizationId: orgA.organizationId,
        code: `PRIVATE_FIRE_${suffix}`,
        inspectionDomain: 'FIRE_PROTECTION',
        name: 'Alcance privado sintético',
        versions: {
          create: {
            id: privateVersionId,
            version: 1,
            status: 'ACTIVE',
            activatedAt: new Date(),
            contentDigest: 'private-synthetic-digest',
            resources: {
              create: {
                id: privateResourceId,
                code: 'PRIVATE_EXTINGUISHER',
                name: 'Extintor privado sintético',
                level: 'MINOR',
                displayOrder: 1,
              },
            },
          },
        },
      },
    });
    const privateCatalog = await ownerApi
      .get('/inspection-resources?domain=FIRE_PROTECTION')
      .expect(200);
    expect(privateCatalog.body.resources).toEqual([
      expect.objectContaining({ id: privateResourceId }),
    ]);
    await api(ownerB.token, orgB.organizationId)
      .get('/inspection-resources?domain=FIRE_PROTECTION')
      .expect(200)
      .expect(({ text }) => expect(text).toBe(''));
    await api(ownerB.token, orgB.organizationId)
      .post('/inspection-resources/proposals')
      .send({ resourceId: privateResourceId, keywords: [] })
      .expect(404);
    await ownerApi
      .post('/inspection-resources/proposals')
      .send({ resourceId: privateResourceId, keywords: [] })
      .expect(404);

    const mappingCount = await prisma.inspectionResourceCriterionMappingVersion.count();
    const proposal = await prisma.inspectionDraftProposal.create({
      data: {
        organizationId: orgA.organizationId,
        resourceId: outletResourceId,
        provider: 'FAKE_OFFLINE_TEST_TRANSPORT',
        model: 'fixture-v1',
        jurisdictionCode: 'EC',
        sourceUnitIds: [],
        proposedCriteria: [],
        validationSnapshot: {
          schema: 'INSPECTION_EDITORIAL_PROPOSAL_V1',
          activationAllowed: false,
        },
        createdById: ownerA.userId,
      },
    });
    await ownerApi
      .post(`/inspection-resources/proposals/${proposal.id}/submit`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('PENDING_EXPERT_REVIEW'));
    await ownerApi
      .post(`/inspection-resources/proposals/${proposal.id}/review`)
      .send({ decision: 'APPROVED', comment: 'Revisión editorial sintética.' })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('APPROVED'));
    expect(await prisma.inspectionResourceCriterionMappingVersion.count()).toBe(mappingCount);
    await expect(
      prisma.inspectionDraftProposal.update({
        where: { id: proposal.id },
        data: { provider: 'MUTATED' },
      }),
    ).rejects.toThrow('POST_ANITA_INVALID_EDITORIAL_PROPOSAL_MUTATION');
  });
});
