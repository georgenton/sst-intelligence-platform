import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('unified regulatory evidence runtime integration', () => {
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

  async function actor(label: string) {
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `unified-${label}-${suffix}@example.test`,
        displayName: `Unified ${label}`,
        password: 'unified-regulatory-password-123',
      })
      .expect(201);
    const token = registered.body.accessToken as string;
    const userId = registered.body.user.id as string;
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Unified ${label} ${suffix}`, country: 'Ecuador', sector: 'Servicios' })
      .expect(201);
    return { token, userId, organizationId: organization.body.id as string };
  }

  function headers(token: string, organizationId: string) {
    return { Authorization: `Bearer ${token}`, 'x-organization-id': organizationId };
  }

  it('keeps tenant data private while resolving every candidate to exact official articles', async () => {
    const ownerA = await actor('owner-a');
    const ownerB = await actor('owner-b');
    const consultant = await actor('consultant');
    await prisma.membership.create({
      data: {
        userId: consultant.userId,
        organizationId: ownerA.organizationId,
        role: 'CONSULTANT',
      },
    });
    const profile = await request(app.getHttpServer())
      .post('/api/v1/applicability/profile-versions')
      .set(headers(ownerA.token, ownerA.organizationId))
      .send({ workerCount: 25, hasChemicalProcesses: false, hasHighEnergyOperations: false })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post('/api/v1/unified-sst-evaluations')
      .set(headers(ownerA.token, ownerA.organizationId))
      .send({ profileVersionId: profile.body.id })
      .expect(201);
    const evaluationId = created.body.id as string;
    expect(created.body.items.length).toBeGreaterThan(0);
    expect(created.body.contextSnapshot).toMatchObject({
      boundary: 'CANDIDATE_INTERPRETATION_NOT_FINAL_LAW',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/unified-sst-evaluations/${evaluationId}`)
      .set(headers(ownerB.token, ownerB.organizationId))
      .expect(404);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/unified-sst-evaluations/${evaluationId}`)
      .set(headers(ownerA.token, ownerA.organizationId))
      .expect(200);
    for (const item of detail.body.items as Array<{
      id: string;
      engineOutputHash: string;
      requirement: { id: string };
      ruleDraft: { id: string };
      unit: {
        id: string;
        officialText: string;
        normalizedTextHash: string;
        sourceVersion: {
          id: string;
          artifactVerificationStatus: string;
          source: { sourceKey: string };
        };
      };
    }>) {
      expect(item.engineOutputHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(item.unit.officialText.length).toBeGreaterThan(20);
      expect(item.unit.normalizedTextHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(item.unit.sourceVersion.artifactVerificationStatus).toBe('OFFICIAL_ARTIFACT_VERIFIED');
      const trace = await prisma.regulatoryRuleDraftRequirement.findFirst({
        where: {
          ruleDraftId: item.ruleDraft.id,
          requirementId: item.requirement.id,
          requirement: {
            sources: { some: { provision: { units: { some: { unitId: item.unit.id } } } } },
          },
        },
      });
      expect(trace).not.toBeNull();
    }

    const first = detail.body.items[0] as {
      id: string;
      ruleDraftId: string;
      requirementId: string;
      unit: {
        id: string;
        sourceVersion: { id: string; source: { id: string; sourceKey: string } };
      };
    };
    await request(app.getHttpServer())
      .put(`/api/v1/unified-sst-evaluations/${evaluationId}/items/${first.id}/current-state`)
      .set(headers(ownerB.token, ownerB.organizationId))
      .send({ status: 'IMPLEMENTED' })
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/v1/unified-sst-evaluations/${evaluationId}/items/${first.id}/current-state`)
      .set(headers(ownerA.token, ownerA.organizationId))
      .send({ status: 'PARTIALLY_IMPLEMENTED' })
      .expect(200)
      .expect(({ body }) =>
        expect(body.currentStateSnapshot).toMatchObject({
          status: 'PARTIALLY_IMPLEMENTED',
          declaredById: ownerA.userId,
        }),
      );
    await request(app.getHttpServer())
      .post(
        `/api/v1/unified-sst-evaluations/${evaluationId}/items/${first.id}/organization-evidence`,
      )
      .set(headers(ownerA.token, ownerA.organizationId))
      .send({
        type: 'NOTE',
        note: 'Referencia organizacional sintética, separada del texto legal.',
      })
      .expect(201)
      .expect(({ body }) => expect(body.organizationEvidence).toHaveLength(1));
    await request(app.getHttpServer())
      .post(`/api/v1/unified-sst-evaluations/expert-workspace/${first.ruleDraftId}/reviews`)
      .set(headers(consultant.token, ownerA.organizationId))
      .send({ evaluationItemId: first.id, decision: 'APPROVED', comment: 'No autorizado.' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/unified-sst-evaluations/expert-workspace/${first.ruleDraftId}/reviews`)
      .set(headers(ownerB.token, ownerB.organizationId))
      .send({ evaluationItemId: first.id, decision: 'APPROVED', comment: 'Tenant incorrecto.' })
      .expect(404);

    const review = await request(app.getHttpServer())
      .post(`/api/v1/unified-sst-evaluations/expert-workspace/${first.ruleDraftId}/reviews`)
      .set(headers(ownerA.token, ownerA.organizationId))
      .send({
        evaluationItemId: first.id,
        decision: 'CHANGES_REQUESTED',
        comment: 'Confirmar interpretación con revisión jurídica antes de publicar.',
      })
      .expect(201);
    expect(review.body).toMatchObject({
      reviewerUserId: ownerA.userId,
      unitId: first.unit.id,
      sourceVersionIdSnapshot: first.unit.sourceVersion.id,
    });

    const originalVersion = await prisma.regulatorySourceVersion.findUniqueOrThrow({
      where: { id: first.unit.sourceVersion.id },
    });
    await expect(
      prisma.$transaction(async (transaction) => {
        const hypotheticalVersion = await transaction.regulatorySourceVersion.create({
          data: {
            id: randomUUID(),
            sourceId: originalVersion.sourceId,
            catalogVersion: 99,
            candidateStatus: 'TECHNICAL_REVIEW_PENDING',
            officialDocumentLocated: true,
            officialUrl: originalVersion.officialUrl,
            officialDocumentSha256: `sha256:${'9'.repeat(64)}`,
            officialDocumentRetrievedAt: new Date(),
            officialDocumentMediaType: 'application/pdf',
            officialPublicationReference: 'Versión hipotética aislada para prueba.',
            supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
            readyForExtraction: false,
            readyForRules: false,
            reviewNotes: 'Fixture de cambio de versión; no es una fuente real.',
            artifactVerificationStatus: 'ARTIFACT_PENDING',
            textExtractionStatus: 'PENDING',
            vigenciaReviewStatus: 'PENDING_REVIEW',
            artifactPageCount: 1,
            artifactVersionKey: `TEST:${suffix}`,
          },
        });
        await transaction.regulatoryUnit.create({
          data: {
            id: randomUUID(),
            sourceVersionId: hypotheticalVersion.id,
            unitType: 'ARTICLE',
            identifier: 'ARTICLE_TEST_V2',
            ordinal: 0,
            officialText:
              'Texto hipotético de una nueva versión aislada para probar la fijación histórica.',
            normalizedTextHash: `sha256:${'8'.repeat(64)}`,
            pageStart: 1,
            pageEnd: 1,
            locator: 'Artículo hipotético · página 1',
            extractionStatus: 'MANUAL_REVIEW_REQUIRED',
            reviewStatus: 'UNREVIEWED',
          },
        });
        const historical = await transaction.unifiedSstEvaluationItem.findUniqueOrThrow({
          where: { id: first.id },
          include: { unit: true },
        });
        const persistedReview = await transaction.regulatoryInterpretationReview.findUniqueOrThrow({
          where: { id: review.body.id as string },
        });
        expect(historical.unit.sourceVersionId).toBe(first.unit.sourceVersion.id);
        expect(persistedReview.sourceVersionIdSnapshot).toBe(first.unit.sourceVersion.id);
        expect(historical.unit.sourceVersionId).not.toBe(hypotheticalVersion.id);
        throw new Error('ROLLBACK_HYPOTHETICAL_REGULATORY_VERSION');
      }),
    ).rejects.toThrow('ROLLBACK_HYPOTHETICAL_REGULATORY_VERSION');
  }, 120_000);
});
