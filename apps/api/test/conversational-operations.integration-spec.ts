import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Conversational Operations V1 integration', () => {
  const riskMethodVersionId = '54000000-0000-4000-8000-000000000001';
  const retieVersionId = '57500000-0000-4000-8000-000000000001';
  const rebtVersionId = '57500000-0000-4000-8000-000000000002';
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

  async function register(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label}-${suffix}@example.test`,
        displayName: label,
        password: 'conversation-password-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, id: response.body.user.id as string };
  }

  async function organization(token: string, label: string) {
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
    return { id: organizationId, centerId: center.id };
  }

  function api(token: string, organizationId: string) {
    const bind = (method: 'get' | 'post', path: string) => {
      const client = request(app.getHttpServer());
      return (method === 'get' ? client.get(`/api/v1${path}`) : client.post(`/api/v1${path}`))
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return { get: (path: string) => bind('get', path), post: (path: string) => bind('post', path) };
  }

  async function proposeAndConfirm(
    actor: ReturnType<typeof api>,
    threadId: string,
    actionKey: string,
    idempotencyKey: string,
    input: Record<string, unknown>,
  ) {
    const proposed = await actor
      .post(`/conversations/${threadId}/actions`)
      .send({ actionKey, idempotencyKey, input })
      .expect(201);
    expect(proposed.body.status).toBe('AWAITING_CONFIRMATION');
    expect(proposed.body.confirmationState).toBe('PENDING');
    return actor
      .post(`/conversations/action-runs/${proposed.body.id}/confirm`)
      .send({})
      .expect(201);
  }

  it('isolates private threads and executes confirmed domain actions idempotently with citations', async () => {
    const ownerA = await register('conversation-owner-a');
    const ownerB = await register('conversation-owner-b');
    const viewerA = await register('conversation-viewer-a');
    const orgA = await organization(ownerA.token, 'Conversation Organization A');
    const orgB = await organization(ownerB.token, 'Conversation Organization B');
    await prisma.membership.create({
      data: { organizationId: orgA.id, userId: viewerA.id, role: 'VIEWER', status: 'ACTIVE' },
    });
    const ownerApi = api(ownerA.token, orgA.id);
    const viewerApi = api(viewerA.token, orgA.id);
    const otherApi = api(ownerB.token, orgB.id);

    const basis = await ownerApi
      .post('/inspection-bases')
      .send({
        name: `Base eléctrica conversacional ${suffix}`,
        inspectionDomain: 'ELECTRICAL',
        reason: 'Composición oficial de piloto para prueba conversacional',
        technicalSources: [
          { standardVersionId: retieVersionId, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
          { standardVersionId: rebtVersionId, role: 'SUPPLEMENTAL_TECHNICAL', displayOrder: 2 },
        ],
        regulatoryUnits: [],
        criterionRegulatoryLinks: [],
      })
      .expect(201);
    await ownerApi
      .post(`/inspection-bases/versions/${basis.body.id}/activate`)
      .send({})
      .expect(201);

    const ownerThread = await ownerApi
      .post('/conversations')
      .send({ title: 'Inspección eléctrica guiada', contextType: 'GLOBAL' })
      .expect(201);
    const viewerThread = await viewerApi
      .post('/conversations')
      .send({ title: 'Conversación privada viewer', contextType: 'GLOBAL' })
      .expect(201);
    const organizationWithoutBasisThread = await otherApi
      .post('/conversations')
      .send({ title: 'Organización sin base activa', contextType: 'GLOBAL' })
      .expect(201);
    await viewerApi.get(`/conversations/${ownerThread.body.id}`).expect(404);
    await otherApi.get(`/conversations/${ownerThread.body.id}`).expect(404);

    const noBasisProposal = await otherApi
      .post(`/conversations/${organizationWithoutBasisThread.body.id}/actions`)
      .send({
        actionKey: 'create_inspection',
        idempotencyKey: `create-without-basis-${suffix}`,
        input: {
          workCenterId: orgB.centerId,
          riskMethodVersionId,
          inspectionDomain: 'ELECTRICAL',
          title: 'No debe crearse sin base activa',
        },
      })
      .expect(201);
    await otherApi
      .post(`/conversations/action-runs/${noBasisProposal.body.id}/confirm`)
      .send({})
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ACTIVE_INSPECTION_BASIS_REQUIRED'));

    const viewerProposal = await viewerApi
      .post(`/conversations/${viewerThread.body.id}/actions`)
      .send({
        actionKey: 'create_inspection',
        idempotencyKey: `viewer-create-${suffix}`,
        input: {
          workCenterId: orgA.centerId,
          riskMethodVersionId,
          inspectionDomain: 'ELECTRICAL',
          title: 'No debe crearse',
        },
      })
      .expect(201);
    await viewerApi
      .post(`/conversations/action-runs/${viewerProposal.body.id}/confirm`)
      .send({})
      .expect(403);
    expect(
      await prisma.inspection.count({
        where: { organizationId: orgA.id, title: 'No debe crearse' },
      }),
    ).toBe(0);

    const createInput = {
      workCenterId: orgA.centerId,
      riskMethodVersionId,
      inspectionDomain: 'ELECTRICAL',
      title: `Inspección conversacional ${suffix}`,
      description: 'Recorrido guiado por acciones estructuradas.',
    };
    const createProposal = await ownerApi
      .post(`/conversations/${ownerThread.body.id}/actions`)
      .send({
        actionKey: 'create_inspection',
        idempotencyKey: `create-inspection-${suffix}`,
        input: createInput,
      })
      .expect(201);
    expect(createProposal.body.status).toBe('AWAITING_CONFIRMATION');
    expect(
      await prisma.inspection.count({
        where: { organizationId: orgA.id, title: createInput.title },
      }),
    ).toBe(0);
    const createdRun = await ownerApi
      .post(`/conversations/action-runs/${createProposal.body.id}/confirm`)
      .send({})
      .expect(201);
    expect(createdRun.body.status).toBe('SUCCEEDED');
    expect(createdRun.body.message.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'INSPECTION_BASIS_VERSION', referenceId: basis.body.id }),
        expect.objectContaining({
          type: 'INSPECTION_STANDARD_VERSION',
          referenceId: retieVersionId,
        }),
        expect.objectContaining({
          type: 'INSPECTION_STANDARD_VERSION',
          referenceId: rebtVersionId,
        }),
      ]),
    );
    const inspectionId = createdRun.body.resultId as string;
    expect(
      await prisma.inspection.count({
        where: { organizationId: orgA.id, title: createInput.title },
      }),
    ).toBe(1);

    const replay = await ownerApi
      .post(`/conversations/${ownerThread.body.id}/actions`)
      .send({
        actionKey: 'create_inspection',
        idempotencyKey: `create-inspection-${suffix}`,
        input: createInput,
      })
      .expect(201);
    expect(replay.body.resultId).toBe(inspectionId);
    expect(
      await prisma.inspection.count({
        where: { organizationId: orgA.id, title: createInput.title },
      }),
    ).toBe(1);
    await ownerApi
      .post(`/conversations/${ownerThread.body.id}/actions`)
      .send({
        actionKey: 'create_inspection',
        idempotencyKey: `create-inspection-${suffix}`,
        input: { ...createInput, title: 'Solicitud distinta' },
      })
      .expect(409);

    await proposeAndConfirm(ownerApi, ownerThread.body.id, 'start_inspection', `start-${suffix}`, {
      inspectionId,
    });
    const inspection = await ownerApi.get(`/inspections/${inspectionId}`).expect(200);
    const criterion = inspection.body.criterionResults[0];
    expect(criterion).toBeDefined();
    const criterionRun = await proposeAndConfirm(
      ownerApi,
      ownerThread.body.id,
      'record_criterion_result',
      `criterion-${suffix}`,
      {
        inspectionId,
        criterionId: criterion.criterion.id,
        outcome: 'NO_CONFORME',
        note: 'Condición visible que requiere tratamiento.',
      },
    );
    expect(criterionRun.body.result.outcome).toBe('NO_CONFORME');
    await proposeAndConfirm(
      ownerApi,
      ownerThread.body.id,
      'attach_evidence',
      `evidence-${suffix}`,
      {
        targetType: 'INSPECTION_CRITERION',
        inspectionId,
        criterionId: criterion.criterion.id,
        reference: 'Referencia interna controlada EV-CONV-001',
      },
    );
    const findingRun = await proposeAndConfirm(
      ownerApi,
      ownerThread.body.id,
      'create_finding',
      `finding-${suffix}`,
      {
        inspectionId,
        criterionResultId: criterion.id,
        title: 'Condición eléctrica observada',
        description: 'Hallazgo creado solo después de confirmación explícita.',
        category: 'ELECTRICAL',
        methodInput: { likelihood: 4, consequence: 3 },
      },
    );
    const findingId = findingRun.body.resultId as string;
    expect(findingRun.body.result.initialScore).toBe(12);
    const actionRun = await proposeAndConfirm(
      ownerApi,
      ownerThread.body.id,
      'create_action',
      `action-${suffix}`,
      {
        inspectionId,
        findingId,
        title: 'Asegurar y corregir condición',
        description: 'Acción canónica visible en cola.',
        assignedToUserId: ownerA.id,
        priority: 'HIGH',
      },
    );
    const actionId = actionRun.body.resultId as string;
    expect(actionRun.body.result.assignedTo.id).toBe(ownerA.id);

    const queueMessage = await ownerApi
      .post(`/conversations/${ownerThread.body.id}/messages`)
      .send({ content: '¿Qué tengo pendiente?' })
      .expect(201);
    expect(queueMessage.body.action.status).toBe('SUCCEEDED');
    expect(queueMessage.body.action.result.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: actionId })]),
    );
    const explanation = await ownerApi
      .post(`/conversations/${ownerThread.body.id}/actions`)
      .send({
        actionKey: 'explain_work_item',
        idempotencyKey: `explain-${suffix}`,
        input: { sourceId: actionId, type: 'CORRECTIVE_ACTION' },
      })
      .expect(201);
    expect(explanation.body.status).toBe('SUCCEEDED');
    expect(explanation.body.message.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'WORK_ITEM', referenceId: actionId }),
        expect.objectContaining({ type: 'INSPECTION_BASIS_VERSION', referenceId: basis.body.id }),
      ]),
    );
    expect(
      await prisma.conversationAttachmentReference.count({
        where: {
          organizationId: orgA.id,
          destinationType: 'INSPECTION_CRITERION_RESULT',
        },
      }),
    ).toBe(1);
  });
});
