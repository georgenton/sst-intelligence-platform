import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RISK_METHOD_REFERENCE_IDS } from '../src/risk-methodology/risk-method-reference-data';

describe('risk methodology runtime integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let organizationId: string;
  let workCenterId: string;
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
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `risk-method-${suffix}@example.test`,
        displayName: 'Risk Method Owner',
        password: 'risk-method-password-strong-123',
      })
      .expect(201);
    token = registered.body.accessToken as string;
    userId = registered.body.user.id as string;
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Risk Method Org ${suffix}`, country: 'Ecuador' })
      .expect(201);
    organizationId = organization.body.id as string;
    const moduleDefinition = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.upsert({
      where: {
        organizationId_moduleId: { organizationId, moduleId: moduleDefinition.id },
      },
      update: { status: 'ACTIVE', source: 'MANUAL' },
      create: {
        organizationId,
        moduleId: moduleDefinition.id,
        status: 'ACTIVE',
        source: 'MANUAL',
      },
    });
    workCenterId = (await prisma.workCenter.findFirstOrThrow({ where: { organizationId } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const authorized = () => ({
    Authorization: `Bearer ${token}`,
    'x-organization-id': organizationId,
  });

  async function createStartedInspection(methodVersionId: string, title: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(authorized())
      .send({
        workCenterId,
        title,
        riskMethodVersionId: methodVersionId,
        inspectionDepth: 'BASIC',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${created.body.id as string}/start`)
      .set(authorized())
      .expect(201);
    return created.body.id as string;
  }

  it('exposes the authenticated global catalog without legal endorsement', async () => {
    await request(app.getHttpServer()).get('/api/v1/risk-methods').expect(401);
    const response = await request(app.getHttpServer())
      .get('/api/v1/risk-methods')
      .set(authorized())
      .expect(200);
    expect(response.body).toHaveLength(3);
    expect(response.body.map((method: { methodKey: string }) => method.methodKey).sort()).toEqual([
      'DEMO_5X5',
      'GTC45_2010',
      'GUIDED_5X5',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('Normativa obligatoria Ecuador');
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          methodKey: 'GTC45_2010',
          publicationStatus: 'CANDIDATE',
          regulatory: false,
        }),
      ]),
    );
  });

  it('versions organization method policy and guided criteria with authoritative write roles', async () => {
    const inherited = await request(app.getHttpServer())
      .get('/api/v1/risk-methods/organization/policy')
      .set(authorized())
      .expect(200);
    expect(inherited.body).toMatchObject({
      version: 0,
      inheritedDefault: true,
      defaultRiskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
    });

    const policyInput = {
      allowedRiskMethodVersionIds: [
        RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
        RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      ],
      defaultRiskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
    };
    await request(app.getHttpServer())
      .put('/api/v1/risk-methods/organization/policy')
      .set(authorized())
      .send(policyInput)
      .expect(200)
      .expect(({ body }) => {
        expect(body.version).toBe(1);
        expect(body.defaultRiskMethodVersionId).toBe(policyInput.defaultRiskMethodVersionId);
        expect(body.allowedMethods).toHaveLength(2);
      });

    const guidance = {
      probabilityGuidance: [1, 2, 3, 4, 5].map((value) => ({
        value,
        label: `Probabilidad ${value}`,
        help: `Criterio organizacional de probabilidad nivel ${value}.`,
        cues: [`Indicador verificable P${value}`],
      })),
      severityGuidance: [1, 2, 3, 4, 5].map((value) => ({
        value,
        label: `Severidad ${value}`,
        help: `Criterio organizacional de severidad nivel ${value}.`,
        cues: [`Indicador verificable S${value}`],
      })),
      additionalCriteria: ['Documentar la evidencia profesional usada.'],
    };
    const savedProfile = await request(app.getHttpServer())
      .put('/api/v1/risk-methods/organization/guided-5x5-profile')
      .set(authorized())
      .send(guidance)
      .expect(200);
    expect(savedProfile.body).toMatchObject({
      version: 1,
      riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
      guidance,
    });
    expect(savedProfile.body.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const technicianRegistration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `risk-method-technician-${suffix}@example.test`,
        displayName: 'Risk Method Technician',
        password: 'risk-method-technician-password-123',
      })
      .expect(201);
    await prisma.membership.create({
      data: {
        organizationId,
        userId: technicianRegistration.body.user.id as string,
        role: 'SST_TECHNICIAN',
      },
    });
    const technicianHeaders = {
      Authorization: `Bearer ${technicianRegistration.body.accessToken as string}`,
      'x-organization-id': organizationId,
    };
    await request(app.getHttpServer())
      .get('/api/v1/risk-methods/organization/policy')
      .set(technicianHeaders)
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/risk-methods/organization/policy')
      .set(technicianHeaders)
      .send(policyInput)
      .expect(403);
    await request(app.getHttpServer())
      .put('/api/v1/risk-methods/organization/guided-5x5-profile')
      .set(technicianHeaders)
      .send(guidance)
      .expect(403);
  });

  it('binds guided initial and residual valuation to the same exact version', async () => {
    const inspectionId = await createStartedInspection(
      RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
      `Guided inspection ${suffix}`,
    );
    const finding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings`)
      .set(authorized())
      .send({
        title: 'Exposición guiada',
        description: 'Fixture determinístico sin datos personales.',
        category: 'ELECTRICAL',
        methodInput: {
          probability: 4,
          severity: 5,
          severityDimension: 'HUMAN',
          checkedProbabilityCueKeys: ['FREQUENT_EXPOSURE'],
          checkedSeverityCueKeys: ['FATALITY_POSSIBLE'],
          selectionRationale:
            'La exposición es frecuente y la consecuencia humana puede ser fatal.',
        },
      })
      .expect(201);
    expect(finding.body).toMatchObject({
      riskMethodKey: 'GUIDED_5X5',
      riskMethodVersion: '1.0.0',
      riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
      initialScore: 20,
      initialRiskLevel: 'CRITICAL',
    });
    const regulatoryTarget = await prisma.regulatoryUnit.findFirstOrThrow({
      where: { reviewStatus: 'VERIFIED', provisions: { some: {} } },
      include: {
        provisions: {
          include: { provision: { include: { requirementSources: true } } },
          take: 1,
        },
      },
    });
    const requirementId =
      regulatoryTarget.provisions[0]?.provision.requirementSources[0]?.requirementId;
    if (!requirementId) throw new Error('REGULATORY_LINK_REQUIREMENT_FIXTURE_MISSING');
    await request(app.getHttpServer())
      .post(`/api/v1/regulatory-risk-links/inspection-findings/${finding.body.id as string}`)
      .set(authorized())
      .send({
        unitId: regulatoryTarget.id,
        requirementId,
        provenance: 'USER_REFERENCE',
        rationale: 'Referencia profesional; no constituye por sí sola una conclusión legal.',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.organizationId).toBe(organizationId);
        expect(body.unit.sourceVersion.source.sourceKey).toBeTruthy();
      });
    await expect(
      prisma.inspection.update({
        where: { id: inspectionId },
        data: { riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010 },
      }),
    ).rejects.toThrow(/INSPECTION_RISK_METHOD_LOCKED_AFTER_VALUATION/);
    const action = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions`)
      .set(authorized())
      .send({ title: 'Aislar el peligro', assignedToUserId: userId, priority: 'URGENT' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions/${action.body.id as string}/evidence`,
      )
      .set(authorized())
      .send({ type: 'NOTE', note: 'Control aplicado y verificado.' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions/${action.body.id as string}/complete`,
      )
      .set(authorized())
      .expect(201);
    const residualInput = {
      probability: 1,
      severity: 2,
      severityDimension: 'HUMAN',
      checkedProbabilityCueKeys: ['STRONG_INDEPENDENT_CONTROLS'],
      checkedSeverityCueKeys: ['SHORT_RECOVERY'],
      selectionRationale: 'Los controles posteriores reducen exposición y consecuencia razonable.',
    };
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/verify`)
      .set(authorized())
      .send({
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        methodInput: residualInput,
        basis: 'RECORDED_EVIDENCE',
        selfVerificationAcknowledged: true,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('RESIDUAL_METHOD_VERSION_MISMATCH'));
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/verify`)
      .set(authorized())
      .send({
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
        methodInput: residualInput,
        basis: 'RECORDED_EVIDENCE',
        selfVerificationAcknowledged: true,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.residualMethodVersionId).toBe(RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5);
        expect(body.residualScore).toBe(2);
        expect(body.residualRationale).toBe(residualInput.selectionRationale);
      });
  });

  it('executes canonical GTC45 including the LOW direct-IV path without ND zero', async () => {
    const inspectionId = await createStartedInspection(
      RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      `GTC inspection ${suffix}`,
    );
    const finding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings`)
      .set(authorized())
      .send({
        title: 'Peligro con deficiencia baja',
        description: 'Caso sintético para el tratamiento especial documentado.',
        category: 'MECHANICAL',
        methodInput: {
          deficiency: 'LOW',
          exposure: 4,
          consequence: 100,
          existingControls: { source: 'Resguardo fijo verificado.' },
          guidanceResponses: { CONTROL_EFFECTIVENESS: 'Cobertura observada en campo.' },
          professionalRationale: 'La deficiencia baja se seleccionó por el control observado.',
        },
      })
      .expect(201);
    expect(finding.body).toMatchObject({
      riskMethodKey: 'GTC45_2010',
      riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      initialLikelihood: null,
      initialScore: null,
      initialRiskLevel: null,
      initialResultLabel: 'Nivel de intervención IV',
      guidanceVersionId: RISK_METHOD_REFERENCE_IDS.guidance.ANITA_GTC45,
    });
    expect(finding.body.initialMethodResult).toMatchObject({
      deficiencyValue: null,
      probabilityValue: null,
      riskValue: null,
      riskLevel: 'IV',
      specialHandling: 'LOW_DEFICIENCY_DIRECT_TO_IV',
      trace: {
        deficiency: { selection: 'LOW', numericValue: null },
        probability: { operation: 'NOT_APPLIED_LOW_DEFICIENCY', value: null },
        risk: { operation: 'NOT_APPLIED_LOW_DEFICIENCY', value: null },
      },
    });
  });

  it('keeps GTC45 v1 bound after a hypothetical v2 and rejects every residual substitution', async () => {
    const inspectionId = await createStartedInspection(
      RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      `GTC exact-version inspection ${suffix}`,
    );
    const finding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings`)
      .set(authorized())
      .send({
        title: 'Peligro GTC versionado',
        description: 'Caso sintético para validar binding y persistencia histórica.',
        category: 'ELECTRICAL',
        methodInput: {
          deficiency: 'HIGH',
          exposure: 3,
          consequence: 60,
          professionalRationale: 'La selección se sustenta en exposición frecuente observada.',
        },
      })
      .expect(201);
    const initialBeforeResidual = await prisma.inspectionFinding.findUniqueOrThrow({
      where: { id: finding.body.id as string },
      select: {
        riskMethodKey: true,
        riskMethodVersion: true,
        riskMethodVersionId: true,
        riskMethodSnapshot: true,
        initialMethodInput: true,
        initialMethodResult: true,
        initialLikelihood: true,
        initialConsequence: true,
        initialScore: true,
        initialRiskLevel: true,
        initialResultLabel: true,
      },
    });
    expect(initialBeforeResidual).toMatchObject({
      riskMethodKey: 'GTC45_2010',
      riskMethodVersion: '1.0.0',
      riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      initialLikelihood: 18,
      initialConsequence: 60,
      initialScore: 1080,
      initialRiskLevel: null,
      initialResultLabel: 'Nivel de intervención I',
    });

    const futureVersion = await prisma.riskMethodVersion.create({
      data: {
        id: randomUUID(),
        methodDefinitionId: RISK_METHOD_REFERENCE_IDS.definitions.GTC45_2010,
        semanticVersion: '2.0.0',
        displayName: 'GTC 45 — hypothetical v2 test fixture',
        methodKind: 'HAZARD_RISK_ASSESSMENT',
        calculationProviderKey: 'GTC45_2010_CANONICAL',
        calculationProviderVersion: '1.0.0',
        inputSchemaVersion: '1.0.0',
        resultSchemaVersion: '1.0.0',
        isDemo: true,
        regulatory: false,
        publicationStatus: 'CANDIDATE',
        technicalReviewStatus: 'PENDING',
        legalReviewStatus: 'PENDING',
        disclaimer: 'Fixture de integración aislada; no es una versión productiva.',
        manifest: { fixture: true, semanticVersion: '2.0.0' },
        contentHash: 'f'.repeat(64),
      },
    });
    expect(
      await prisma.inspection.findUniqueOrThrow({
        where: { id: inspectionId },
        select: { riskMethodVersionId: true, riskMethodSnapshot: true },
      }),
    ).toMatchObject({
      riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
      riskMethodSnapshot: expect.objectContaining({
        methodKey: 'GTC45_2010',
        semanticVersion: '1.0.0',
      }),
    });

    const action = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions`)
      .set(authorized())
      .send({ title: 'Aplicar control verificable', assignedToUserId: userId, priority: 'HIGH' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions/${action.body.id as string}/evidence`,
      )
      .set(authorized())
      .send({ type: 'NOTE', note: 'Control sintético registrado para verificar residual.' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/actions/${action.body.id as string}/complete`,
      )
      .set(authorized())
      .expect(201);

    const residualInput = {
      deficiency: 'MEDIUM',
      exposure: 1,
      consequence: 10,
      professionalRationale: 'Los controles redujeron la deficiencia y la exposición observada.',
    };
    for (const substitutedVersionId of [
      RISK_METHOD_REFERENCE_IDS.versions.GUIDED_5X5,
      RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5,
      futureVersion.id,
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/verify`)
        .set(authorized())
        .send({
          riskMethodVersionId: substitutedVersionId,
          methodInput: residualInput,
          basis: 'RECORDED_EVIDENCE',
          selfVerificationAcknowledged: true,
        })
        .expect(400)
        .expect(({ body }) => expect(body.code).toBe('RESIDUAL_METHOD_VERSION_MISMATCH'));
    }

    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${finding.body.id as string}/verify`)
      .set(authorized())
      .send({
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        methodInput: residualInput,
        basis: 'RECORDED_EVIDENCE',
        selfVerificationAcknowledged: true,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          residualMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
          residualLikelihood: 2,
          residualConsequence: 10,
          residualScore: 20,
          residualRiskLevel: null,
          residualResultLabel: 'Nivel de intervención IV',
        });
      });

    const afterResidual = await prisma.inspectionFinding.findUniqueOrThrow({
      where: { id: finding.body.id as string },
      select: {
        riskMethodKey: true,
        riskMethodVersion: true,
        riskMethodVersionId: true,
        riskMethodSnapshot: true,
        initialMethodInput: true,
        initialMethodResult: true,
        initialLikelihood: true,
        initialConsequence: true,
        initialScore: true,
        initialRiskLevel: true,
        initialResultLabel: true,
        residualMethodVersionId: true,
        residualMethodInput: true,
        residualMethodResult: true,
      },
    });
    expect(afterResidual).toMatchObject(initialBeforeResidual);
    expect(afterResidual.residualMethodVersionId).toBe(
      RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
    );
    await expect(
      prisma.inspectionFinding.update({
        where: { id: finding.body.id as string },
        data: { initialScore: 0, initialResultLabel: 'Alterado' },
      }),
    ).rejects.toThrow(/INITIAL_RISK_VALUATION_IMMUTABLE/);
    await expect(
      prisma.inspectionFinding.update({
        where: { id: finding.body.id as string },
        data: { residualResultLabel: 'Alterado' },
      }),
    ).rejects.toThrow(/RESIDUAL_RISK_VALUATION_IMMUTABLE/);
    await prisma.riskMethodVersion.delete({ where: { id: futureVersion.id } });
  });

  it('rejects unavailable versions and protects published reference rows in the database', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(authorized())
      .send({
        workCenterId,
        title: 'Unavailable method',
        riskMethodVersionId: '00000000-0000-4000-8000-000000000000',
        inspectionDepth: 'BASIC',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('RISK_METHOD_UNAVAILABLE'));
    await expect(
      prisma.riskMethodVersion.update({
        where: { id: RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5 },
        data: { displayName: 'Mutation forbidden' },
      }),
    ).rejects.toThrow(/PUBLISHED_REFERENCE_IMMUTABLE/);
    await expect(
      prisma.riskMethodVersion.delete({
        where: { id: RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5 },
      }),
    ).rejects.toThrow(/PUBLISHED_REFERENCE_IMMUTABLE/);

    for (const operation of ['update', 'delete'] as const) {
      await expect(
        prisma.$transaction(async (tx) => {
          const source = await tx.methodologySource.create({
            data: { sourceKey: `IMMUTABLE_SOURCE_${randomUUID().replaceAll('-', '_')}` },
          });
          const version = await tx.methodologySourceVersion.create({
            data: {
              sourceId: source.id,
              semanticVersion: '1.0.0',
              title: 'Published source fixture',
              issuer: 'Integration test',
              documentType: 'OTHER',
              edition: 'Test edition',
              sourceFingerprint: 'a'.repeat(64),
              sourceStatus: 'UNVERIFIED_REFERENCE',
              licenseReproductionNote: 'Synthetic fixture without protected content.',
              reviewStatus: 'PENDING',
              publicationStatus: 'PUBLISHED',
              manifest: { fixture: true },
              contentHash: 'a'.repeat(64),
            },
          });
          if (operation === 'update')
            await tx.methodologySourceVersion.update({
              where: { id: version.id },
              data: { title: 'Forbidden mutation' },
            });
          else await tx.methodologySourceVersion.delete({ where: { id: version.id } });
        }),
      ).rejects.toThrow(/PUBLISHED_REFERENCE_IMMUTABLE/);

      await expect(
        prisma.$transaction(async (tx) => {
          const guidance = await tx.riskMethodExpertGuidanceVersion.create({
            data: {
              guidanceKey: `IMMUTABLE_GUIDANCE_${randomUUID().replaceAll('-', '_')}`,
              guidanceVersion: '1.0.0',
              riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5,
              authorSource: 'Integration test',
              evidenceClassification: 'EXPERT_OBSERVATION',
              reviewStatus: 'APPROVED',
              officialUiVerification: 'VERIFIED',
              helpDefinitions: [{ fixture: true }],
              disclaimer: 'Synthetic immutable guidance fixture.',
              manifest: { fixture: true },
              contentHash: 'b'.repeat(64),
              publicationStatus: 'PUBLISHED',
              publishedAt: new Date(),
            },
          });
          if (operation === 'update')
            await tx.riskMethodExpertGuidanceVersion.update({
              where: { id: guidance.id },
              data: { disclaimer: 'Forbidden mutation' },
            });
          else await tx.riskMethodExpertGuidanceVersion.delete({ where: { id: guidance.id } });
        }),
      ).rejects.toThrow(/PUBLISHED_REFERENCE_IMMUTABLE/);
    }

    await expect(
      prisma.riskMethodSourceLink.create({
        data: {
          riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5,
          methodologySourceVersionId: RISK_METHOD_REFERENCE_IDS.sourceVersions.CO_GTC45_2010,
          relationship: 'TECHNICAL_BASIS',
        },
      }),
    ).rejects.toThrow(/PUBLISHED_METHOD_AGGREGATE_IMMUTABLE/);
    await expect(
      prisma.riskMethodRegulatoryContext.create({
        data: {
          contextKey: `IMMUTABLE_CONTEXT_${randomUUID().replaceAll('-', '_')}`,
          contextVersion: '1.0.0',
          riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.DEMO_5X5,
          jurisdiction: 'EC',
          relationship: 'CONTEXT_NOT_LEGAL_ENDORSEMENT',
          sourceReferences: [],
          statement: 'Synthetic context fixture.',
          technicalReviewStatus: 'PENDING',
          legalReviewStatus: 'PENDING',
          officialSutMethodOptions: 'PENDING',
          manifest: { fixture: true },
          contentHash: 'c'.repeat(64),
        },
      }),
    ).rejects.toThrow(/PUBLISHED_METHOD_AGGREGATE_IMMUTABLE/);
  });
});
