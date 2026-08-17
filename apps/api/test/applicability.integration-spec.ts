import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { DEMO_APPLICABILITY_RULE_PACK, type ApplicabilityRulePack } from '@sst/contracts';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('applicability engine integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const packKey = `TEST_APPLICABILITY_${suffix.replaceAll(/[^A-Za-z0-9]/g, '').toUpperCase()}`;

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
        password: 'applicability-password-strong-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
  }

  async function createOrganization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${label} ${suffix}`,
        country: 'Ecuador',
        sector: 'Tecnología',
      })
      .expect(201);
    return response.body.id as string;
  }

  function api(token: string, organizationId: string) {
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`/api/v1/applicability${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
      post: (path: string) =>
        request(app.getHttpServer())
          .post(`/api/v1/applicability${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
    };
  }

  it('persists immutable profile/rule snapshots, trace, roles and tenant boundaries', async () => {
    const owner = await register('Applicability Owner');
    const organizationA = await createOrganization(owner.token, 'Applicability Organization A');
    const organizationB = await createOrganization(owner.token, 'Applicability Organization B');
    const ownerApiA = api(owner.token, organizationA);

    const provisionedPacks = await ownerApiA.get('/rule-packs').expect(200);
    expect(provisionedPacks.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: DEMO_APPLICABILITY_RULE_PACK.key,
          version: DEMO_APPLICABILITY_RULE_PACK.version,
          sourceType: 'DEMO',
          regulatory: false,
          isDemo: true,
          status: 'ACTIVE',
        }),
      ]),
    );
    const provisionedDemoPack = await prisma.applicabilityRulePackVersion.findUniqueOrThrow({
      where: {
        key_version: {
          key: DEMO_APPLICABILITY_RULE_PACK.key,
          version: DEMO_APPLICABILITY_RULE_PACK.version,
        },
      },
      select: { schema: true },
    });
    expect(provisionedDemoPack.schema).toEqual(DEMO_APPLICABILITY_RULE_PACK);

    await ownerApiA
      .post('/profile-versions')
      .send({ workerCount: 25, organizationId: organizationB })
      .expect(400);

    const profileV1 = await ownerApiA
      .post('/profile-versions')
      .send({
        workerCount: 25,
        hasChemicalProcesses: false,
        hasHighEnergyOperations: true,
      })
      .expect(201);
    expect(profileV1.body).toMatchObject({
      version: 1,
      snapshot: {
        schemaVersion: '1.0.0',
        organization: {
          country: 'Ecuador',
          sector: 'Tecnología',
          workCenterCount: 1,
          workerCount: 25,
        },
        operations: { hasChemicalProcesses: false, hasHighEnergyOperations: true },
      },
    });

    const testPackV1: ApplicabilityRulePack = {
      ...DEMO_APPLICABILITY_RULE_PACK,
      key: packKey,
      name: 'Pack sintético de integración V1',
      version: '1.0.0',
      rules: [
        {
          id: 'TEST_WORKFORCE_V1',
          targetKey: 'TEST_WORKFORCE_TARGET',
          condition: {
            mode: 'ALL',
            predicates: [{ field: 'organization.workerCount', operator: 'NUMBER_GTE', value: 20 }],
          },
          state: 'RECOMMENDED',
          reasonCode: 'TEST_V1_MATCH',
          explanation: 'Regla sintética V1.',
        },
      ],
    };
    const packV1 = await prisma.applicabilityRulePackVersion.create({
      data: {
        key: testPackV1.key,
        name: testPackV1.name,
        version: testPackV1.version,
        schema: testPackV1 as Prisma.InputJsonValue,
        status: 'ACTIVE',
        sourceType: testPackV1.source.type,
        sourceReference: testPackV1.source.reference,
        regulatory: false,
        isDemo: true,
        disclaimer: testPackV1.disclaimer,
        activatedAt: new Date(),
      },
    });

    const assessmentA = await ownerApiA
      .post('/assessments')
      .send({ profileVersionId: profileV1.body.id, rulePackVersionId: packV1.id })
      .expect(201);
    const assessmentAId = assessmentA.body.id as string;
    expect(assessmentA.body).toMatchObject({
      profileVersionId: profileV1.body.id,
      rulePackVersionId: packV1.id,
      engineVersion: '1.0.0',
      profileSnapshot: profileV1.body.snapshot,
      rulePackSnapshot: { key: packKey, version: '1.0.0' },
      decisions: [
        {
          targetKey: 'TEST_WORKFORCE_TARGET',
          state: 'RECOMMENDED',
          reasonCode: 'TEST_V1_MATCH',
          sourceType: 'DEMO',
          traces: [
            {
              ruleId: 'TEST_WORKFORCE_V1',
              ruleResult: 'TRUE',
              contributedState: 'RECOMMENDED',
              predicates: [
                expect.objectContaining({
                  field: 'organization.workerCount',
                  actual: 25,
                  result: 'TRUE',
                }),
              ],
            },
          ],
        },
      ],
    });

    const profileV2 = await ownerApiA
      .post('/profile-versions')
      .send({ workerCount: 5, hasChemicalProcesses: true })
      .expect(201);
    expect(profileV2.body.version).toBe(2);
    expect(profileV2.body.id).not.toBe(profileV1.body.id);

    await prisma.applicabilityRulePackVersion.update({
      where: { id: packV1.id },
      data: { status: 'INACTIVE' },
    });
    const testPackV2: ApplicabilityRulePack = {
      ...testPackV1,
      name: 'Pack sintético de integración V2',
      version: '2.0.0',
      rules: [
        {
          ...testPackV1.rules[0]!,
          id: 'TEST_WORKFORCE_V2',
          state: 'OPTIONAL',
          reasonCode: 'TEST_V2_MATCH',
          explanation: 'Regla sintética V2.',
          condition: {
            mode: 'ALL',
            predicates: [{ field: 'organization.workerCount', operator: 'NUMBER_LTE', value: 10 }],
          },
        },
      ],
    };
    const packV2 = await prisma.applicabilityRulePackVersion.create({
      data: {
        key: testPackV2.key,
        name: testPackV2.name,
        version: testPackV2.version,
        schema: testPackV2 as Prisma.InputJsonValue,
        status: 'ACTIVE',
        sourceType: testPackV2.source.type,
        sourceReference: testPackV2.source.reference,
        regulatory: false,
        isDemo: true,
        disclaimer: testPackV2.disclaimer,
        activatedAt: new Date(),
      },
    });
    const assessmentB = await ownerApiA
      .post('/assessments')
      .send({ profileVersionId: profileV2.body.id, rulePackVersionId: packV2.id })
      .expect(201);
    expect(assessmentB.body).toMatchObject({
      profileVersionId: profileV2.body.id,
      rulePackVersionId: packV2.id,
      rulePackSnapshot: { version: '2.0.0' },
      decisions: [{ state: 'OPTIONAL', reasonCode: 'TEST_V2_MATCH' }],
    });

    const assessmentAAfterV2 = await ownerApiA.get(`/assessments/${assessmentAId}`).expect(200);
    expect(assessmentAAfterV2.body).toMatchObject({
      profileVersionId: profileV1.body.id,
      rulePackVersionId: packV1.id,
      profileSnapshot: profileV1.body.snapshot,
      rulePackSnapshot: { version: '1.0.0' },
      decisions: [{ state: 'RECOMMENDED', reasonCode: 'TEST_V1_MATCH' }],
    });

    await api(owner.token, organizationB).get(`/assessments/${assessmentAId}`).expect(404);
    await api(owner.token, organizationB)
      .get(`/profile-versions/${profileV1.body.id as string}`)
      .expect(404);
    await api(owner.token, organizationB)
      .post('/assessments')
      .send({ profileVersionId: profileV1.body.id, rulePackVersionId: packV2.id })
      .expect(404);

    const viewer = await register('Applicability Viewer');
    await prisma.membership.create({
      data: {
        organizationId: organizationA,
        userId: viewer.userId,
        role: 'VIEWER',
        status: 'ACTIVE',
      },
    });
    const viewerApi = api(viewer.token, organizationA);
    await viewerApi.get(`/assessments/${assessmentAId}`).expect(200);
    await viewerApi.get('/profile-versions').expect(200);
    await viewerApi.post('/profile-versions').send({ workerCount: 50 }).expect(403);
    await viewerApi
      .post('/assessments')
      .send({ profileVersionId: profileV2.body.id, rulePackVersionId: packV2.id })
      .expect(403);

    const manager = await register('Applicability Manager');
    await prisma.membership.create({
      data: {
        organizationId: organizationA,
        userId: manager.userId,
        role: 'SST_MANAGER',
        status: 'ACTIVE',
      },
    });
    const managerApi = api(manager.token, organizationA);
    const managerProfile = await managerApi
      .post('/profile-versions')
      .send({ workerCount: 30 })
      .expect(201);
    await managerApi
      .post('/assessments')
      .send({ profileVersionId: managerProfile.body.id, rulePackVersionId: packV2.id })
      .expect(201);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: organizationA,
          action: 'SST_PROFILE_VERSION_CREATED',
        },
      }),
    ).toBe(3);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: organizationA,
          action: 'APPLICABILITY_ASSESSMENT_COMPLETED',
        },
      }),
    ).toBe(3);
  }, 60_000);
});
