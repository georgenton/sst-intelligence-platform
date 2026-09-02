import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('governance integration', () => {
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
        password: 'governance-integration-password-123',
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

  function api(token: string, organizationId: string) {
    const headers = <T extends SuperTestRequest>(operation: T) =>
      operation.set('Authorization', `Bearer ${token}`).set('x-organization-id', organizationId);
    return {
      get: (path: string) => headers(request(app.getHttpServer()).get(`/api/v1${path}`)),
      post: (path: string) => headers(request(app.getHttpServer()).post(`/api/v1${path}`)),
      patch: (path: string) => headers(request(app.getHttpServer()).patch(`/api/v1${path}`)),
    };
  }

  it('preserves tenant, actor, history and regulatory boundaries through the workflow', async () => {
    const owner = await register('Governance Owner');
    const viewer = await register('Governance Viewer');
    const outsider = await register('Governance Outsider');
    const orgA = await organization(owner.token, 'Governance A');
    const orgB = await organization(owner.token, 'Governance B');
    const viewerMembership = await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });
    const ownerMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgA, userId: owner.userId },
    });
    const worker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Trabajadora sin cuenta',
        status: 'ACTIVE',
        createdById: owner.userId,
      },
    });
    const linkedWorker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Trabajadora con cuenta vinculada',
        status: 'ACTIVE',
        linkedUserId: viewer.userId,
        createdById: owner.userId,
      },
    });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    await prisma.membership.create({
      data: { organizationId: orgB, userId: outsider.userId, role: 'ORG_ADMIN', status: 'ACTIVE' },
    });
    const ownerApi = api(owner.token, orgA);

    await api(viewer.token, orgA)
      .post('/governance/bodies')
      .send({ name: 'No autorizado', category: 'WORK_GROUP' })
      .expect(403);
    await api(outsider.token, orgA).get('/governance/bodies').expect(403);
    await ownerApi
      .post('/governance/bodies')
      .send({ name: 'Centro ajeno', category: 'WORK_GROUP', workCenterId: centerB.id })
      .expect(400);

    const body = await ownerApi
      .post('/governance/bodies')
      .send({ name: `Comité operativo ${suffix}`, category: 'COMMITTEE' })
      .expect(201);
    const bodyId = body.body.id as string;
    const workerMember = await ownerApi
      .post(`/governance/bodies/${bodyId}/members`)
      .send({ workerId: worker.id, roleLabel: 'Representación operativa' })
      .expect(201);
    expect(workerMember.body).toMatchObject({
      worker: { id: worker.id, displayName: 'Trabajadora sin cuenta' },
      membership: null,
    });
    await ownerApi
      .post(`/governance/bodies/${bodyId}/members`)
      .send({ workerId: worker.id, membershipId: viewerMembership.id })
      .expect(400);
    await ownerApi
      .post(`/governance/bodies/${bodyId}/members`)
      .send({ workerId: linkedWorker.id, roleLabel: 'Representación vinculada' })
      .expect(201);
    await ownerApi
      .post(`/governance/bodies/${bodyId}/members`)
      .send({ membershipId: viewerMembership.id, roleLabel: 'Duplicado por cuenta' })
      .expect(409);
    const actorMember = await ownerApi
      .post(`/governance/bodies/${bodyId}/members`)
      .send({ membershipId: ownerMembership.id, roleLabel: 'Presidencia' })
      .expect(201);
    await ownerApi
      .patch(`/workers/${worker.id}`)
      .send({ expectedVersion: 1, linkedUserId: owner.userId })
      .expect(409);
    expect(await prisma.worker.findUniqueOrThrow({ where: { id: worker.id } })).toMatchObject({
      linkedUserId: null,
      version: 1,
    });

    const meeting = await ownerApi
      .post(`/governance/bodies/${bodyId}/meetings`)
      .send({
        title: 'Revisión mensual interna',
        scheduledAt: '2026-09-05T14:00:00.000Z',
        mode: 'HYBRID',
        chairMembershipId: ownerMembership.id,
        participantMemberIds: [workerMember.body.id, actorMember.body.id],
        agendaItems: [{ title: 'Seguimiento de compromisos internos', sortOrder: 1 }],
      })
      .expect(201);
    expect(meeting.body.status).toBe('DRAFT');
    expect(meeting.body.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          personKeySnapshot: `WORKER:${worker.id}`,
          displayNameSnapshot: 'Trabajadora sin cuenta',
          roleLabelSnapshot: 'Representación operativa',
        }),
        expect.objectContaining({
          personKeySnapshot: `USER:${owner.userId}`,
          displayNameSnapshot: 'Governance Owner',
          roleLabelSnapshot: 'Presidencia',
        }),
      ]),
    );
    await ownerApi
      .post(`/governance/meetings/${meeting.body.id as string}/decisions`)
      .send({ summary: 'No se puede decidir antes de realizar la reunión.' })
      .expect(400);
    await ownerApi
      .post(`/governance/meetings/${meeting.body.id as string}/transition`)
      .send({ status: 'SCHEDULED' })
      .expect(201);
    await ownerApi
      .post(`/governance/meetings/${meeting.body.id as string}/transition`)
      .send({ status: 'HELD', occurredAt: '2026-09-05T15:00:00.000Z' })
      .expect(201);

    const candidateRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `GOV_CANDIDATE_${suffix.replaceAll(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
        title: 'Referencia editorial candidata',
        description: 'Fixture sin publicación regulatoria.',
        editorialStatus: 'DRAFT',
      },
    });
    await prisma.regulatoryRequirement.update({
      where: { id: candidateRequirement.id },
      data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
    });
    const decision = await ownerApi
      .post(`/governance/meetings/${meeting.body.id as string}/decisions`)
      .send({
        summary: 'Priorizar un seguimiento operativo interno.',
        rationale: 'Acuerdo profesional documentado.',
        requirementId: candidateRequirement.id,
      })
      .expect(201);
    expect(decision.body.regulatorySnapshot).toMatchObject({
      boundary: 'REFERENCIA_CANDIDATA',
      legalMandateInferred: false,
    });
    const action = await ownerApi
      .post(`/governance/decisions/${decision.body.id as string}/actions`)
      .send({
        title: 'Documentar seguimiento interno',
        priority: 'HIGH',
        assignedToMembershipId: ownerMembership.id,
        dueAt: '2026-09-10T12:00:00.000Z',
      })
      .expect(201);
    await ownerApi
      .post(`/governance/meetings/${meeting.body.id as string}/evidence`)
      .send({ type: 'NOTE', note: 'Acta interna revisada por participantes.' })
      .expect(201);

    const queue = await ownerApi.get('/work-queue?module=GOVERNANCE&pageSize=100').expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'GOVERNANCE_ACTION',
          sourceId: action.body.id,
          deepLink: `/app/governance?meeting=${meeting.body.id as string}&action=${action.body.id as string}`,
        }),
      ]),
    );
    const repeatedProjection = await ownerApi
      .get('/work-queue?module=GOVERNANCE&pageSize=100')
      .expect(200);
    expect(
      repeatedProjection.body.items.filter(
        (item: { sourceId: string }) => item.sourceId === action.body.id,
      ),
    ).toHaveLength(1);

    await prisma.worker.update({
      where: { id: worker.id },
      data: { displayName: 'Nombre actual modificado', status: 'INACTIVE' },
    });
    const historicalBody = await ownerApi.get(`/governance/bodies/${bodyId}`).expect(200);
    const historicalParticipant = historicalBody.body.meetings[0].participants.find(
      (participant: { personKeySnapshot: string }) =>
        participant.personKeySnapshot === `WORKER:${worker.id}`,
    );
    expect(historicalParticipant).toMatchObject({
      displayNameSnapshot: 'Trabajadora sin cuenta',
      roleLabelSnapshot: 'Representación operativa',
      governanceMember: {
        worker: { displayName: 'Nombre actual modificado', status: 'INACTIVE' },
      },
    });

    await ownerApi
      .patch(`/governance/actions/${action.body.id as string}/status`)
      .send({ status: 'COMPLETED', expectedVersion: action.body.version })
      .expect(200);
    const queueAfterCompletion = await ownerApi
      .get('/work-queue?module=GOVERNANCE&pageSize=100')
      .expect(200);
    expect(
      queueAfterCompletion.body.items.some(
        (item: { sourceId: string }) => item.sourceId === action.body.id,
      ),
    ).toBe(false);
    expect(
      await prisma.governanceDecision.findUnique({ where: { id: decision.body.id as string } }),
    ).toMatchObject({ summary: 'Priorizar un seguimiento operativo interno.' });
    await api(owner.token, orgB).get(`/governance/bodies/${bodyId}`).expect(404);
    const actorAudit = await prisma.auditLog.findMany({
      where: {
        organizationId: orgA,
        entityId: meeting.body.id as string,
        action: { in: ['GOVERNANCE_MEETING_CREATED', 'GOVERNANCE_MEETING_TRANSITIONED'] },
      },
      select: { actorUserId: true },
    });
    expect(actorAudit).toHaveLength(3);
    expect(actorAudit.every(({ actorUserId }) => actorUserId === owner.userId)).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: orgA,
          entityType: { in: ['GovernanceMeeting', 'GovernanceDecision'] },
        },
      }),
    ).toBeGreaterThanOrEqual(4);
  });
});
