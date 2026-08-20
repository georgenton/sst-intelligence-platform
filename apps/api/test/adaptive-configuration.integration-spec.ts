import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('adaptive configuration integration', () => {
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
        email: `${label}-${suffix}@example.test`,
        displayName: label,
        password: 'adaptive-configuration-password-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
  }

  async function createOrganization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador', sector: 'Servicios' })
      .expect(201);
    return response.body.id as string;
  }

  function adaptive(token: string, organizationId: string) {
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`/api/v1/adaptive-configuration${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
      post: (path: string) =>
        request(app.getHttpServer())
          .post(`/api/v1/adaptive-configuration${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
    };
  }

  it('preserves tenant, revision, snapshots, dynamic questions, proposal and current-state boundaries', async () => {
    const owner = await register('adaptive-owner');
    const viewer = await register('adaptive-viewer');
    const organizationA = await createOrganization(owner.token, 'Adaptive A');
    const organizationB = await createOrganization(owner.token, 'Adaptive B');
    await prisma.membership.create({
      data: {
        userId: viewer.userId,
        organizationId: organizationA,
        role: 'VIEWER',
        status: 'ACTIVE',
      },
    });

    const profile = await request(app.getHttpServer())
      .post('/api/v1/applicability/profile-versions')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationA)
      .send({ workerCount: 6, hasChemicalProcesses: false, hasHighEnergyOperations: false })
      .expect(201);
    const packs = await adaptive(owner.token, organizationA).get('/rule-packs').expect(200);
    const pack = packs.body.find(
      (candidate: { packDefinition: { packKey: string } }) =>
        candidate.packDefinition.packKey === 'DEMO_ADAPTIVE_SST_CONFIGURATION',
    );
    expect(pack).toMatchObject({ version: '1.0.0', isDemo: true, regulatory: false });

    await adaptive(viewer.token, organizationA)
      .post('/sessions')
      .send({ profileVersionId: profile.body.id, rulePackVersionId: pack.id })
      .expect(403);

    const created = await adaptive(owner.token, organizationA)
      .post('/sessions')
      .send({
        profileVersionId: profile.body.id,
        rulePackVersionId: pack.id,
        strategicPriorities: ['PEOPLE_AND_HEALTH', 'BUSINESS_CONTINUITY'],
      })
      .expect(201);
    const sessionId = created.body.id as string;
    expect(created.body).toMatchObject({
      status: 'COLLECTING_INFORMATION',
      sessionRevision: 1,
      rulePackVersion: { version: '1.0.0' },
    });
    expect(created.body.scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeKey: 'organization', kind: 'ORGANIZATION' }),
        expect.objectContaining({ kind: 'WORK_CENTER' }),
      ]),
    );
    const run1 = created.body.runs[0];
    expect(run1.questions.length).toBeGreaterThan(0);
    const initialFactKeys = run1.questions.map(
      (question: { factVersion: { factDefinition: { factKey: string } } }) =>
        question.factVersion.factDefinition.factKey,
    );
    expect(initialFactKeys).toEqual(expect.arrayContaining(['workCenter.workArrangement']));
    expect(new Set(initialFactKeys).size).toBe(initialFactKeys.length);
    const contextAnswer = await prisma.adaptiveFactAnswer.findFirst({
      where: {
        sessionId,
        factVersion: {
          factDefinition: { factKey: 'organization.strategicProtectionPriorities' },
        },
      },
    });
    expect(contextAnswer).toMatchObject({
      typedValue: ['BUSINESS_CONTINUITY', 'PEOPLE_AND_HEALTH'],
      source: 'USER_DECLARED',
    });

    const firstAnswers = run1.questions.map(
      (question: {
        scope: { id: string };
        factVersion: { id: string; factDefinition: { factKey: string } };
      }) => {
        const factKey = question.factVersion.factDefinition.factKey;
        const valueByFact: Record<string, unknown> = {
          'workCenter.workArrangement': 'PHYSICAL',
          'workCenter.activityCategory': 'ADMINISTRATIVE_SERVICES',
          'workCenter.hasWorkAtHeight': false,
          'workCenter.hasConfinedSpaces': false,
          'workCenter.hasExternalWorkforce': false,
        };
        return {
          scopeId: question.scope.id,
          factVersionId: question.factVersion.id,
          value: valueByFact[factKey],
        };
      },
    );
    const saved1 = await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/answers`)
      .send({ expectedSessionRevision: 1, answers: firstAnswers })
      .expect(201);
    expect(saved1.body.sessionRevision).toBe(2);
    await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/answers`)
      .send({ expectedSessionRevision: 1, answers: firstAnswers })
      .expect(409);
    await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/evaluate`)
      .send({ expectedSessionRevision: 2 })
      .expect(201);

    const afterFirst = await adaptive(owner.token, organizationA)
      .get(`/sessions/${sessionId}`)
      .expect(200);
    const run2 = afterFirst.body.runs[0];
    expect(run2.runNumber).toBe(2);
    expect(
      run2.questions.map(
        (question: { factVersion: { factDefinition: { factKey: string } } }) =>
          question.factVersion.factDefinition.factKey,
      ),
    ).toEqual(
      expect.arrayContaining(['workCenter.facilityType', 'workCenter.hasDistinctOperationalZones']),
    );
    expect(run1.questions).toEqual(created.body.runs[0].questions);

    const secondAnswers = run2.questions.map(
      (question: {
        scope: { id: string };
        factVersion: { id: string; factDefinition: { factKey: string } };
      }) => ({
        scopeId: question.scope.id,
        factVersionId: question.factVersion.id,
        value:
          question.factVersion.factDefinition.factKey === 'workCenter.facilityType'
            ? 'OFFICE'
            : false,
      }),
    );
    const saved2 = await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/answers`)
      .send({ expectedSessionRevision: 3, answers: secondAnswers })
      .expect(201);
    await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/evaluate`)
      .send({ expectedSessionRevision: saved2.body.sessionRevision })
      .expect(201);
    const resolved = await adaptive(owner.token, organizationA)
      .get(`/sessions/${sessionId}`)
      .expect(200);
    expect(resolved.body).toMatchObject({ status: 'READY_TO_PROPOSE', sessionRevision: 5 });
    expect(resolved.body.runs[0].questions).toHaveLength(0);
    const proposalId = resolved.body.runs[0].proposal.id as string;
    const proposal = await adaptive(owner.token, organizationA)
      .get(`/proposals/${proposalId}`)
      .expect(200);
    expect(proposal.body.items.length).toBeGreaterThan(0);
    expect(proposal.body).not.toHaveProperty('score');
    const item = proposal.body.items[0];

    for (const status of [
      'UNKNOWN',
      'NOT_IMPLEMENTED',
      'PLANNED',
      'IN_PROGRESS',
      'PARTIALLY_IMPLEMENTED',
      'IMPLEMENTED',
    ]) {
      const declaration = await adaptive(owner.token, organizationA)
        .post(`/proposals/${proposalId}/current-state`)
        .send({ itemId: item.id, status })
        .expect(201);
      expect(declaration.body.status).toBe(status);
    }
    await adaptive(owner.token, organizationA)
      .post(`/proposals/${proposalId}/evidence`)
      .send({ itemId: item.id, type: 'EXTERNAL_LINK', externalUrl: 'http://unsafe.example.test' })
      .expect(400);
    await adaptive(owner.token, organizationA)
      .post(`/proposals/${proposalId}/evidence`)
      .send({ itemId: item.id, type: 'NOTE', note: 'Registro sintético declarado.' })
      .expect(201);
    await adaptive(owner.token, organizationA)
      .post(`/proposals/${proposalId}/evidence`)
      .send({
        itemId: item.id,
        type: 'EXTERNAL_LINK',
        externalUrl: 'https://example.com/evidencia-demo',
      })
      .expect(201);
    const afterDeclaration = await adaptive(owner.token, organizationA)
      .get(`/proposals/${proposalId}`)
      .expect(200);
    expect(afterDeclaration.body.items[0]).toMatchObject({
      state: item.state,
      minimumDepth: item.minimumDepth,
      currentState: {
        status: 'IMPLEMENTED',
        evidence: [
          { type: 'NOTE', note: 'Registro sintético declarado.' },
          { type: 'EXTERNAL_LINK', externalUrl: 'https://example.com/evidencia-demo' },
        ],
      },
    });

    await adaptive(owner.token, organizationB).get(`/sessions/${sessionId}`).expect(404);
    await adaptive(owner.token, organizationB).get(`/proposals/${proposalId}`).expect(404);
    const finalized = await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/finalize`)
      .send({ expectedSessionRevision: 5 })
      .expect(201);
    expect(finalized.body.status).toBe('FINALIZED');
    await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/answers`)
      .send({ expectedSessionRevision: 6, answers: secondAnswers })
      .expect(409);

    const counts = await Promise.all([
      prisma.adaptiveEvaluationRun.count({ where: { sessionId } }),
      prisma.adaptiveConfigurationProposal.count({ where: { sessionId } }),
    ]);
    expect(counts).toEqual([3, 3]);
  });
});
