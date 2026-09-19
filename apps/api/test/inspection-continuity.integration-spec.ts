import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import { InspectionsService } from '../src/inspections/inspections.service';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';

describe('Inspection continuity persistence boundaries', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inspections: InspectionsService;
  let audit: AuditService;
  const context = { requestId: 'inspection-continuity-regression' };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    inspections = app.get(InspectionsService);
    audit = app.get(AuditService);
  });
  afterAll(async () => app.close());
  it('rolls back an inspection and its frozen results if its mandatory audit fails', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `continuity-${Date.now()}@example.test`,
        displayName: 'Continuity regression',
        password: 'continuity-integration-password-123',
      })
      .expect(201);
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${registration.body.accessToken as string}`)
      .send({ name: 'Continuity regression', country: 'Ecuador' })
      .expect(201);
    const organizationId = organization.body.id as string;
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const fault = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('Synthetic audit unavailable'));
    try {
      await expect(
        inspections.create(
          organizationId,
          registration.body.user.id as string,
          {
            workCenterId: center.id,
            title: 'Atomic inspection',
            riskMethodVersionId: '54000000-0000-4000-8000-000000000001',
            inspectionDepth: 'BASIC',
          },
          context,
        ),
      ).rejects.toThrow('Synthetic audit unavailable');
      expect(await prisma.inspection.count({ where: { organizationId } })).toBe(0);
      expect(await prisma.inspectionCriterionResult.count({ where: { organizationId } })).toBe(0);
    } finally {
      fault.mockRestore();
    }
  });
  const standardA = '57100000-0000-4000-8000-000000000001';
  const standardB = '57100000-0000-4000-8000-000000000002';
  const fireStandard = '57100000-0000-4000-8000-000000000003';
  const method = '54000000-0000-4000-8000-000000000001';
  async function owner(label: string) {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `continuity-${label}-${Date.now()}@example.test`,
        displayName: label,
        password: 'continuity-integration-password-123',
      })
      .expect((response) => {
        if (response.status !== 201)
          throw new Error(
            `Registration status ${response.status}; ${JSON.stringify({ code: response.body.code, message: response.body.message })}`,
          );
      });
    const token = registration.body.accessToken as string;
    const userId = registration.body.user.id as string;
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Continuity ${label}`, country: 'Ecuador' })
      .expect(201);
    const organizationId = organization.body.id as string;
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    // Secondary persistence/security fixture, never the primary fresh UI journey.
    await prisma.organizationModule.create({
      data: { organizationId, moduleId: module.id, status: 'ACTIVE', source: 'MANUAL' },
    });
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const operation = (verb: 'get' | 'post' | 'put' | 'patch', path: string) => {
      const client = request(app.getHttpServer());
      return client[verb](`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      organizationId,
      userId,
      centerId: center.id,
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
      put: (path: string) => operation('put', path),
      patch: (path: string) => operation('patch', path),
    };
  }
  type Result = {
    id: string;
    outcome: string;
    hasRecordedResult: boolean;
    canMarkNotApplicable: boolean;
    notApplicableReason: string | null;
    criterion: { id: string; notApplicableAllowed: boolean };
    finding: { id: string } | null;
  };
  it('distinguishes recorded NV, exposes unchanged NA policy, preserves human finding and action continuity', async () => {
    const actor = await owner('results');
    await actor
      .put('/inspection-standards/organization/policy')
      .send({ bindings: [{ inspectionDomain: 'ELECTRICAL', standardVersionId: standardA }] })
      .expect(200);
    const catalog = await actor
      .get(`/inspection-resources?domain=ELECTRICAL&standardVersionId=${standardA}`)
      .expect(200);
    const resourceId = catalog.body.resources[0].id as string;
    const created = await actor
      .post('/inspections')
      .send({
        workCenterId: actor.centerId,
        title: 'Scoped continuity regression',
        inspectionDomain: 'ELECTRICAL',
        resourceId,
        riskMethodVersionId: method,
        inspectionDepth: 'BASIC',
      })
      .expect(201);
    const inspectionId = created.body.id as string;
    let detail = await actor.get(`/inspections/${inspectionId}`).expect(200);
    let results = detail.body.criterionResults as Result[];
    expect(results).toHaveLength(4);
    expect(results.every(({ hasRecordedResult }) => !hasRecordedResult)).toBe(true);
    for (const result of results) {
      expect(result.canMarkNotApplicable).toBe(result.criterion.notApplicableAllowed);
      expect(result.notApplicableReason === null).toBe(result.canMarkNotApplicable);
    }
    const result = results.find(({ canMarkNotApplicable }) => !canMarkNotApplicable)!;
    await actor.post(`/inspections/${inspectionId}/start`).expect(201);
    await actor
      .patch(`/inspections/${inspectionId}/criteria/${result.criterion.id}`)
      .send({ outcome: 'NO_APLICA' })
      .expect(400);
    expect(
      (await prisma.inspectionCriterionResult.findUniqueOrThrow({ where: { id: result.id } }))
        .outcome,
    ).toBe('NO_VERIFICADO');
    await actor
      .patch(`/inspections/${inspectionId}/criteria/${result.criterion.id}`)
      .send({ outcome: 'NO_VERIFICADO' })
      .expect(200);
    detail = await actor.get(`/inspections/${inspectionId}`).expect(200);
    results = detail.body.criterionResults as Result[];
    expect(results.filter(({ hasRecordedResult }) => hasRecordedResult)).toHaveLength(1);
    expect(results.find(({ id }) => id === result.id)).toMatchObject({
      outcome: 'NO_VERIFICADO',
      hasRecordedResult: true,
    });
    const criterionFault = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('Synthetic criterion audit unavailable'));
    try {
      await expect(
        inspections.updateCriterionResult(
          actor.organizationId,
          inspectionId,
          result.criterion.id,
          actor.userId,
          { outcome: 'NO_CONFORME', note: 'Synthetic fault observation' },
          context,
        ),
      ).rejects.toThrow('Synthetic criterion audit unavailable');
      expect(
        (await prisma.inspectionCriterionResult.findUniqueOrThrow({ where: { id: result.id } }))
          .outcome,
      ).toBe('NO_VERIFICADO');
    } finally {
      criterionFault.mockRestore();
    }
    await actor
      .patch(`/inspections/${inspectionId}/criteria/${result.criterion.id}`)
      .send({
        outcome: 'NO_CONFORME',
        note: 'Synthetic observed condition',
        evidenceReferences: ['https://example.test/criterion-reference'],
      })
      .expect(200);
    expect(await prisma.inspectionFinding.count({ where: { inspectionId } })).toBe(0);
    const findingInput = {
      title: 'Human finding',
      description: 'Synthetic observed condition',
      category: 'ELECTRICAL',
      criterionResultId: result.id,
      methodInput: { likelihood: 4, consequence: 5 },
    };
    const findingFault = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('Synthetic finding audit unavailable'));
    try {
      await expect(
        inspections.createFinding(
          actor.organizationId,
          inspectionId,
          actor.userId,
          findingInput,
          context,
        ),
      ).rejects.toThrow('Synthetic finding audit unavailable');
      expect(await prisma.inspectionFinding.count({ where: { inspectionId } })).toBe(0);
    } finally {
      findingFault.mockRestore();
    }
    const finding = await actor
      .post(`/inspections/${inspectionId}/findings`)
      .send(findingInput)
      .expect(201);
    const findingId = finding.body.id as string;
    await actor.post(`/inspections/${inspectionId}/findings`).send(findingInput).expect(400);
    expect(await prisma.inspectionFinding.count({ where: { inspectionId } })).toBe(1);
    await actor
      .patch(`/inspections/${inspectionId}/criteria/${result.criterion.id}`)
      .send({ outcome: 'CONFORME' })
      .expect(400);
    const actionFault = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('Synthetic action audit unavailable'));
    try {
      await expect(
        inspections.createAction(
          actor.organizationId,
          inspectionId,
          findingId,
          actor.userId,
          { title: 'Human action', priority: 'MEDIUM' },
          context,
        ),
      ).rejects.toThrow('Synthetic action audit unavailable');
      expect(await prisma.correctiveAction.count({ where: { findingId } })).toBe(0);
      expect(
        (await prisma.inspectionFinding.findUniqueOrThrow({ where: { id: findingId } })).status,
      ).toBe('OPEN');
    } finally {
      actionFault.mockRestore();
    }
    const action = await actor
      .post(`/inspections/${inspectionId}/findings/${findingId}/actions`)
      .send({
        title: 'Human action',
        priority: 'MEDIUM',
        assignedToUserId: actor.userId,
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);
    const actionId = action.body.id as string;
    await actor
      .post(`/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/evidence`)
      .send({ type: 'NOTE', note: 'Synthetic evidence' })
      .expect(201);
    const presented = await actor
      .get(`/inspections/${inspectionId}/findings/${findingId}`)
      .expect(200);
    expect(presented.body.criterionResult).toMatchObject({
      id: result.id,
      outcome: 'NO_CONFORME',
      note: 'Synthetic observed condition',
      evidenceReferences: ['https://example.test/criterion-reference'],
      criterion: { standardVersion: { id: standardA } },
    });
    expect(presented.body.actions[0].evidence[0]).toMatchObject({
      type: 'NOTE',
      createdBy: { id: actor.userId },
      createdAt: expect.any(String),
    });
    await actor.post(`/inspections/${inspectionId}/complete`).expect((response) => {
      if (response.status !== 201)
        throw new Error(
          `Completion status ${response.status}; ${JSON.stringify({ code: response.body.code, message: response.body.message })}`,
        );
    });
    expect(
      (await prisma.correctiveAction.findUniqueOrThrow({ where: { id: actionId } })).status,
    ).toBe('OPEN');
    expect(
      (await prisma.inspectionFinding.findUniqueOrThrow({ where: { id: findingId } })).status,
    ).toBe('ACTION_IN_PROGRESS');
    const queue = await actor.get('/work-queue?pageSize=100').expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deepLink: `/app/inspections/${inspectionId}/findings/${findingId}?action=${actionId}`,
        }),
      ]),
    );
    const foreign = await owner('foreign');
    await foreign.get(`/inspections/${inspectionId}`).expect(404);
    await foreign.get(`/inspections/${inspectionId}/findings/${findingId}`).expect(404);
  });
  it('rejects explicit invalid resources without a catalog and never truncates a multi-source general inspection', async () => {
    const actor = await owner('scope');
    await actor
      .post('/inspections')
      .send({
        workCenterId: actor.centerId,
        title: 'Invalid resource without a domain',
        resourceId: '71200000-0000-4000-8000-000000999999',
        riskMethodVersionId: method,
        inspectionDepth: 'BASIC',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INSPECTION_RESOURCE_DOMAIN_REQUIRED'));
    expect(await prisma.inspection.count({ where: { organizationId: actor.organizationId } })).toBe(
      0,
    );

    await actor
      .put('/inspection-standards/organization/policy')
      .send({
        bindings: [{ inspectionDomain: 'FIRE_PROTECTION', standardVersionId: fireStandard }],
      })
      .expect(200);
    const invalid = await actor
      .post('/inspections')
      .send({
        workCenterId: actor.centerId,
        title: 'Invalid explicit resource',
        inspectionDomain: 'FIRE_PROTECTION',
        resourceId: '71200000-0000-4000-8000-000000999999',
        riskMethodVersionId: method,
        inspectionDepth: 'BASIC',
      })
      .expect(400);
    expect(invalid.body.code).toBe('INSPECTION_RESOURCE_NOT_AVAILABLE');
    expect(await prisma.inspection.count({ where: { organizationId: actor.organizationId } })).toBe(
      0,
    );
    const basis = await actor
      .post('/inspection-bases')
      .send({
        name: 'Synthetic combined basis',
        inspectionDomain: 'ELECTRICAL',
        reason: 'Synthetic continuity regression',
        technicalSources: [
          { standardVersionId: standardA, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
          { standardVersionId: standardB, role: 'SUPPLEMENTAL_TECHNICAL', displayOrder: 2 },
        ],
        regulatoryUnits: [],
      })
      .expect(201);
    await actor.post(`/inspection-bases/versions/${basis.body.id as string}/activate`).expect(201);
    const input = {
      workCenterId: actor.centerId,
      title: 'Explicit general continuity',
      inspectionDomain: 'ELECTRICAL',
      riskMethodVersionId: method,
      inspectionDepth: 'BASIC',
    };
    const unsupported = await actor
      .post('/inspections')
      .send({ ...input, resourceId: '71200000-0000-4000-8000-000000000001' })
      .expect(400);
    expect(unsupported.body.code).toBe('INSPECTION_RESOURCE_MULTI_SOURCE_MAPPING_UNSUPPORTED');
    const general = await actor.post('/inspections').send(input).expect(201);
    expect(general.body.resourceScopeSnapshot).toBeNull();
    expect(general.body.inspectionBasisVersionId).toBe(basis.body.id);
    expect(general.body.criterionResults).toHaveLength(7);
    const expectedIds = await prisma.inspectionStandardCriterion.findMany({
      where: { standardVersionId: { in: [standardA, standardB] } },
      select: { id: true },
    });
    expect(
      (general.body.criterionResults as Array<{ criterionId: string }>)
        .map(({ criterionId }) => criterionId)
        .sort(),
    ).toEqual(expectedIds.map(({ id }) => id).sort());
  });
});
