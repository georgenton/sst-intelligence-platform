import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { MembershipRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('regulatory provision and requirement foundation integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}${Math.random().toString(16).slice(2)}`.replaceAll(
    /[^A-Za-z0-9]/g,
    '',
  );

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
        password: 'regulatory-content-password-123',
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

  function authorizedGet(token: string, organizationId: string, path: string) {
    return request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', organizationId);
  }

  it('starts with no production provision, requirement or provenance content', async () => {
    expect(await prisma.regulatoryProvision.count()).toBe(0);
    expect(await prisma.regulatoryRequirement.count()).toBe(0);
    expect(await prisma.regulatoryRequirementSource.count()).toBe(0);
    expect(await prisma.regulatorySource.count()).toBe(11);
    expect(await prisma.regulatorySourceVersion.count()).toBe(11);
    expect(await prisma.regulatorySourceRelationship.count()).toBe(1);
    expect(await prisma.featureDefinition.count({ where: { key: 'module.applicability' } })).toBe(
      0,
    );
  });

  it('enforces authenticated tenant-gated reads for every existing catalog role', async () => {
    await request(app.getHttpServer()).get('/api/v1/regulatory-requirements').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/regulatory-sources/EC_IESS_CD_517/provisions')
      .expect(401);

    const owner = await register('Regulatory Content Owner');
    const organizationId = await createOrganization(owner.token, 'Regulatory Content');
    expect(
      (await authorizedGet(owner.token, organizationId, '/regulatory-requirements')).body,
    ).toEqual([]);
    expect(
      (
        await authorizedGet(
          owner.token,
          organizationId,
          '/regulatory-sources/EC_IESS_CD_517/provisions',
        )
      ).body,
    ).toEqual([]);

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
        where: { userId_organizationId: { userId: owner.userId, organizationId } },
        data: { role },
      });
      await authorizedGet(owner.token, organizationId, '/regulatory-requirements').expect(200);
      await authorizedGet(
        owner.token,
        organizationId,
        '/regulatory-sources/EC_IESS_CD_517/provisions',
      ).expect(200);
    }

    const outsider = await register('Regulatory Content Outsider');
    await authorizedGet(outsider.token, organizationId, '/regulatory-requirements').expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/regulatory-requirements')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .send({ requirementKey: 'DEMO_FORBIDDEN' })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/v1/regulatory-requirements/DEMO_FORBIDDEN')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .send({ title: 'Forbidden' })
      .expect(404);
    await request(app.getHttpServer())
      .put('/api/v1/regulatory-provisions/10000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .send({ summary: 'Forbidden' })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/api/v1/regulatory-requirements/DEMO_FORBIDDEN')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-organization-id', organizationId)
      .expect(404);
  }, 60_000);

  it('preserves exact v1 provenance after v2 exists and enforces immutable many-to-many links', async () => {
    const owner = await register('Regulatory Provenance Owner');
    const organizationId = await createOrganization(owner.token, 'Regulatory Provenance');
    const sourceKey = `DEMO_SYNTHETIC_SOURCE_${suffix.toUpperCase()}`;
    const source = await prisma.regulatorySource.create({
      data: {
        sourceKey,
        countryCode: 'EC',
        issuer: 'Emisor sintético de pruebas',
        documentType: 'OTHER',
        referenceNumber: `DEMO-${suffix}`,
        canonicalTitle: 'Fuente sintética sin contenido legal real',
        versions: {
          create: {
            catalogVersion: 1,
            candidateStatus: 'TECHNICAL_REVIEW_PENDING',
            officialDocumentLocated: false,
            supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
            readyForExtraction: false,
            readyForRules: false,
            reviewNotes: 'Snapshot sintético v1.',
          },
        },
      },
      include: { versions: true },
    });
    const versionOne = source.versions[0]!;
    const [provisionA, provisionB] = await Promise.all([
      prisma.regulatoryProvision.create({
        data: {
          sourceVersionId: versionOne.id,
          provisionKey: `DEMO_ARTICLE_A_${suffix.toUpperCase()}`,
          locatorType: 'ARTICLE',
          locatorLabel: 'Artículo sintético A',
          heading: 'Gobernanza sintética',
          summary: 'Resumen breve sin texto legal real.',
          editorialStatus: 'TECHNICAL_REVIEW_PENDING',
        },
      }),
      prisma.regulatoryProvision.create({
        data: {
          sourceVersionId: versionOne.id,
          provisionKey: `DEMO_SECTION_B_${suffix.toUpperCase()}`,
          locatorType: 'SECTION',
          locatorLabel: 'Sección sintética B',
          heading: 'Apoyo sintético',
          summary: null,
          editorialStatus: 'LEGAL_REVIEW_PENDING',
        },
      }),
    ]);
    const requirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_REQUIREMENT_001_${suffix.toUpperCase()}`,
        title: 'Requisito sintético de gobernanza',
        description: 'Concepto editorial sintético que no expresa aplicabilidad.',
        editorialStatus: 'LEGAL_REVIEW_PENDING',
        scopeHint: 'WORK_CENTER',
      },
    });
    const secondaryRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_REQUIREMENT_002_${suffix.toUpperCase()}`,
        title: 'Segundo requisito sintético',
        description: 'Prueba de relación many-to-many.',
        editorialStatus: 'DRAFT',
        scopeHint: 'UNKNOWN',
      },
    });
    await prisma.regulatoryRequirementSource.createMany({
      data: [
        {
          requirementId: requirement.id,
          provisionId: provisionA.id,
          relationshipType: 'PRIMARY_SOURCE',
        },
        {
          requirementId: requirement.id,
          provisionId: provisionB.id,
          relationshipType: 'SUPPORTING_SOURCE',
        },
        {
          requirementId: secondaryRequirement.id,
          provisionId: provisionA.id,
          relationshipType: 'RELATED_SOURCE',
        },
      ],
    });

    const versionTwo = await prisma.regulatorySourceVersion.create({
      data: {
        sourceId: source.id,
        catalogVersion: 2,
        candidateStatus: 'LEGAL_REVIEW_PENDING',
        officialDocumentLocated: false,
        supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
        readyForExtraction: false,
        readyForRules: false,
        reviewNotes: 'Snapshot sintético v2.',
      },
    });
    const repeatedKeyInV2 = await prisma.regulatoryProvision.create({
      data: {
        sourceVersionId: versionTwo.id,
        provisionKey: provisionA.provisionKey,
        locatorType: 'ARTICLE',
        locatorLabel: 'Artículo sintético A en v2',
        heading: null,
        summary: null,
        editorialStatus: 'DRAFT',
      },
    });
    expect(repeatedKeyInV2.sourceVersionId).toBe(versionTwo.id);

    const content = await authorizedGet(
      owner.token,
      organizationId,
      `/regulatory-sources/${sourceKey}/provisions`,
    ).expect(200);
    expect(content.body).toHaveLength(3);
    expect(
      content.body.find((row: { provision: { id: string } }) => row.provision.id === provisionA.id),
    ).toMatchObject({
      provision: { sourceVersionId: versionOne.id },
      sourceVersion: { catalogVersion: 1 },
      requirements: expect.arrayContaining([
        expect.objectContaining({ relationshipType: 'PRIMARY_SOURCE' }),
        expect.objectContaining({ relationshipType: 'RELATED_SOURCE' }),
      ]),
    });

    const detail = await authorizedGet(
      owner.token,
      organizationId,
      `/regulatory-requirements/${requirement.requirementKey}`,
    ).expect(200);
    expect(detail.body.semanticBoundary).toBe('STRUCTURED_CANDIDATE_NOT_APPLICABILITY_DECISION');
    expect(detail.body.requirement).not.toHaveProperty('organizationId');
    expect(detail.body.requirement).not.toHaveProperty('applicabilityState');
    expect(detail.body.provenance).toHaveLength(2);
    expect(
      detail.body.provenance.map(
        (item: { relationshipType: string; sourceVersion: { catalogVersion: number } }) => [
          item.relationshipType,
          item.sourceVersion.catalogVersion,
        ],
      ),
    ).toEqual([
      ['PRIMARY_SOURCE', 1],
      ['SUPPORTING_SOURCE', 1],
    ]);
    expect(
      detail.body.provenance.every(
        (item: { source: { sourceKey: string } }) => item.source.sourceKey === sourceKey,
      ),
    ).toBe(true);

    await authorizedGet(owner.token, organizationId, `/regulatory-provisions/${provisionA.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.sourceVersion.catalogVersion).toBe(1);
        expect(body.source.sourceKey).toBe(sourceKey);
      });

    await expect(
      prisma.regulatoryProvision.create({
        data: {
          sourceVersionId: versionOne.id,
          provisionKey: provisionA.provisionKey,
          locatorType: 'ARTICLE',
          locatorLabel: 'Duplicado',
          editorialStatus: 'DRAFT',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirement.create({
        data: {
          requirementKey: requirement.requirementKey,
          title: 'Duplicado',
          description: 'Duplicado sintético.',
          editorialStatus: 'DRAFT',
          scopeHint: 'UNKNOWN',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirementSource.create({
        data: {
          requirementId: requirement.id,
          provisionId: provisionA.id,
          relationshipType: 'PRIMARY_SOURCE',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provisionA.id },
        data: { provisionKey: `${provisionA.provisionKey}_CHANGED` },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { requirementKey: `${requirement.requirementKey}_CHANGED` },
      }),
    ).rejects.toThrow();
    const primaryLink = await prisma.regulatoryRequirementSource.findUniqueOrThrow({
      where: {
        requirementId_provisionId_relationshipType: {
          requirementId: requirement.id,
          provisionId: provisionA.id,
          relationshipType: 'PRIMARY_SOURCE',
        },
      },
    });
    await expect(
      prisma.regulatoryRequirementSource.update({
        where: { id: primaryLink.id },
        data: { relationshipType: 'RELATED_SOURCE' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryProvision.delete({ where: { id: provisionA.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirement.delete({ where: { id: requirement.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirementSource.delete({ where: { id: primaryLink.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatorySourceVersion.delete({ where: { id: versionOne.id } }),
    ).rejects.toThrow();

    expect(
      await prisma.regulatoryRequirementSource.count({ where: { provisionId: provisionA.id } }),
    ).toBe(2);
    expect(
      await prisma.regulatoryRequirementSource.findMany({
        where: { requirementId: requirement.id },
        select: { provision: { select: { sourceVersionId: true } } },
      }),
    ).toEqual([
      { provision: { sourceVersionId: versionOne.id } },
      { provision: { sourceVersionId: versionOne.id } },
    ]);
  }, 60_000);
});
