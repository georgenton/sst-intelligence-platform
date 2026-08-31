import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('work permits integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
  });

  afterAll(async () => app.close());

  async function register(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`,
        displayName: label,
        password: 'work-permit-password-strong-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
  }

  async function organization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    return response.body.id as string;
  }

  async function setDemoPreview(organizationId: string, active: boolean) {
    const now = new Date();
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'DEMO',
        demoStartedAt: now,
        demoExpiresAt: new Date(now.getTime() + (active ? 86_400_000 : -1_000)),
      },
    });
  }

  function api(token: string, organizationId: string) {
    const base = (method: 'get' | 'post', path: string) => {
      const operation =
        method === 'get'
          ? request(app.getHttpServer()).get(`/api/v1${path}`)
          : request(app.getHttpServer()).post(`/api/v1${path}`);
      return operation
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return { get: (path: string) => base('get', path), post: (path: string) => base('post', path) };
  }

  it('enforces entitlement, tenant isolation, separate approval, concurrency and lifecycle', async () => {
    const owner = await register('Permit Owner');
    const manager = await register('Permit Manager');
    const otherAdmin = await register('Permit Other Admin');
    const viewer = await register('Permit Viewer');
    const otherOrganizationManager = await register('Other Organization Manager');
    const orgA = await organization(owner.token, 'Permit Organization A');
    const orgB = await organization(owner.token, 'Permit Organization B');
    await setDemoPreview(orgA, true);
    await prisma.membership.createMany({
      data: [
        { organizationId: orgA, userId: manager.userId, role: 'SST_MANAGER', status: 'ACTIVE' },
        { organizationId: orgA, userId: otherAdmin.userId, role: 'ORG_ADMIN', status: 'ACTIVE' },
        { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
        {
          organizationId: orgB,
          userId: otherOrganizationManager.userId,
          role: 'SST_MANAGER',
          status: 'ACTIVE',
        },
      ],
    });
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const template = await api(owner.token, orgA).get('/work-permits/templates').expect(200);
    const templateId = template.body[0].id as string;
    await api(owner.token, orgA)
      .get('/work-permits/approvers')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ user: expect.objectContaining({ id: manager.userId }) }),
            expect.objectContaining({ user: expect.objectContaining({ id: otherAdmin.userId }) }),
          ]),
        );
        expect(body).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ user: expect.objectContaining({ id: owner.userId }) }),
            expect.objectContaining({ user: expect.objectContaining({ id: viewer.userId }) }),
          ]),
        );
      });

    await api(owner.token, orgB).get('/work-permits/templates').expect(403);
    await api(owner.token, orgB).get('/work-permits').expect(403);
    await api(owner.token, orgB).post('/work-permits').send({}).expect(403);
    await api(viewer.token, orgA)
      .post('/work-permits')
      .send({
        permitTemplateVersionId: templateId,
        workCenterId: centerA.id,
        approverUserId: manager.userId,
        area: 'Área de prueba',
        activity: 'Actividad no autorizada',
        plannedStartAt: new Date(Date.now() + 3_600_000).toISOString(),
        plannedEndAt: new Date(Date.now() + 7_200_000).toISOString(),
        hazards: ['Peligro controlado'],
        linkedRiskAssessmentIds: [],
        controls: ['Control'],
        preconditions: ['Precondición'],
        evidenceReferences: [],
      })
      .expect(403);
    await api(owner.token, orgA)
      .post('/work-permits')
      .send({
        permitTemplateVersionId: templateId,
        workCenterId: centerB.id,
        approverUserId: manager.userId,
        area: 'Centro ajeno',
        activity: 'No debe crearse',
        plannedStartAt: new Date(Date.now() + 3_600_000).toISOString(),
        plannedEndAt: new Date(Date.now() + 7_200_000).toISOString(),
        hazards: ['Peligro'],
        linkedRiskAssessmentIds: [],
        controls: ['Control'],
        preconditions: ['Precondición'],
        evidenceReferences: [],
      })
      .expect(400);
    await api(owner.token, orgA)
      .post('/work-permits')
      .send({
        permitTemplateVersionId: templateId,
        workCenterId: centerA.id,
        approverUserId: otherOrganizationManager.userId,
        area: 'Área de prueba',
        activity: 'Aprobador de otra organización',
        plannedStartAt: new Date(Date.now() + 3_600_000).toISOString(),
        plannedEndAt: new Date(Date.now() + 7_200_000).toISOString(),
        hazards: ['Peligro'],
        linkedRiskAssessmentIds: [],
        controls: ['Control'],
        preconditions: ['Precondición'],
        evidenceReferences: [],
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('WORK_PERMIT_APPROVER_NOT_ELIGIBLE'));

    const created = await api(owner.token, orgA)
      .post('/work-permits')
      .send({
        permitTemplateVersionId: templateId,
        workCenterId: centerA.id,
        approverUserId: manager.userId,
        area: 'Sala de máquinas',
        activity: 'Intervención interna planificada',
        plannedStartAt: new Date(Date.now() + 3_600_000).toISOString(),
        plannedEndAt: new Date(Date.now() + 7_200_000).toISOString(),
        hazards: ['Energía residual'],
        linkedRiskAssessmentIds: [],
        controls: ['Aislamiento documentado'],
        preconditions: ['Confirmar ausencia de energía'],
        evidenceReferences: ['Registro interno de aislamiento'],
      })
      .expect(201);
    const permitId = created.body.id as string;
    expect(created.body).toMatchObject({ status: 'DRAFT', version: 1 });
    await api(owner.token, orgB).get(`/work-permits/${permitId}`).expect(403);
    await api(owner.token, orgA)
      .post(`/work-permits/${permitId}/transition`)
      .send({ status: 'PENDING_APPROVAL', expectedVersion: 1 })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/work-permits/${permitId}/approve`)
      .send({ expectedVersion: 2 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('WORK_PERMIT_SELF_APPROVAL_FORBIDDEN'));
    await api(viewer.token, orgA)
      .post(`/work-permits/${permitId}/approve`)
      .send({ expectedVersion: 2 })
      .expect(403);
    await api(otherAdmin.token, orgA)
      .post(`/work-permits/${permitId}/approve`)
      .send({ expectedVersion: 2 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('WORK_PERMIT_ASSIGNED_APPROVER_REQUIRED'));

    await api(owner.token, orgB)
      .get('/work-queue?module=WORK_PERMITS')
      .expect(200)
      .expect(({ body }) =>
        expect(body.items).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ sourceId: permitId })]),
        ),
      );

    const queue = await api(owner.token, orgA).get('/work-queue?module=WORK_PERMITS').expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: permitId,
          type: 'WORK_PERMIT_APPROVAL',
          status: 'PENDING_APPROVAL',
          assignee: expect.objectContaining({ id: manager.userId }),
        }),
      ]),
    );
    await api(manager.token, orgA)
      .get(`/work-queue?module=WORK_PERMITS&assignedToUserId=${manager.userId}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ sourceId: permitId, type: 'WORK_PERMIT_APPROVAL' }),
          ]),
        ),
      );
    await api(owner.token, orgA)
      .get(`/work-queue?module=WORK_PERMITS&assignedToUserId=${owner.userId}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ sourceId: permitId })]),
        ),
      );

    await setDemoPreview(orgA, false);
    await api(owner.token, orgA).get('/work-permits').expect(403);
    await api(owner.token, orgA).get(`/work-permits/${permitId}`).expect(403);
    await api(owner.token, orgA)
      .get('/work-queue?module=WORK_PERMITS')
      .expect(200)
      .expect(({ body }) =>
        expect(body.items).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ sourceId: permitId })]),
        ),
      );
    expect(
      await prisma.workPermit.findUnique({ where: { id: permitId }, select: { status: true } }),
    ).toEqual({ status: 'PENDING_APPROVAL' });
    await setDemoPreview(orgA, true);

    const approvals = await Promise.all([
      api(manager.token, orgA)
        .post(`/work-permits/${permitId}/approve`)
        .send({ expectedVersion: 2 }),
      api(manager.token, orgA)
        .post(`/work-permits/${permitId}/approve`)
        .send({ expectedVersion: 2 }),
    ]);
    expect(approvals.map(({ status }) => status).sort()).toEqual([201, 409]);
    await api(owner.token, orgA)
      .post(`/work-permits/${permitId}/transition`)
      .send({ status: 'ACTIVE', expectedVersion: 3 })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/work-permits/${permitId}/transition`)
      .send({ status: 'SUSPENDED', expectedVersion: 4 })
      .expect(201);
    await api(owner.token, orgA)
      .get('/work-queue?module=WORK_PERMITS')
      .expect(200)
      .expect(({ body }) =>
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ sourceId: permitId, type: 'WORK_PERMIT_SUSPENDED' }),
          ]),
        ),
      );
    await api(owner.token, orgA)
      .post(`/work-permits/${permitId}/transition`)
      .send({ status: 'ACTIVE', expectedVersion: 5 })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/work-permits/${permitId}/transition`)
      .send({
        status: 'CLOSED',
        closureNote: 'Actividad finalizada y área liberada.',
        expectedVersion: 6,
      })
      .expect(201)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'CLOSED', version: 7 }));
    expect(
      await prisma.auditLog.count({ where: { organizationId: orgA, entityType: 'WorkPermit' } }),
    ).toBeGreaterThanOrEqual(6);
    await setDemoPreview(orgA, false);
    expect(
      await prisma.workPermit.findUnique({ where: { id: permitId }, select: { status: true } }),
    ).toEqual({ status: 'CLOSED' });
  });
});
