import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { MembershipRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const INITIAL_SOURCE_KEYS = [
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

  it('provisions exactly the 11 candidates with conservative safety metadata', async () => {
    const sources = await prisma.regulatorySource.findMany({
      where: { sourceKey: { in: [...INITIAL_SOURCE_KEYS] } },
      include: { versions: { orderBy: { catalogVersion: 'asc' } } },
      orderBy: { sourceKey: 'asc' },
    });
    expect(sources).toHaveLength(11);
    expect(sources.map((source) => source.sourceKey).sort()).toEqual(
      [...INITIAL_SOURCE_KEYS].sort(),
    );
    expect(sources.every((source) => source.versions.length === 1)).toBe(true);
    expect(
      sources.flatMap((source) => source.versions).every((version) => !version.readyForRules),
    ).toBe(true);

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
    expect(relationship.reviewStatus).toBe('PENDING_REVIEW');
  });

  it('enforces auth, membership, entitlement and all-role read access over global data', async () => {
    await request(app.getHttpServer()).get('/api/v1/regulatory-sources').expect(401);

    const owner = await register('Regulatory Owner');
    const entitledA = await createOrganization(owner.token, 'Entitled A');
    const entitledB = await createOrganization(owner.token, 'Entitled B');
    const denied = await createOrganization(owner.token, 'No entitlement');
    await prisma.subscription.deleteMany({ where: { organizationId: denied } });

    const listA = await get(owner.token, entitledA).expect(200);
    const listB = await get(owner.token, entitledB).expect(200);
    expect(listA.body).toEqual(listB.body);
    expect(
      listA.body.filter((source: { sourceKey: string }) =>
        INITIAL_SOURCE_KEYS.includes(source.sourceKey as (typeof INITIAL_SOURCE_KEYS)[number]),
      ),
    ).toHaveLength(11);
    expect(listA.body[0]).not.toHaveProperty('organizationId');
    expect(listA.body[0]).not.toHaveProperty('legalStatus');
    expect(listA.body[0]).not.toHaveProperty('isApplicable');
    await get(owner.token, denied)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe('Este módulo no está disponible en el plan actual.');
      });

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
          userId_organizationId: { userId: owner.userId, organizationId: entitledA },
        },
        data: { role },
      });
      await get(owner.token, entitledA).expect(200);
    }

    const outsider = await register('Regulatory Outsider');
    await get(outsider.token, entitledA).expect(403);
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
        reviewStatus: 'PENDING_REVIEW',
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
