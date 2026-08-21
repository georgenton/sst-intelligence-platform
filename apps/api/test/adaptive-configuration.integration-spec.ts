import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ADAPTIVE_LIMITS, adaptiveRulePackSchema } from '@sst/contracts';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdaptivePublicationService } from '../src/adaptive-configuration/adaptive-publication.service';
import {
  ADAPTIVE_SESSION_MUTATION_SYNC,
  type AdaptiveSessionMutationOperation,
  type AdaptiveSessionMutationSync,
} from '../src/adaptive-configuration/adaptive-session-mutation-sync';
import { PrismaService } from '../src/prisma/prisma.service';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class IntegrationAdaptiveMutationSync implements AdaptiveSessionMutationSync {
  private active?: {
    sessionId: string;
    operation: AdaptiveSessionMutationOperation;
    claimed: boolean;
    winner: ReturnType<typeof deferred<void>>;
    loser: ReturnType<typeof deferred<void>>;
    release: ReturnType<typeof deferred<void>>;
  };

  hold(sessionId: string, operation: AdaptiveSessionMutationOperation) {
    const state = {
      sessionId,
      operation,
      claimed: false,
      winner: deferred<void>(),
      loser: deferred<void>(),
      release: deferred<void>(),
    };
    this.active = state;
    return {
      waitForWinner: () => state.winner.promise,
      waitForLoser: () => state.loser.promise,
      release: () => state.release.resolve(),
      cleanup: () => {
        state.release.resolve();
        if (this.active === state) this.active = undefined;
      },
    };
  }

  async point(context: Parameters<AdaptiveSessionMutationSync['point']>[0]) {
    const state = this.active;
    if (!state || context.sessionId !== state.sessionId) return;
    if (context.phase === 'AFTER_SUCCESSFUL_CLAIM' && context.operation === state.operation) {
      state.claimed = true;
      state.winner.resolve();
      await state.release.promise;
      return;
    }
    if (context.phase === 'BEFORE_CLAIM' && state.claimed) state.loser.resolve();
  }
}

describe('adaptive configuration integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let publication: AdaptivePublicationService;
  const mutationSync = new IntegrationAdaptiveMutationSync();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const keySuffix = suffix.replaceAll('-', '_').toUpperCase();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ADAPTIVE_SESSION_MUTATION_SYNC)
      .useValue(mutationSync)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    publication = app.get(AdaptivePublicationService);
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
      (candidate: { version: string; packDefinition: { packKey: string } }) =>
        candidate.packDefinition.packKey === 'DEMO_ADAPTIVE_SST_CONFIGURATION' &&
        candidate.version === '1.0.0',
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

    const historicalQuestion = await prisma.adaptiveGeneratedQuestion.findFirstOrThrow({
      where: { evaluationRunId: run1.id },
      include: { factVersion: true },
      orderBy: { sortOrder: 'asc' },
    });
    const historicalItem = await prisma.adaptiveConfigurationItem.findFirstOrThrow({
      where: { proposalId },
      include: { targetVersion: true },
    });
    const contributingRuleId = (historicalItem.ruleVersionProvenance as string[])[0]!;
    const historicalRule = await prisma.adaptiveRuleVersion.findUniqueOrThrow({
      where: { id: contributingRuleId },
      include: { ruleDefinition: true },
    });
    const historicalGroupMembership = await prisma.adaptiveRuleGroupRule.findFirstOrThrow({
      where: { ruleVersionId: historicalRule.id },
      include: {
        groupVersion: {
          include: { groupDefinition: true, groupRules: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    const historicalPack = await prisma.adaptiveRulePackVersion.findUniqueOrThrow({
      where: { id: pack.id },
      include: { facts: true, targets: true, rules: true, groups: true },
    });
    const baselineRun = await prisma.adaptiveEvaluationRun.findFirstOrThrow({
      where: { sessionId },
      orderBy: { runNumber: 'desc' },
    });
    const versioningSnapshot = {
      questionFactVersionId: historicalQuestion.factVersionId,
      questionText: historicalQuestion.questionText,
      runPackVersionId: baselineRun.packVersionId,
      inputHash: baselineRun.inputHash,
      outputHash: baselineRun.outputHash,
      outputSnapshot: baselineRun.outputSnapshot,
      itemTargetVersionId: historicalItem.targetVersionId,
      itemTargetTitle: historicalItem.targetVersion.title,
      itemRuleVersionIds: historicalItem.ruleVersionProvenance,
      itemTrace: historicalItem.trace,
    };
    const testVersion = '2.0.0';
    const packV1Contract = adaptiveRulePackSchema.parse(historicalPack.schema);
    const factV2 = await prisma.adaptiveFactVersion.create({
      data: {
        factDefinitionId: historicalQuestion.factVersion.factDefinitionId,
        version: testVersion,
        valueType: historicalQuestion.factVersion.valueType,
        questionText: 'Redacción v2 que no debe reescribir la pregunta histórica',
        helpText: historicalQuestion.factVersion.helpText,
        unknownAllowed: historicalQuestion.factVersion.unknownAllowed,
        collectionMode: historicalQuestion.factVersion.collectionMode,
        validation: historicalQuestion.factVersion.validation as Prisma.InputJsonValue,
        choiceOptions: historicalQuestion.factVersion.choiceOptions as Prisma.InputJsonValue,
        priority: historicalQuestion.factVersion.priority,
      },
    });
    const targetV2 = await prisma.adaptiveConfigurationTargetVersion.create({
      data: {
        targetDefinitionId: historicalItem.targetVersion.targetDefinitionId,
        version: testVersion,
        title: `${historicalItem.targetVersion.title} v2`,
        description: historicalItem.targetVersion.description,
        category: historicalItem.targetVersion.category,
        currentStateQuestion: historicalItem.targetVersion.currentStateQuestion,
        evidenceSuggestions: historicalItem.targetVersion
          .evidenceSuggestions as Prisma.InputJsonValue,
        isDemo: true,
      },
    });
    const ruleV2Contract = {
      ...adaptiveRulePackSchema
        .parse(historicalPack.schema)
        .rules.find(({ ruleKey }) => ruleKey === historicalRule.ruleDefinition.ruleKey)!,
      version: testVersion,
    };
    const draftV2 = await prisma.adaptiveRuleDraft.create({
      data: {
        ruleDefinitionId: historicalRule.ruleDefinitionId,
        revision: 2,
        status: 'READY_TO_PUBLISH',
        schema: ruleV2Contract as Prisma.InputJsonValue,
        isDemo: true,
        regulatory: false,
        demoDisclaimer: historicalPack.disclaimer,
        technicalReviewedAt: new Date(),
        legalReviewedAt: new Date(),
      },
    });
    const ruleV2 = await publication.publishRuleDraft({
      draftId: draftV2.id,
      version: testVersion,
      supersedesRuleVersionId: historicalRule.id,
    });
    const groupV1 = historicalGroupMembership.groupVersion;
    const groupV2Contract = {
      ...packV1Contract.groups.find(
        ({ groupKey }) => groupKey === groupV1.groupDefinition.groupKey,
      )!,
      version: testVersion,
    };
    const groupV2 = await publication.publishRuleGroupVersion({
      groupDefinitionId: groupV1.groupDefinitionId,
      group: groupV2Contract,
      ruleVersionIds: groupV1.groupRules.map(({ ruleVersionId }) =>
        ruleVersionId === historicalRule.id ? ruleV2.id : ruleVersionId,
      ),
      supersedesGroupVersionId: groupV1.id,
    });
    const packV2Contract = structuredClone(packV1Contract);
    packV2Contract.version = testVersion;
    packV2Contract.factVersions = packV2Contract.factVersions.map((fact) =>
      fact.factKey ===
      packV1Contract.factVersions.find(
        (candidate) => candidate.questionText === historicalQuestion.questionText,
      )?.factKey
        ? { ...fact, version: testVersion, questionText: factV2.questionText }
        : fact,
    );
    packV2Contract.targetVersions = packV2Contract.targetVersions.map((target) =>
      target.targetKey ===
      packV1Contract.targetVersions.find(
        (candidate) => candidate.title === historicalItem.targetVersion.title,
      )?.targetKey
        ? { ...target, version: testVersion, title: targetV2.title }
        : target,
    );
    packV2Contract.rules = packV2Contract.rules.map((rule) =>
      rule.ruleKey === historicalRule.ruleDefinition.ruleKey ? ruleV2Contract : rule,
    );
    packV2Contract.groups = packV2Contract.groups.map((group) =>
      group.groupKey === groupV1.groupDefinition.groupKey ? groupV2Contract : group,
    );
    const packV2 = await publication.publishRulePackVersion({
      packDefinitionId: historicalPack.packDefinitionId,
      pack: packV2Contract,
      factVersionIds: historicalPack.facts.map(({ factVersionId }) =>
        factVersionId === historicalQuestion.factVersionId ? factV2.id : factVersionId,
      ),
      targetVersionIds: historicalPack.targets.map(({ targetVersionId }) =>
        targetVersionId === historicalItem.targetVersionId ? targetV2.id : targetVersionId,
      ),
      ruleVersionIds: historicalPack.rules.map(({ ruleVersionId }) =>
        ruleVersionId === historicalRule.id ? ruleV2.id : ruleVersionId,
      ),
      groupVersionIds: historicalPack.groups.map(({ groupVersionId }) =>
        groupVersionId === groupV1.id ? groupV2.id : groupVersionId,
      ),
    });
    expect(packV2).toMatchObject({ version: testVersion, sealedAt: expect.any(Date) });

    await expect(
      prisma.adaptiveRulePackFact.create({
        data: { packVersionId: historicalPack.id, factVersionId: factV2.id },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackFact.delete({
        where: {
          packVersionId_factVersionId: {
            packVersionId: historicalPack.id,
            factVersionId: historicalQuestion.factVersionId,
          },
        },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackFact.update({
        where: {
          packVersionId_factVersionId: {
            packVersionId: historicalPack.id,
            factVersionId: historicalQuestion.factVersionId,
          },
        },
        data: { factVersionId: factV2.id },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackRule.create({
        data: { packVersionId: historicalPack.id, ruleVersionId: ruleV2.id },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackRule.delete({
        where: {
          packVersionId_ruleVersionId: {
            packVersionId: historicalPack.id,
            ruleVersionId: historicalRule.id,
          },
        },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackTarget.create({
        data: { packVersionId: historicalPack.id, targetVersionId: targetV2.id },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackTarget.delete({
        where: {
          packVersionId_targetVersionId: {
            packVersionId: historicalPack.id,
            targetVersionId: historicalItem.targetVersionId,
          },
        },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackGroup.create({
        data: { packVersionId: historicalPack.id, groupVersionId: groupV2.id },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRulePackGroup.delete({
        where: {
          packVersionId_groupVersionId: {
            packVersionId: historicalPack.id,
            groupVersionId: groupV1.id,
          },
        },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRuleGroupRule.create({
        data: { groupVersionId: groupV1.id, ruleVersionId: ruleV2.id, sortOrder: 999 },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRuleGroupRule.update({
        where: {
          groupVersionId_ruleVersionId: {
            groupVersionId: groupV1.id,
            ruleVersionId: historicalRule.id,
          },
        },
        data: { sortOrder: 999 },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRuleGroupRule.delete({
        where: {
          groupVersionId_ruleVersionId: {
            groupVersionId: groupV1.id,
            ruleVersionId: historicalRule.id,
          },
        },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRuleRequirement.create({
        data: {
          ruleVersionId: historicalRule.id,
          requirementId: '00000000-0000-4000-8000-000000000001',
          relationshipType: 'PRIMARY_REQUIREMENT',
        },
      }),
    ).rejects.toThrow('adaptive sealed aggregate membership is immutable');
    await expect(
      prisma.adaptiveRuleVersion.update({
        where: { id: historicalRule.id },
        data: { demoDisclaimer: 'Intento de reescritura' },
      }),
    ).rejects.toThrow('adaptive sealed aggregate is immutable');
    await expect(
      prisma.adaptiveRuleVersion.delete({ where: { id: historicalRule.id } }),
    ).rejects.toThrow('adaptive sealed aggregate is immutable');
    await expect(
      prisma.adaptiveRuleGroupVersion.update({
        where: { id: groupV1.id },
        data: { title: 'Intento de reescritura' },
      }),
    ).rejects.toThrow('adaptive sealed aggregate is immutable');
    await expect(
      prisma.adaptiveRuleGroupVersion.delete({ where: { id: groupV1.id } }),
    ).rejects.toThrow('adaptive sealed aggregate is immutable');
    await expect(
      prisma.adaptiveRulePackVersion.update({
        where: { id: historicalPack.id },
        data: { disclaimer: 'Intento de reescritura' },
      }),
    ).rejects.toThrow('adaptive sealed aggregate is immutable');
    await expect(
      prisma.adaptiveRulePackVersion.delete({ where: { id: historicalPack.id } }),
    ).rejects.toThrow('adaptive sealed aggregate is immutable');

    await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/evaluate`)
      .send({ expectedSessionRevision: 5 })
      .expect(201);
    const afterV2 = await prisma.adaptiveEvaluationRun.findFirstOrThrow({
      where: { sessionId },
      orderBy: { runNumber: 'desc' },
      include: { proposal: { include: { items: true } } },
    });
    expect(afterV2).toMatchObject({
      packVersionId: historicalPack.id,
      inputHash: baselineRun.inputHash,
      outputHash: baselineRun.outputHash,
    });
    expect(afterV2.proposal?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetVersionId: historicalItem.targetVersionId,
          ruleVersionProvenance: expect.arrayContaining([historicalRule.id]),
        }),
      ]),
    );
    const preservedQuestion = await prisma.adaptiveGeneratedQuestion.findUniqueOrThrow({
      where: { id: historicalQuestion.id },
    });
    const preservedItem = await prisma.adaptiveConfigurationItem.findUniqueOrThrow({
      where: { id: historicalItem.id },
      include: { targetVersion: true },
    });
    expect({
      questionFactVersionId: preservedQuestion.factVersionId,
      questionText: preservedQuestion.questionText,
      runPackVersionId: baselineRun.packVersionId,
      inputHash: baselineRun.inputHash,
      outputHash: baselineRun.outputHash,
      outputSnapshot: baselineRun.outputSnapshot,
      itemTargetVersionId: preservedItem.targetVersionId,
      itemTargetTitle: preservedItem.targetVersion.title,
      itemRuleVersionIds: preservedItem.ruleVersionProvenance,
      itemTrace: preservedItem.trace,
    }).toEqual(versioningSnapshot);

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
      .send({ expectedSessionRevision: 6 })
      .expect(201);
    expect(finalized.body.status).toBe('FINALIZED');
    await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/answers`)
      .send({ expectedSessionRevision: 7, answers: secondAnswers })
      .expect(409);
    await adaptive(owner.token, organizationA)
      .post(`/sessions/${sessionId}/evaluate`)
      .send({ expectedSessionRevision: 7 })
      .expect(409);
    await adaptive(owner.token, organizationA)
      .post(`/proposals/${proposalId}/current-state`)
      .send({ itemId: item.id, status: 'PARTIALLY_IMPLEMENTED' })
      .expect(201);
    await adaptive(owner.token, organizationA)
      .post(`/proposals/${proposalId}/evidence`)
      .send({ itemId: item.id, type: 'NOTE', note: 'Seguimiento posterior a finalización.' })
      .expect(201);
    const frozenRun = await prisma.adaptiveEvaluationRun.findUniqueOrThrow({
      where: { id: afterV2.id },
    });
    const frozenItem = await prisma.adaptiveConfigurationItem.findUniqueOrThrow({
      where: { id: historicalItem.id },
    });
    expect(frozenRun).toMatchObject({
      inputHash: afterV2.inputHash,
      outputHash: afterV2.outputHash,
      outputSnapshot: afterV2.outputSnapshot,
    });
    expect(frozenItem).toMatchObject({
      state: historicalItem.state,
      minimumDepth: historicalItem.minimumDepth,
      professionalReview: historicalItem.professionalReview,
      trace: historicalItem.trace,
    });

    const counts = await Promise.all([
      prisma.adaptiveEvaluationRun.count({ where: { sessionId } }),
      prisma.adaptiveConfigurationProposal.count({ where: { sessionId } }),
    ]);
    expect(counts).toEqual([4, 4]);
  });

  it('allows exactly one concurrent revision claim and returns controlled stale conflicts', async () => {
    const owner = await register('adaptive-concurrency-owner');
    const organizationId = await createOrganization(owner.token, 'Adaptive Concurrency');
    const profile = await request(app.getHttpServer())
      .post('/api/v1/applicability/profile-versions')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .send({ workerCount: 8, hasChemicalProcesses: false, hasHighEnergyOperations: false })
      .expect(201);
    const packs = await adaptive(owner.token, organizationId).get('/rule-packs').expect(200);
    const pack = packs.body.find(
      (candidate: { packDefinition: { packKey: string } }) =>
        candidate.packDefinition.packKey === 'DEMO_ADAPTIVE_SST_CONFIGURATION',
    );
    const created = await adaptive(owner.token, organizationId)
      .post('/sessions')
      .send({ profileVersionId: profile.body.id, rulePackVersionId: pack.id })
      .expect(201);
    const sessionId = created.body.id as string;
    const question = created.body.runs[0].questions[0];
    const factKey = question.factVersion.factDefinition.factKey as string;
    const valueByFact: Record<string, unknown> = {
      'workCenter.workArrangement': 'PHYSICAL',
      'workCenter.activityCategory': 'ADMINISTRATIVE_SERVICES',
      'workCenter.hasWorkAtHeight': false,
      'workCenter.hasConfinedSpaces': false,
      'workCenter.hasExternalWorkforce': false,
    };
    const answers = [
      {
        scopeId: question.scope.id,
        factVersionId: question.factVersion.id,
        value: valueByFact[factKey],
      },
    ];

    const race = async (winnerRevision: number, loser: 'SUBMIT_ANSWERS' | 'EVALUATE') => {
      const control = mutationSync.hold(sessionId, 'SUBMIT_ANSWERS');
      try {
        const winner = Promise.resolve(
          adaptive(owner.token, organizationId)
            .post(`/sessions/${sessionId}/answers`)
            .send({ expectedSessionRevision: winnerRevision, answers }),
        );
        await control.waitForWinner();
        const losingRequest =
          loser === 'SUBMIT_ANSWERS'
            ? adaptive(owner.token, organizationId)
                .post(`/sessions/${sessionId}/answers`)
                .send({ expectedSessionRevision: winnerRevision, answers })
            : adaptive(owner.token, organizationId)
                .post(`/sessions/${sessionId}/evaluate`)
                .send({ expectedSessionRevision: winnerRevision });
        const losing = Promise.resolve(losingRequest);
        await control.waitForLoser();
        control.release();
        return Promise.all([winner, losing]);
      } finally {
        control.cleanup();
      }
    };

    const firstRace = await race(1, 'SUBMIT_ANSWERS');
    expect(firstRace.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      await prisma.adaptiveConfigurationSession.findUniqueOrThrow({ where: { id: sessionId } }),
    ).toMatchObject({ sessionRevision: 2 });
    expect(await prisma.adaptiveFactAnswer.count({ where: { sessionId } })).toBeGreaterThan(0);

    const staleEvaluationRace = await race(2, 'EVALUATE');
    expect(staleEvaluationRace[0].status).toBe(201);
    expect(staleEvaluationRace[1]).toMatchObject({ status: 409 });
    expect(staleEvaluationRace[1].body).toMatchObject({ code: 'ADAPTIVE_SESSION_CONFLICT' });
    expect(
      await prisma.adaptiveConfigurationSession.findUniqueOrThrow({ where: { id: sessionId } }),
    ).toMatchObject({ sessionRevision: 3 });
  });

  it('enforces the regulatory publication lifecycle and database-backed aggregate seal', async () => {
    const regulatoryCountsBefore = await Promise.all([
      prisma.regulatoryProvision.count(),
      prisma.regulatoryRequirement.count(),
      prisma.regulatoryRequirementSource.count(),
    ]);
    await expect(
      prisma.$transaction(async (tx) => {
        let savepointSequence = 0;
        const expectDatabaseRejection = async (
          operation: () => Promise<unknown>,
          message: string,
        ) => {
          savepointSequence += 1;
          const savepoint = `adaptive_publication_rejection_${savepointSequence}`;
          await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
          let rejection: unknown;
          try {
            await operation();
          } catch (error) {
            rejection = error;
          }
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
          expect(rejection).toBeInstanceOf(Error);
          expect((rejection as Error).message).toContain(message);
        };
        const sourceVersion = await tx.regulatorySourceVersion.findFirstOrThrow();
        const provision = await tx.regulatoryProvision.create({
          data: {
            sourceVersionId: sourceVersion.id,
            provisionKey: `ADAPTIVE_TEST_PROVISION_${keySuffix}`,
            locatorType: 'OTHER',
            locatorLabel: 'Fixture sintético de publicación adaptativa',
            editorialStatus: 'DRAFT',
          },
        });
        let requirementSequence = 0;
        const createRequirement = async (
          targetStatus:
            | 'DRAFT'
            | 'TECHNICAL_REVIEW_PENDING'
            | 'LEGAL_REVIEW_PENDING'
            | 'APPROVED_FOR_RULE_DRAFTING'
            | 'REJECTED'
            | 'SUPERSEDED',
        ) => {
          requirementSequence += 1;
          const requirement = await tx.regulatoryRequirement.create({
            data: {
              requirementKey: `ADAPTIVE_TEST_REQUIREMENT_${keySuffix}_${requirementSequence}`,
              title: `Requisito sintético ${requirementSequence}`,
              description: 'Fixture sin contenido regulatorio real.',
              editorialStatus: 'DRAFT',
            },
          });
          if (targetStatus === 'DRAFT') return requirement;
          if (targetStatus === 'REJECTED')
            return tx.regulatoryRequirement.update({
              where: { id: requirement.id },
              data: { editorialStatus: 'REJECTED' },
            });
          const technical = await tx.regulatoryRequirement.update({
            where: { id: requirement.id },
            data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
          });
          if (targetStatus === 'TECHNICAL_REVIEW_PENDING') return technical;
          const legal = await tx.regulatoryRequirement.update({
            where: { id: requirement.id },
            data: { editorialStatus: 'LEGAL_REVIEW_PENDING' },
          });
          if (targetStatus === 'LEGAL_REVIEW_PENDING') return legal;
          await tx.regulatoryRequirementSource.create({
            data: {
              requirementId: requirement.id,
              provisionId: provision.id,
              relationshipType: 'PRIMARY_SOURCE',
            },
          });
          const approved = await tx.regulatoryRequirement.update({
            where: { id: requirement.id },
            data: { editorialStatus: 'APPROVED_FOR_RULE_DRAFTING' },
          });
          if (targetStatus === 'APPROVED_FOR_RULE_DRAFTING') return approved;
          requirementSequence += 1;
          await tx.regulatoryRequirement.create({
            data: {
              requirementKey: `ADAPTIVE_TEST_REQUIREMENT_${keySuffix}_${requirementSequence}`,
              title: `Reemplazo sintético ${requirementSequence}`,
              description: 'Fixture de reemplazo sin contenido regulatorio real.',
              editorialStatus: 'DRAFT',
              supersedesRequirementId: approved.id,
            },
          });
          return tx.regulatoryRequirement.update({
            where: { id: approved.id },
            data: { editorialStatus: 'SUPERSEDED' },
          });
        };

        const definition = await tx.adaptiveRuleDefinition.create({
          data: { ruleKey: `REGULATORY_PUBLICATION_${keySuffix}` },
        });
        const ruleTemplate = adaptiveRulePackSchema.parse(
          (
            await tx.adaptiveRulePackVersion.findFirstOrThrow({
              where: { isDemo: true, sealedAt: { not: null } },
              select: { schema: true },
            })
          ).schema,
        ).rules[0]!;
        let draftRevision = 0;
        const createDraft = async (version: string) => {
          draftRevision += 1;
          return tx.adaptiveRuleDraft.create({
            data: {
              ruleDefinitionId: definition.id,
              revision: draftRevision,
              status: 'READY_TO_PUBLISH',
              schema: {
                ...ruleTemplate,
                ruleKey: definition.ruleKey,
                version,
                isDemo: false,
                regulatory: true,
              } as Prisma.InputJsonValue,
              isDemo: false,
              regulatory: true,
              technicalReviewedAt: new Date(),
              legalReviewedAt: new Date(),
            },
          });
        };

        const zeroRequirementDraft = await createDraft('1.0.0');
        await expect(
          publication.publishRuleDraft(
            {
              draftId: zeroRequirementDraft.id,
              version: '1.0.0',
            },
            tx,
          ),
        ).rejects.toThrow('Regulatory rule requires provenance');

        for (const [index, status] of [
          'DRAFT',
          'TECHNICAL_REVIEW_PENDING',
          'LEGAL_REVIEW_PENDING',
          'REJECTED',
          'SUPERSEDED',
        ].entries()) {
          const requirement = await createRequirement(
            status as
              | 'DRAFT'
              | 'TECHNICAL_REVIEW_PENDING'
              | 'LEGAL_REVIEW_PENDING'
              | 'REJECTED'
              | 'SUPERSEDED',
          );
          const version = `1.0.${index + 1}`;
          const draft = await createDraft(version);
          await expect(
            publication.publishRuleDraft(
              {
                draftId: draft.id,
                version,
                requirementLinks: [
                  { requirementId: requirement.id, relationshipType: 'PRIMARY_REQUIREMENT' },
                ],
              },
              tx,
            ),
          ).rejects.toThrow('Regulatory rule requires approved requirements');
        }

        const approvedRequirement = await createRequirement('APPROVED_FOR_RULE_DRAFTING');
        const approvedDraft = await createDraft('2.0.0');
        const ruleV1 = await publication.publishRuleDraft(
          {
            draftId: approvedDraft.id,
            version: '2.0.0',
            requirementLinks: [
              { requirementId: approvedRequirement.id, relationshipType: 'PRIMARY_REQUIREMENT' },
            ],
          },
          tx,
        );
        expect(ruleV1).toMatchObject({
          sourceDraftId: approvedDraft.id,
          sealedAt: expect.any(Date),
          sourceDraft: { status: 'READY_TO_PUBLISH' },
        });
        expect(
          await tx.adaptiveRuleDraft.findUniqueOrThrow({ where: { id: approvedDraft.id } }),
        ).toMatchObject({ status: 'PUBLISHED' });
        await expectDatabaseRejection(
          () =>
            tx.adaptiveRuleDraft.update({
              where: { id: approvedDraft.id },
              data: { status: 'REJECTED' },
            }),
          'published adaptive rule draft is immutable',
        );

        const approvedRequirementV2 = await createRequirement('APPROVED_FOR_RULE_DRAFTING');
        const draftV2 = await createDraft('2.1.0');
        const ruleV2 = await publication.publishRuleDraft(
          {
            draftId: draftV2.id,
            version: '2.1.0',
            supersedesRuleVersionId: ruleV1.id,
            requirementLinks: [
              { requirementId: approvedRequirementV2.id, relationshipType: 'PRIMARY_REQUIREMENT' },
            ],
          },
          tx,
        );
        expect(ruleV2).toMatchObject({ supersedesRuleVersionId: ruleV1.id });
        expect(
          await tx.adaptiveRuleVersion.findUniqueOrThrow({ where: { id: ruleV1.id } }),
        ).toMatchObject({
          version: '2.0.0',
          sourceDraftId: approvedDraft.id,
          sealedAt: ruleV1.sealedAt,
        });

        const demoPack = await tx.adaptiveRulePackVersion.findFirstOrThrow({
          where: { version: '1.0.0', isDemo: true, sealedAt: { not: null } },
          include: {
            facts: true,
            targets: true,
            rules: { include: { ruleVersion: { include: { ruleDefinition: true } } } },
            groups: true,
          },
        });
        const mixedPackContract = adaptiveRulePackSchema.parse(demoPack.schema);
        const replacedRuleKey = ruleTemplate.ruleKey;
        mixedPackContract.version = '98.0.0';
        mixedPackContract.rules = mixedPackContract.rules.map((rule) =>
          rule.ruleKey === replacedRuleKey
            ? {
                ...rule,
                ruleKey: definition.ruleKey,
                version: ruleV2.version,
                isDemo: false,
                regulatory: true,
              }
            : rule,
        );
        mixedPackContract.groups = mixedPackContract.groups.map((group) => ({
          ...group,
          ruleKeys: group.ruleKeys.map((ruleKey) =>
            ruleKey === replacedRuleKey ? definition.ruleKey : ruleKey,
          ),
        }));
        await expect(
          publication.publishRulePackVersion(
            {
              packDefinitionId: demoPack.packDefinitionId,
              pack: mixedPackContract,
              factVersionIds: demoPack.facts.map(({ factVersionId }) => factVersionId),
              targetVersionIds: demoPack.targets.map(({ targetVersionId }) => targetVersionId),
              ruleVersionIds: demoPack.rules.map(({ ruleVersionId, ruleVersion }) =>
                ruleVersion.ruleDefinition.ruleKey === replacedRuleKey ? ruleV2.id : ruleVersionId,
              ),
              groupVersionIds: demoPack.groups.map(({ groupVersionId }) => groupVersionId),
            },
            tx,
          ),
        ).rejects.toThrow('Pack contains boundary-incompatible content');

        const replacement = await tx.regulatoryRequirement.create({
          data: {
            requirementKey: `ADAPTIVE_TEST_REQUIREMENT_REPLACEMENT_${keySuffix}`,
            title: 'Reemplazo sintético histórico',
            description: 'Fixture de reemplazo sin contenido regulatorio real.',
            editorialStatus: 'DRAFT',
            supersedesRequirementId: approvedRequirement.id,
          },
        });
        expect(replacement.supersedesRequirementId).toBe(approvedRequirement.id);
        await tx.regulatoryRequirement.update({
          where: { id: approvedRequirement.id },
          data: { editorialStatus: 'SUPERSEDED' },
        });
        expect(
          await tx.adaptiveRuleVersion.findUniqueOrThrow({ where: { id: ruleV1.id } }),
        ).toMatchObject({
          id: ruleV1.id,
          sealedAt: ruleV1.sealedAt,
        });
        const supersededDraft = await createDraft('2.2.0');
        await expect(
          publication.publishRuleDraft(
            {
              draftId: supersededDraft.id,
              version: '2.2.0',
              requirementLinks: [
                { requirementId: approvedRequirement.id, relationshipType: 'PRIMARY_REQUIREMENT' },
              ],
            },
            tx,
          ),
        ).rejects.toThrow('Regulatory rule requires approved requirements');

        const extraApprovedRequirement = await createRequirement('APPROVED_FOR_RULE_DRAFTING');
        const ruleRequirement = await tx.adaptiveRuleRequirement.findFirstOrThrow({
          where: { ruleVersionId: ruleV2.id },
        });
        await expectDatabaseRejection(
          () =>
            tx.adaptiveRuleRequirement.create({
              data: {
                ruleVersionId: ruleV2.id,
                requirementId: extraApprovedRequirement.id,
                relationshipType: 'SUPPORTING_REQUIREMENT',
              },
            }),
          'adaptive sealed aggregate membership is immutable',
        );
        await expectDatabaseRejection(
          () =>
            tx.adaptiveRuleRequirement.update({
              where: { id: ruleRequirement.id },
              data: { relationshipType: 'RELATED_REQUIREMENT' },
            }),
          'adaptive sealed aggregate membership is immutable',
        );
        await expectDatabaseRejection(
          () => tx.adaptiveRuleRequirement.delete({ where: { id: ruleRequirement.id } }),
          'adaptive sealed aggregate membership is immutable',
        );

        const bypassDraft = await createDraft('9.0.0');
        const unsealed = await tx.adaptiveRuleVersion.create({
          data: {
            ruleDefinitionId: definition.id,
            version: '9.0.0',
            schema: bypassDraft.schema as Prisma.InputJsonValue,
            isDemo: false,
            regulatory: true,
            sourceDraftId: bypassDraft.id,
          },
        });
        await expectDatabaseRejection(
          () =>
            tx.adaptiveRuleVersion.update({
              where: { id: unsealed.id },
              data: { publishedAt: new Date(), sealedAt: new Date() },
            }),
          'regulatory adaptive rule requires provenance',
        );
        throw new Error('ADAPTIVE_PUBLICATION_TEST_ROLLBACK');
      }),
    ).rejects.toThrow('ADAPTIVE_PUBLICATION_TEST_ROLLBACK');
    expect(
      await Promise.all([
        prisma.regulatoryProvision.count(),
        prisma.regulatoryRequirement.count(),
        prisma.regulatoryRequirementSource.count(),
      ]),
    ).toEqual(regulatoryCountsBefore);
  });

  it('rejects cross-scope answers and caps historical evaluation runs without deleting them', async () => {
    const owner = await register('adaptive-limit-owner');
    const organizationId = await createOrganization(owner.token, 'Adaptive Limits');
    const profile = await request(app.getHttpServer())
      .post('/api/v1/applicability/profile-versions')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .send({ workerCount: 8, hasChemicalProcesses: false, hasHighEnergyOperations: false })
      .expect(201);
    const packs = await adaptive(owner.token, organizationId).get('/rule-packs').expect(200);
    const pack = packs.body.find(
      (candidate: { packDefinition: { packKey: string } }) =>
        candidate.packDefinition.packKey === 'DEMO_ADAPTIVE_SST_CONFIGURATION',
    );
    const sealedPack = await prisma.adaptiveRulePackVersion.findUniqueOrThrow({
      where: { id: pack.id },
    });
    const unsealedPack = await prisma.adaptiveRulePackVersion.create({
      data: {
        packDefinitionId: sealedPack.packDefinitionId,
        version: `99.0.${Date.now() % 1_000_000}`,
        engineSchemaVersion: sealedPack.engineSchemaVersion,
        schema: sealedPack.schema as Prisma.InputJsonValue,
        contentHash: `sha256:${'3'.repeat(64)}`,
        isDemo: true,
        regulatory: false,
        disclaimer: sealedPack.disclaimer,
      },
    });
    await adaptive(owner.token, organizationId)
      .post('/sessions')
      .send({ profileVersionId: profile.body.id, rulePackVersionId: unsealedPack.id })
      .expect(404);
    await expect(
      prisma.adaptiveConfigurationSession.create({
        data: {
          organizationId,
          profileVersionId: profile.body.id,
          rulePackVersionId: unsealedPack.id,
          createdById: owner.userId,
        },
      }),
    ).rejects.toThrow('adaptive session requires sealed rule pack version');
    const created = await adaptive(owner.token, organizationId)
      .post('/sessions')
      .send({ profileVersionId: profile.body.id, rulePackVersionId: pack.id })
      .expect(201);
    const organizationScope = created.body.scopes.find(
      (scope: { kind: string }) => scope.kind === 'ORGANIZATION',
    );
    const workCenterQuestion = created.body.runs[0].questions.find(
      (question: { scope: { kind: string } }) => question.scope.kind === 'WORK_CENTER',
    );
    await adaptive(owner.token, organizationId)
      .post(`/sessions/${created.body.id}/answers`)
      .send({
        expectedSessionRevision: 1,
        answers: [
          {
            scopeId: organizationScope.id,
            factVersionId: workCenterQuestion.factVersion.id,
            value: false,
          },
        ],
      })
      .expect(403);
    expect(
      await prisma.adaptiveConfigurationSession.findUniqueOrThrow({
        where: { id: created.body.id },
      }),
    ).toMatchObject({ sessionRevision: 1 });

    await prisma.adaptiveEvaluationRun.createMany({
      data: Array.from({ length: ADAPTIVE_LIMITS.evaluationRunsPerSession - 1 }, (_, index) => ({
        organizationId,
        sessionId: created.body.id as string,
        runNumber: index + 2,
        sessionRevision: 1,
        engineVersion: '1.0.0',
        packVersionId: pack.id as string,
        inputSnapshot: {} as Prisma.InputJsonValue,
        outputSnapshot: {} as Prisma.InputJsonValue,
        inputHash: `sha256:${'1'.repeat(64)}`,
        outputHash: `sha256:${'2'.repeat(64)}`,
      })),
    });
    const limited = await adaptive(owner.token, organizationId)
      .post(`/sessions/${created.body.id}/evaluate`)
      .send({ expectedSessionRevision: 1 })
      .expect(400);
    expect(limited.body).toMatchObject({
      code: 'ADAPTIVE_LIMIT_EXCEEDED',
      limit: 'evaluationRunsPerSession',
    });
    expect(
      await prisma.adaptiveEvaluationRun.count({ where: { sessionId: created.body.id } }),
    ).toBe(ADAPTIVE_LIMITS.evaluationRunsPerSession);
    expect(
      await prisma.adaptiveConfigurationSession.findUniqueOrThrow({
        where: { id: created.body.id },
      }),
    ).toMatchObject({ sessionRevision: 1 });
  });
});
