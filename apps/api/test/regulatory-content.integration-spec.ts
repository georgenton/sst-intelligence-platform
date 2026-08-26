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

  it('starts with only the pending MDT-2024-196 reference candidates and no published rules', async () => {
    expect(await prisma.regulatoryProvision.count()).toBe(2);
    expect(await prisma.regulatoryRequirement.count()).toBe(5);
    expect(await prisma.regulatoryRequirementSource.count()).toBe(6);
    expect(
      await prisma.adaptiveRuleDraft.count({
        where: { regulatory: true, status: 'TECHNICAL_REVIEW_PENDING' },
      }),
    ).toBe(5);
    expect(await prisma.adaptiveRuleVersion.count({ where: { regulatory: true } })).toBe(0);
    expect(
      await prisma.regulatorySource.count({
        where: { sourceKey: { in: [...CORPUS_SOURCE_KEYS] } },
      }),
    ).toBe(15);
    expect(
      await prisma.regulatorySourceVersion.count({
        where: { source: { sourceKey: { in: [...CORPUS_SOURCE_KEYS] } } },
      }),
    ).toBe(25);
    expect(
      await prisma.regulatorySourceRelationship.count({
        where: {
          fromSource: { sourceKey: { in: [...CORPUS_SOURCE_KEYS] } },
          toSource: { sourceKey: { in: [...CORPUS_SOURCE_KEYS] } },
        },
      }),
    ).toBe(9);
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
    const requirements = await authorizedGet(
      owner.token,
      organizationId,
      '/regulatory-requirements',
    );
    expect(requirements.body).toHaveLength(5);
    expect(
      requirements.body.every(
        (requirement: { editorialStatus: string; provenanceCount: number }) =>
          requirement.editorialStatus === 'TECHNICAL_REVIEW_PENDING' &&
          requirement.provenanceCount > 0,
      ),
    ).toBe(true);
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

  it('preserves exact v1 provenance after v2 exists and enforces stable identities', async () => {
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
          editorialStatus: 'DRAFT',
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
          editorialStatus: 'DRAFT',
        },
      }),
    ]);
    const requirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_REQUIREMENT_001_${suffix.toUpperCase()}`,
        title: 'Requisito sintético de gobernanza',
        description: 'Concepto editorial sintético que no expresa aplicabilidad.',
        editorialStatus: 'DRAFT',
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
    await prisma.regulatoryProvision.update({
      where: { id: provisionA.id },
      data: { editorialStatus: 'EXTRACTED' },
    });
    await prisma.regulatoryProvision.update({
      where: { id: provisionA.id },
      data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
    });
    await prisma.regulatoryProvision.update({
      where: { id: provisionB.id },
      data: { editorialStatus: 'EXTRACTED' },
    });
    await prisma.regulatoryProvision.update({
      where: { id: provisionB.id },
      data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
    });
    await prisma.regulatoryProvision.update({
      where: { id: provisionB.id },
      data: { editorialStatus: 'LEGAL_REVIEW_PENDING' },
    });
    await prisma.regulatoryRequirement.update({
      where: { id: requirement.id },
      data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
    });
    await prisma.regulatoryRequirement.update({
      where: { id: requirement.id },
      data: { editorialStatus: 'LEGAL_REVIEW_PENDING' },
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
    await expect(
      prisma.regulatoryProvision.delete({ where: { id: provisionA.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirement.delete({ where: { id: requirement.id } }),
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

  it('supports reviewed editorial lifecycles, explicit replacements and provenance freezing', async () => {
    const owner = await register('Regulatory Lifecycle Owner');
    const organizationId = await createOrganization(owner.token, 'Regulatory Lifecycle');
    const sourceKey = `DEMO_LIFECYCLE_SOURCE_${suffix.toUpperCase()}`;
    const source = await prisma.regulatorySource.create({
      data: {
        sourceKey,
        countryCode: 'EC',
        issuer: 'Emisor sintético de ciclo editorial',
        documentType: 'OTHER',
        referenceNumber: `LIFECYCLE-${suffix}`,
        canonicalTitle: 'Fuente sintética para ciclo editorial',
        versions: {
          create: [
            {
              catalogVersion: 1,
              candidateStatus: 'TECHNICAL_REVIEW_PENDING',
              officialDocumentLocated: false,
              supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
              readyForExtraction: false,
              readyForRules: false,
              reviewNotes: 'Snapshot sintético v1.',
            },
            {
              catalogVersion: 2,
              candidateStatus: 'LEGAL_REVIEW_PENDING',
              officialDocumentLocated: false,
              supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
              readyForExtraction: false,
              readyForRules: false,
              reviewNotes: 'Snapshot sintético v2.',
            },
          ],
        },
      },
      include: { versions: { orderBy: { catalogVersion: 'asc' } } },
    });
    const versionOne = source.versions[0]!;
    const versionTwo = source.versions[1]!;

    const provision = await prisma.regulatoryProvision.create({
      data: {
        sourceVersionId: versionOne.id,
        provisionKey: `DEMO_LIFECYCLE_PROVISION_${suffix.toUpperCase()}`,
        locatorType: 'ARTICLE',
        locatorLabel: 'Artículo sintético inicial',
        heading: 'Borrador inicial',
        summary: 'Resumen inicial.',
        editorialStatus: 'DRAFT',
      },
    });
    const editedProvision = await prisma.regulatoryProvision.update({
      where: { id: provision.id },
      data: { heading: 'Borrador revisado', summary: 'Resumen revisado.' },
    });
    expect(editedProvision).toMatchObject({
      heading: 'Borrador revisado',
      summary: 'Resumen revisado.',
      editorialStatus: 'DRAFT',
    });
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { provisionKey: `${provision.provisionKey}_CHANGED` },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { sourceVersionId: versionTwo.id },
      }),
    ).rejects.toThrow();

    const invalidProvision = await prisma.regulatoryProvision.create({
      data: {
        sourceVersionId: versionOne.id,
        provisionKey: `DEMO_INVALID_PROVISION_${suffix.toUpperCase()}`,
        locatorType: 'SECTION',
        locatorLabel: 'Salto inválido',
        editorialStatus: 'DRAFT',
      },
    });
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: invalidProvision.id },
        data: { editorialStatus: 'APPROVED' },
      }),
    ).rejects.toThrow();

    for (const editorialStatus of [
      'EXTRACTED',
      'TECHNICAL_REVIEW_PENDING',
      'LEGAL_REVIEW_PENDING',
      'APPROVED',
    ] as const) {
      await prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { editorialStatus },
      });
    }
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { heading: 'Cambio posterior' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { summary: 'Cambio posterior.' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { provisionKey: `${provision.provisionKey}_APPROVED_CHANGE` },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { sourceVersionId: versionTwo.id },
      }),
    ).rejects.toThrow();

    const selfProvisionId = '22000000-0000-4000-8000-000000000101';
    await expect(
      prisma.regulatoryProvision.create({
        data: {
          id: selfProvisionId,
          sourceVersionId: versionOne.id,
          provisionKey: `DEMO_SELF_PROVISION_${suffix.toUpperCase()}`,
          locatorType: 'ARTICLE',
          locatorLabel: 'Autorrelación inválida',
          editorialStatus: 'DRAFT',
          supersedesProvisionId: selfProvisionId,
        },
      }),
    ).rejects.toThrow();

    const replacementProvision = await prisma.regulatoryProvision.create({
      data: {
        sourceVersionId: versionTwo.id,
        provisionKey: `DEMO_REPLACEMENT_PROVISION_${suffix.toUpperCase()}`,
        locatorType: 'ARTICLE',
        locatorLabel: 'Artículo sintético reemplazante',
        heading: 'Nuevo artefacto estructurado',
        summary: 'Reemplazo editorial explícito.',
        editorialStatus: 'DRAFT',
        supersedesProvisionId: provision.id,
      },
    });
    expect(replacementProvision.supersedesProvisionId).toBe(provision.id);
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { supersedesProvisionId: replacementProvision.id },
      }),
    ).rejects.toThrow();
    const supersededProvision = await prisma.regulatoryProvision.update({
      where: { id: provision.id },
      data: { editorialStatus: 'SUPERSEDED' },
    });
    expect(supersededProvision.editorialStatus).toBe('SUPERSEDED');
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: provision.id },
        data: { heading: 'Cambio terminal' },
      }),
    ).rejects.toThrow();

    const rejectedProvision = await prisma.regulatoryProvision.create({
      data: {
        sourceVersionId: versionOne.id,
        provisionKey: `DEMO_REJECTED_PROVISION_${suffix.toUpperCase()}`,
        locatorType: 'OTHER',
        locatorLabel: 'Disposición descartada',
        editorialStatus: 'DRAFT',
      },
    });
    await prisma.regulatoryProvision.update({
      where: { id: rejectedProvision.id },
      data: { editorialStatus: 'REJECTED' },
    });
    await expect(
      prisma.regulatoryProvision.update({
        where: { id: rejectedProvision.id },
        data: { heading: 'No reutilizar' },
      }),
    ).rejects.toThrow();

    const requirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_LIFECYCLE_REQUIREMENT_${suffix.toUpperCase()}`,
        title: 'Requisito borrador',
        description: 'Descripción inicial.',
        editorialStatus: 'DRAFT',
        scopeHint: 'UNKNOWN',
      },
    });
    const editedRequirement = await prisma.regulatoryRequirement.update({
      where: { id: requirement.id },
      data: {
        title: 'Requisito revisado',
        description: 'Descripción revisada.',
        scopeHint: 'WORK_CENTER',
      },
    });
    expect(editedRequirement).toMatchObject({
      title: 'Requisito revisado',
      description: 'Descripción revisada.',
      scopeHint: 'WORK_CENTER',
    });
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { requirementKey: `${requirement.requirementKey}_CHANGED` },
      }),
    ).rejects.toThrow();

    const editableLink = await prisma.regulatoryRequirementSource.create({
      data: {
        requirementId: requirement.id,
        provisionId: provision.id,
        relationshipType: 'PRIMARY_SOURCE',
      },
    });
    const changedLink = await prisma.regulatoryRequirementSource.update({
      where: { id: editableLink.id },
      data: { relationshipType: 'SUPPORTING_SOURCE' },
    });
    expect(changedLink.relationshipType).toBe('SUPPORTING_SOURCE');
    await prisma.regulatoryRequirementSource.delete({ where: { id: editableLink.id } });
    const approvedLink = await prisma.regulatoryRequirementSource.create({
      data: {
        requirementId: requirement.id,
        provisionId: provision.id,
        relationshipType: 'PRIMARY_SOURCE',
      },
    });

    const invalidRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_INVALID_REQUIREMENT_${suffix.toUpperCase()}`,
        title: 'Salto inválido',
        description: 'Debe recorrer las revisiones.',
        editorialStatus: 'DRAFT',
        scopeHint: 'UNKNOWN',
      },
    });
    await prisma.regulatoryRequirementSource.create({
      data: {
        requirementId: invalidRequirement.id,
        provisionId: replacementProvision.id,
        relationshipType: 'PRIMARY_SOURCE',
      },
    });
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: invalidRequirement.id },
        data: { editorialStatus: 'APPROVED_FOR_RULE_DRAFTING' },
      }),
    ).rejects.toThrow();

    const noProvenanceRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_NO_PROVENANCE_${suffix.toUpperCase()}`,
        title: 'Sin procedencia',
        description: 'No puede aprobarse.',
        editorialStatus: 'DRAFT',
        scopeHint: 'UNKNOWN',
      },
    });
    await prisma.regulatoryRequirement.update({
      where: { id: noProvenanceRequirement.id },
      data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
    });
    await prisma.regulatoryRequirement.update({
      where: { id: noProvenanceRequirement.id },
      data: { editorialStatus: 'LEGAL_REVIEW_PENDING' },
    });
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: noProvenanceRequirement.id },
        data: { editorialStatus: 'APPROVED_FOR_RULE_DRAFTING' },
      }),
    ).rejects.toThrow();

    for (const editorialStatus of [
      'TECHNICAL_REVIEW_PENDING',
      'LEGAL_REVIEW_PENDING',
      'APPROVED_FOR_RULE_DRAFTING',
    ] as const) {
      await prisma.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { editorialStatus },
      });
    }
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { title: 'Cambio posterior' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { description: 'Cambio posterior.' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { scopeHint: 'ORGANIZATION' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirementSource.create({
        data: {
          requirementId: requirement.id,
          provisionId: replacementProvision.id,
          relationshipType: 'SUPPORTING_SOURCE',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirementSource.update({
        where: { id: approvedLink.id },
        data: { relationshipType: 'SUPPORTING_SOURCE' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regulatoryRequirementSource.delete({ where: { id: approvedLink.id } }),
    ).rejects.toThrow();

    const selfRequirementId = '22000000-0000-4000-8000-000000000102';
    await expect(
      prisma.regulatoryRequirement.create({
        data: {
          id: selfRequirementId,
          requirementKey: `DEMO_SELF_REQUIREMENT_${suffix.toUpperCase()}`,
          title: 'Autorrelación inválida',
          description: 'No debe persistir.',
          editorialStatus: 'DRAFT',
          scopeHint: 'UNKNOWN',
          supersedesRequirementId: selfRequirementId,
        },
      }),
    ).rejects.toThrow();

    const replacementRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_REPLACEMENT_REQUIREMENT_${suffix.toUpperCase()}`,
        title: 'Requisito reemplazante',
        description: 'Nueva versión estructurada.',
        editorialStatus: 'DRAFT',
        scopeHint: 'ACTIVITY',
        supersedesRequirementId: requirement.id,
      },
    });
    expect(replacementRequirement.supersedesRequirementId).toBe(requirement.id);
    const replacementLink = await prisma.regulatoryRequirementSource.create({
      data: {
        requirementId: replacementRequirement.id,
        provisionId: replacementProvision.id,
        relationshipType: 'PRIMARY_SOURCE',
      },
    });
    for (const editorialStatus of [
      'TECHNICAL_REVIEW_PENDING',
      'LEGAL_REVIEW_PENDING',
      'APPROVED_FOR_RULE_DRAFTING',
    ] as const) {
      await prisma.regulatoryRequirement.update({
        where: { id: replacementRequirement.id },
        data: { editorialStatus },
      });
    }
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { supersedesRequirementId: replacementRequirement.id },
      }),
    ).rejects.toThrow();
    const supersededRequirement = await prisma.regulatoryRequirement.update({
      where: { id: requirement.id },
      data: { editorialStatus: 'SUPERSEDED' },
    });
    expect(supersededRequirement.editorialStatus).toBe('SUPERSEDED');

    const oldRequirementDetail = await authorizedGet(
      owner.token,
      organizationId,
      `/regulatory-requirements/${requirement.requirementKey}`,
    ).expect(200);
    const newRequirementDetail = await authorizedGet(
      owner.token,
      organizationId,
      `/regulatory-requirements/${replacementRequirement.requirementKey}`,
    ).expect(200);
    expect(oldRequirementDetail.body).toMatchObject({
      requirement: { editorialStatus: 'SUPERSEDED', supersedesRequirementId: null },
      provenance: [
        expect.objectContaining({ provision: expect.objectContaining({ id: provision.id }) }),
      ],
    });
    expect(newRequirementDetail.body).toMatchObject({
      requirement: {
        editorialStatus: 'APPROVED_FOR_RULE_DRAFTING',
        supersedesRequirementId: requirement.id,
      },
      provenance: [
        expect.objectContaining({
          provision: expect.objectContaining({ id: replacementProvision.id }),
        }),
      ],
    });
    expect(replacementLink.requirementId).toBe(replacementRequirement.id);

    const provisionDetail = await authorizedGet(
      owner.token,
      organizationId,
      `/regulatory-provisions/${replacementProvision.id}`,
    ).expect(200);
    expect(provisionDetail.body.provision.supersedesProvisionId).toBe(provision.id);

    const rejectedRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `DEMO_REJECTED_REQUIREMENT_${suffix.toUpperCase()}`,
        title: 'Requisito descartado',
        description: 'No se reutiliza.',
        editorialStatus: 'DRAFT',
        scopeHint: 'UNKNOWN',
      },
    });
    await prisma.regulatoryRequirement.update({
      where: { id: rejectedRequirement.id },
      data: { editorialStatus: 'REJECTED' },
    });
    await expect(
      prisma.regulatoryRequirement.update({
        where: { id: rejectedRequirement.id },
        data: { title: 'No reutilizar' },
      }),
    ).rejects.toThrow();
  }, 60_000);
});
