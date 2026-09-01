import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { MembershipRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const CORPUS_SOURCE_KEYS = [
  'EC_MDT_2024_196',
  'EC_MDT_2024_196_ANNEX_1',
  'EC_MDT_2024_196_ANNEX_2',
  'EC_MDT_2024_196_ANNEX_3',
  'EC_EXECUTIVE_DECREE_255',
  'EC_MSP_00004_2026_SISAT',
  'EC_LABOR_CODE',
  'EC_IESS_CD_513',
  'EC_IESS_CD_517',
  'EC_IESS_CD_527_INTERVIEW_REFERENCE',
  'EC_IESS_CD_677',
  'EC_IESS_CD_692',
  'EC_CAN_DECISION_584',
  'EC_CAN_RESOLUTION_957',
  'EC_MDT_2025_122_CONSTRUCTION',
] as const;

const BASELINE_PLAN_FEATURES = {
  FREE: {
    'ai.monthly_actions': '0',
    'demo.duration_days': '14',
    'demo.enabled': 'true',
    'module.compliance': 'false',
    'module.inspections': 'false',
    'module.psychosocial': 'false',
    'module.technical_risk': 'false',
    'organization.max_members': '2',
    'organization.max_work_centers': '1',
  },
  STARTER: {
    'ai.monthly_actions': '25',
    'demo.duration_days': '14',
    'demo.enabled': 'true',
    'module.compliance': 'true',
    'module.inspections': 'true',
    'module.psychosocial': 'false',
    'module.technical_risk': 'false',
    'organization.max_members': '10',
    'organization.max_work_centers': '3',
  },
  GROWTH: {
    'ai.monthly_actions': '150',
    'demo.duration_days': '21',
    'demo.enabled': 'true',
    'module.compliance': 'true',
    'module.inspections': 'true',
    'module.psychosocial': 'true',
    'module.technical_risk': 'true',
    'organization.max_members': '50',
    'organization.max_work_centers': '12',
  },
  ENTERPRISE: {
    'ai.monthly_actions': '1000',
    'demo.duration_days': '30',
    'demo.enabled': 'true',
    'module.compliance': 'true',
    'module.inspections': 'true',
    'module.psychosocial': 'true',
    'module.technical_risk': 'true',
    'organization.max_members': '10000',
    'organization.max_work_centers': '10000',
  },
} as const;
const WORKFORCE_PREVIEW_FEATURE_KEYS = [
  'module.incidents',
  'module.ppe',
  'module.training',
] as const;

describe('regulatory source foundation integration', () => {
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

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/g, '-')}-${suffix}@example.test`,
        displayName: label,
        password: 'regulatory-source-password-123',
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

  function get(token: string, organizationId: string, path = '') {
    return request(app.getHttpServer())
      .get(`/api/v1/regulatory-sources${path}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId);
  }

  it('provisions exactly the 15 review-corpus sources with conservative safety metadata', async () => {
    const sources = await prisma.regulatorySource.findMany({
      where: { sourceKey: { in: [...CORPUS_SOURCE_KEYS] } },
      include: { versions: { orderBy: { catalogVersion: 'asc' } } },
      orderBy: { sourceKey: 'asc' },
    });
    expect(sources).toHaveLength(15);
    expect(sources.map((source) => source.sourceKey).sort()).toEqual(
      [...CORPUS_SOURCE_KEYS].sort(),
    );
    const singleVersionKeys = new Set([
      'EC_CAN_DECISION_584',
      'EC_CAN_RESOLUTION_957',
      'EC_IESS_CD_527_INTERVIEW_REFERENCE',
      'EC_IESS_CD_692',
      'EC_MDT_2025_122_CONSTRUCTION',
    ]);
    expect(
      sources.every(
        (source) => source.versions.length === (singleVersionKeys.has(source.sourceKey) ? 1 : 2),
      ),
    ).toBe(true);
    expect(
      sources.flatMap((source) => source.versions).every((version) => !version.readyForRules),
    ).toBe(true);

    const pilotSource = sources.find((source) => source.sourceKey === 'EC_MDT_2024_196');
    expect(pilotSource?.versions[1]).toMatchObject({
      catalogVersion: 2,
      candidateStatus: 'APPROVED_FOR_EXTRACTION',
      officialDocumentLocated: true,
      officialDocumentSha256:
        'sha256:4fe2da2ddf2b730c0c9e56e321d5a817f94b98d6d9f9e02bb97c18f2cc47473d',
      officialDocumentMediaType: 'application/pdf',
      officialPublicationReference:
        'Cuarto Suplemento al Registro Oficial No. 691, 26 de noviembre de 2024',
      readyForExtraction: true,
      readyForRules: false,
    });

    const rejected = sources.find(
      (source) => source.sourceKey === 'EC_IESS_CD_527_INTERVIEW_REFERENCE',
    );
    expect(rejected?.versions[0]).toMatchObject({
      candidateStatus: 'REJECTED_REFERENCE',
      officialDocumentLocated: false,
      readyForExtraction: false,
      readyForRules: false,
      supersessionStatus: 'UNVERIFIED_REFERENCE',
    });

    const relationship = await prisma.regulatorySourceRelationship.findUniqueOrThrow({
      where: {
        fromSourceId_toSourceId_relationshipType: {
          fromSourceId: sources.find((source) => source.sourceKey === 'EC_IESS_CD_517')!.id,
          toSourceId: sources.find((source) => source.sourceKey === 'EC_IESS_CD_677')!.id,
          relationshipType: 'POSSIBLE_SUPERSESSION',
        },
      },
    });
    expect(relationship.reviewStatus).toBe('CONFIRMED');

    expect(
      sources.find((source) => source.sourceKey === 'EC_IESS_CD_517')?.versions[1],
    ).toMatchObject({
      artifactVerificationStatus: 'OFFICIAL_ARTIFACT_VERIFIED',
      vigenciaReviewStatus: 'REPEALED',
    });

    const amendment = await prisma.regulatorySourceRelationship.findUniqueOrThrow({
      where: {
        fromSourceId_toSourceId_relationshipType: {
          fromSourceId: sources.find((source) => source.sourceKey === 'EC_IESS_CD_692')!.id,
          toSourceId: sources.find((source) => source.sourceKey === 'EC_IESS_CD_513')!.id,
          relationshipType: 'POSSIBLE_AMENDMENT',
        },
      },
    });
    expect(amendment.reviewStatus).toBe('CONFIRMED');
    expect(
      sources.find((source) => source.sourceKey === 'EC_MDT_2025_122_CONSTRUCTION')?.versions[0],
    ).toMatchObject({
      candidateStatus: 'APPROVED_FOR_EXTRACTION',
      officialDocumentSha256:
        'sha256:5a91139893f97fdd2214b471563cdd47d8f539c1773c90520319d51c0284e5f0',
      readyForExtraction: true,
      readyForRules: false,
    });
    const unstructuredCorpusSourceKeys = CORPUS_SOURCE_KEYS.filter(
      (sourceKey) => sourceKey !== 'EC_MDT_2024_196',
    );
    expect(
      await prisma.regulatoryProvision.count({
        where: { sourceVersion: { source: { sourceKey: { in: unstructuredCorpusSourceKeys } } } },
      }),
    ).toBe(0);
    expect(
      await prisma.regulatoryRequirementSource.count({
        where: {
          provision: {
            sourceVersion: { source: { sourceKey: { in: unstructuredCorpusSourceKeys } } },
          },
        },
      }),
    ).toBe(0);
  });

  it('preserves commercial assignments while keeping Work Permits preview-only', async () => {
    const featureKeys = await prisma.featureDefinition.findMany({
      select: { key: true },
      orderBy: { key: 'asc' },
    });
    expect(featureKeys.map(({ key }) => key)).toEqual(
      [
        ...Object.keys(BASELINE_PLAN_FEATURES.FREE),
        'module.work_permits',
        ...WORKFORCE_PREVIEW_FEATURE_KEYS,
      ].sort(),
    );

    const plans = await prisma.plan.findMany({
      select: {
        key: true,
        planFeatures: {
          select: { value: true, feature: { select: { key: true } } },
          orderBy: { feature: { key: 'asc' } },
        },
      },
      orderBy: { key: 'asc' },
    });
    const assignments = Object.fromEntries(
      plans.map((plan) => [
        plan.key,
        Object.fromEntries(plan.planFeatures.map(({ feature, value }) => [feature.key, value])),
      ]),
    );
    expect(assignments).toEqual(BASELINE_PLAN_FEATURES);
  });

  it('enforces auth, membership and all-role read access over global data', async () => {
    await request(app.getHttpServer()).get('/api/v1/regulatory-sources').expect(401);

    const owner = await register('Regulatory Owner');
    const organizationA = await createOrganization(owner.token, 'Organization A');
    const organizationB = await createOrganization(owner.token, 'Organization B');

    await request(app.getHttpServer())
      .get('/api/v1/regulatory-sources')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe('Selecciona una organización.');
      });

    const listA = await get(owner.token, organizationA).expect(200);
    const listB = await get(owner.token, organizationB).expect(200);
    expect(listA.body).toEqual(listB.body);
    expect(
      listA.body.filter((source: { sourceKey: string }) =>
        CORPUS_SOURCE_KEYS.includes(source.sourceKey as (typeof CORPUS_SOURCE_KEYS)[number]),
      ),
    ).toHaveLength(15);
    expect(listA.body[0]).not.toHaveProperty('organizationId');
    expect(listA.body[0]).not.toHaveProperty('legalStatus');
    expect(listA.body[0]).not.toHaveProperty('isApplicable');

    const roles: MembershipRole[] = [
      'ORG_OWNER',
      'ORG_ADMIN',
      'SST_MANAGER',
      'SST_TECHNICIAN',
      'CONSULTANT',
      'VIEWER',
    ];
    for (const role of roles) {
      await prisma.membership.update({
        where: {
          userId_organizationId: { userId: owner.userId, organizationId: organizationA },
        },
        data: { role },
      });
      await get(owner.token, organizationA).expect(200);
    }

    const outsider = await register('Regulatory Outsider');
    await get(outsider.token, organizationA)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe('No tienes acceso a esta organización.');
      });
  }, 60_000);

  it('exposes safe detail, history and pending relationships without mutation routes', async () => {
    const owner = await register('Regulatory Detail Owner');
    const organizationId = await createOrganization(owner.token, 'Regulatory Detail');

    const rejected = await get(
      owner.token,
      organizationId,
      '/EC_IESS_CD_527_INTERVIEW_REFERENCE',
    ).expect(200);
    expect(rejected.body).toMatchObject({
      source: { sourceKey: 'EC_IESS_CD_527_INTERVIEW_REFERENCE', referenceNumber: 'C.D. 527' },
      latestVersion: {
        candidateStatus: 'REJECTED_REFERENCE',
        officialDocumentLocated: false,
        readyForRules: false,
      },
      metadataBoundary: 'CATALOG_METADATA_NOT_LEGAL_INTERPRETATION',
    });

    const relationships = await get(
      owner.token,
      organizationId,
      '/EC_IESS_CD_517/relationships',
    ).expect(200);
    expect(relationships.body).toEqual([
      expect.objectContaining({
        relationshipType: 'POSSIBLE_SUPERSESSION',
        reviewStatus: 'CONFIRMED',
        fromSource: expect.objectContaining({ sourceKey: 'EC_IESS_CD_517' }),
        toSource: expect.objectContaining({ sourceKey: 'EC_IESS_CD_677' }),
      }),
    ]);

    await request(app.getHttpServer())
      .post('/api/v1/regulatory-sources')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .send({ sourceKey: 'FORBIDDEN' })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/v1/regulatory-sources/EC_IESS_CD_517')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .send({ readyForRules: true })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/api/v1/regulatory-sources/EC_IESS_CD_517')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .expect(404);
  });

  it('serves searchable, immutable official articles separately from platform interpretations', async () => {
    const owner = await register('Regulatory Article Owner');
    const organizationId = await createOrganization(owner.token, 'Regulatory Articles');

    const articles = await get(
      owner.token,
      organizationId,
      '/EC_MDT_2024_196/units?q=registro&unitType=ARTICLE',
    ).expect(200);
    expect(articles.body).toMatchObject({
      sourceKey: 'EC_MDT_2024_196',
      version: {
        artifactVerificationStatus: 'OFFICIAL_ARTIFACT_VERIFIED',
        textExtractionStatus: 'COMPLETE',
      },
      structuralBoundary: 'STRUCTURAL_COVERAGE_NOT_LEGAL_COMPLETENESS_SCORE',
    });
    expect(articles.body.items.length).toBeGreaterThan(0);
    const article = articles.body.items.find(
      (item: { identifier: string }) => item.identifier === 'ARTICLE_18',
    );
    expect(article).toMatchObject({
      unitType: 'ARTICLE',
      identifier: 'ARTICLE_18',
      reviewStatus: 'VERIFIED',
    });
    expect(article.officialText).toContain('Artículo 18');
    expect(article.normalizedTextHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/regulatory-units/${article.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .expect(200);
    expect(detail.body).toMatchObject({
      unit: { id: article.id, officialText: article.officialText },
      source: { sourceKey: 'EC_MDT_2024_196' },
      textBoundary: 'OFFICIAL_TEXT_SEPARATE_FROM_PLATFORM_INTERPRETATION',
    });
    expect(detail.body).toHaveProperty('interpretations');

    await expect(
      prisma.regulatoryUnit.update({
        where: { id: article.id as string },
        data: { officialText: 'Sobrescritura prohibida.' },
      }),
    ).rejects.toThrow();
  });

  it('keeps source keys and versions immutable while selecting the latest snapshot', async () => {
    const owner = await register('Regulatory Version Owner');
    const organizationId = await createOrganization(owner.token, 'Regulatory Version');
    const sourceKey = `EC_TEST_VERSION_${suffix.replaceAll(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
    const testIssuer = `Emisor sintético de prueba ${suffix}`;
    const source = await prisma.regulatorySource.create({
      data: {
        sourceKey,
        countryCode: 'EC',
        issuer: testIssuer,
        documentType: 'OTHER',
        referenceNumber: `TEST-${suffix}`,
        canonicalTitle: 'Fuente sintética para probar versionado',
        versions: {
          create: {
            catalogVersion: 1,
            candidateStatus: 'DISCOVERED',
            officialDocumentLocated: false,
            supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
            readyForExtraction: false,
            readyForRules: false,
            reviewNotes: 'Versión uno inmutable.',
          },
        },
      },
      include: { versions: true },
    });
    const versionOne = source.versions[0]!;
    const versionTwo = await prisma.regulatorySourceVersion.create({
      data: {
        sourceId: source.id,
        catalogVersion: 2,
        candidateStatus: 'TECHNICAL_REVIEW_PENDING',
        officialDocumentLocated: true,
        officialUrl: 'https://example.test/regulatory-source',
        supersessionStatus: 'NO_KNOWN_RELATION_RECORDED',
        readyForExtraction: false,
        readyForRules: false,
        reviewNotes: 'Versión dos sintética.',
      },
    });

    const list = await get(
      owner.token,
      organizationId,
      `?issuer=${encodeURIComponent(testIssuer)}&documentType=OTHER&candidateStatus=TECHNICAL_REVIEW_PENDING`,
    ).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ sourceKey, latestCatalogVersion: 2, readyForRules: false }),
    ]);

    const history = await get(owner.token, organizationId, `/${sourceKey}/versions`).expect(200);
    expect(
      history.body.map((version: { catalogVersion: number }) => version.catalogVersion),
    ).toEqual([2, 1]);
    expect(history.body[1]).toMatchObject({
      catalogVersion: 1,
      candidateStatus: 'DISCOVERED',
      reviewNotes: 'Versión uno inmutable.',
    });

    await expect(
      prisma.regulatorySourceVersion.update({
        where: { id: versionOne.id },
        data: { reviewNotes: 'Forbidden overwrite' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatorySourceVersion.create({
        data: {
          sourceId: source.id,
          catalogVersion: 2,
          candidateStatus: 'DISCOVERED',
          officialDocumentLocated: false,
          supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatorySource.update({
        where: { id: source.id },
        data: { sourceKey: `${sourceKey}_CHANGED` },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.regulatorySourceVersion.findUniqueOrThrow({ where: { id: versionTwo.id } }),
    ).toMatchObject({ catalogVersion: 2, readyForRules: false });
  });
});
