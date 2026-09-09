import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('evidence packages integration', () => {
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
        email: `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`,
        displayName: label,
        password: 'evidence-package-password-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
  }

  async function organization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    return response.body.id as string;
  }

  function api(token: string, organizationId: string) {
    const headers = <T extends SuperTestRequest>(operation: T) =>
      operation.set('Authorization', `Bearer ${token}`).set('x-organization-id', organizationId);
    return {
      get: (path: string) => headers(request(app.getHttpServer()).get(`/api/v1${path}`)),
      post: (path: string) => headers(request(app.getHttpServer()).post(`/api/v1${path}`)),
    };
  }

  async function setInspectionsAccess(organizationId: string, enabled: boolean) {
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId, moduleId: module.id } },
      update: { status: enabled ? 'ACTIVE' : 'SUSPENDED', source: 'MANUAL' },
      create: {
        organizationId,
        moduleId: module.id,
        status: enabled ? 'ACTIVE' : 'SUSPENDED',
        source: 'MANUAL',
      },
    });
  }

  it('finalizes an immutable tenant manifest backed by canonical source references', async () => {
    const owner = await register('Evidence Owner');
    const viewer = await register('Evidence Viewer');
    const orgA = await organization(owner.token, 'Evidence A');
    const orgB = await organization(owner.token, 'Evidence B');
    await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });
    const bodyA = await prisma.governanceBody.create({
      data: {
        organizationId: orgA,
        createdById: owner.userId,
        name: `Gobernanza evidencia A ${suffix}`,
        category: 'WORK_GROUP',
      },
    });
    const bodyB = await prisma.governanceBody.create({
      data: {
        organizationId: orgB,
        createdById: owner.userId,
        name: `Gobernanza evidencia B ${suffix}`,
        category: 'WORK_GROUP',
      },
    });
    const meetingA = await prisma.governanceMeeting.create({
      data: {
        organizationId: orgA,
        bodyId: bodyA.id,
        title: 'Reunión canónica A',
        scheduledAt: new Date('2026-09-10T14:00:00.000Z'),
        mode: 'IN_PERSON',
        createdById: owner.userId,
      },
    });
    const meetingB = await prisma.governanceMeeting.create({
      data: {
        organizationId: orgB,
        bodyId: bodyB.id,
        title: 'Reunión canónica B',
        scheduledAt: new Date('2026-09-11T14:00:00.000Z'),
        mode: 'VIRTUAL',
        createdById: owner.userId,
      },
    });
    const ownerApi = api(owner.token, orgA);

    const references = await ownerApi
      .get('/evidence-packages/references/GOVERNANCE_MEETING')
      .expect(200);
    expect(references.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(references.body.items).toEqual([
      expect.objectContaining({ id: meetingA.id, label: 'Reunión canónica A' }),
    ]);
    expect(references.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: meetingB.id })]),
    );
    await api(viewer.token, orgA)
      .get('/evidence-packages/references/GOVERNANCE_MEETING')
      .expect(403);

    await api(viewer.token, orgA)
      .post('/evidence-packages')
      .send({ title: 'No autorizado', scope: 'No autorizado por rol' })
      .expect(403);
    await api(viewer.token, orgA).get('/evidence-packages').expect(200);

    const created = await ownerApi
      .post('/evidence-packages')
      .send({
        title: 'Seguimiento de gobernanza',
        scope: 'Evidencia interna del periodo de septiembre.',
      })
      .expect(201);
    const packageId = created.body.id as string;
    await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingB.id })
      .expect(400);
    const added = await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingA.id })
      .expect(201);
    await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingA.id })
      .expect(409);

    const draftRead = await ownerApi.get(`/evidence-packages/${packageId}`).expect(200);
    expect(draftRead.body.items).toHaveLength(1);
    expect(draftRead.body.items[0].sourceId).toBe(meetingA.id);
    await prisma.governanceMeeting.update({
      where: { id: meetingA.id },
      data: {
        status: 'SCHEDULED',
        updatedAt: new Date('2026-09-10T14:30:00.000Z'),
      },
    });

    const finalized = await ownerApi.post(`/evidence-packages/${packageId}/finalize`).expect(201);
    expect(finalized.body).toMatchObject({
      status: 'FINALIZED',
      version: 1,
      manifest: {
        schemaVersion: 'EVIDENCE_PACKAGE_MANIFEST_V1',
        certificationClaimed: false,
        items: [
          expect.objectContaining({
            type: 'GOVERNANCE_MEETING',
            sourceId: meetingA.id,
            label: 'Reunión canónica A',
            sourceVersion: '2026-09-10T14:30:00.000Z',
            provenance: expect.objectContaining({ status: 'SCHEDULED' }),
          }),
        ],
      },
    });
    expect(finalized.body.items[0]).toMatchObject({
      sourceId: meetingA.id,
      sourceVersion: '2026-09-10T14:30:00.000Z',
      provenance: expect.objectContaining({ status: 'SCHEDULED' }),
    });
    expect(finalized.body.items[0].sourceVersion).not.toBe(added.body.sourceVersion);
    expect(finalized.body.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
    await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingA.id })
      .expect(409);
    await expect(
      prisma.evidencePackage.update({
        where: { id: packageId },
        data: { scope: 'Mutación prohibida del manifiesto finalizado.' },
      }),
    ).rejects.toThrow('Finalized evidence package manifest is immutable');
    await expect(prisma.evidencePackageItem.deleteMany({ where: { packageId } })).rejects.toThrow(
      'Finalized evidence package items are immutable',
    );
    await expect(
      prisma.evidencePackageItem.update({
        where: { id: finalized.body.items[0].id as string },
        data: {
          sourceId: meetingB.id,
          provenance: { status: 'HELD' },
          contentDigest: '0'.repeat(64),
        },
      }),
    ).rejects.toThrow('Finalized evidence package items are immutable');
    await expect(
      prisma.evidencePackageItem.create({
        data: {
          organizationId: orgA,
          packageId,
          type: 'REGULATORY_UNIT',
          sourceId: randomUUID(),
          sourceVersion: null,
          labelSnapshot: 'Inserción prohibida',
          provenance: {},
          contentDigest: null,
        },
      }),
    ).rejects.toThrow('Finalized evidence package items are immutable');
    await api(owner.token, orgB).get(`/evidence-packages/${packageId}`).expect(404);

    const finalizedManifest = finalized.body.manifest as Record<string, unknown>;
    await prisma.governanceMeeting.update({
      where: { id: meetingA.id },
      data: {
        status: 'HELD',
        heldAt: new Date('2026-09-10T15:00:00.000Z'),
        updatedAt: new Date('2026-09-10T15:00:00.000Z'),
      },
    });
    await prisma.governanceBody.update({
      where: { id: bodyA.id },
      data: { status: 'INACTIVE' },
    });
    const historical = await ownerApi.get(`/evidence-packages/${packageId}`).expect(200);
    expect(historical.body.manifest).toEqual(finalizedManifest);
    expect(historical.body.items[0].provenance.status).toBe('SCHEDULED');
    expect(
      await prisma.governanceMeeting.findUniqueOrThrow({ where: { id: meetingA.id } }),
    ).toMatchObject({ status: 'HELD' });

    const regenerated = await ownerApi
      .post('/evidence-packages')
      .send({
        title: 'Seguimiento de gobernanza actualizado',
        scope: 'Nueva captura posterior al cambio de la fuente.',
      })
      .expect(201);
    await ownerApi
      .post(`/evidence-packages/${regenerated.body.id as string}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingA.id })
      .expect(201);
    const regeneratedFinal = await ownerApi
      .post(`/evidence-packages/${regenerated.body.id as string}/finalize`)
      .expect(201);
    expect(regeneratedFinal.body.manifest.items[0].provenance.status).toBe('HELD');
    expect(
      (await ownerApi.get(`/evidence-packages/${packageId}`).expect(200)).body.manifest,
    ).toEqual(finalizedManifest);

    const archived = await ownerApi.post(`/evidence-packages/${packageId}/archive`).expect(201);
    expect(archived.body).toMatchObject({
      status: 'ARCHIVED',
      manifestDigest: finalized.body.manifestDigest,
      manifest: finalized.body.manifest,
    });
    await expect(
      prisma.evidencePackage.update({
        where: { id: packageId },
        data: { manifest: { altered: true } },
      }),
    ).rejects.toThrow('Finalized evidence package manifest is immutable');
    await expect(
      prisma.evidencePackageItem.update({
        where: { id: finalized.body.items[0].id as string },
        data: { labelSnapshot: 'Mutación archivada prohibida' },
      }),
    ).rejects.toThrow('Finalized evidence package items are immutable');
    expect(
      await prisma.auditLog.count({
        where: { organizationId: orgA, entityType: 'EvidencePackage' },
      }),
    ).toBeGreaterThanOrEqual(4);
  });

  it('enforces source entitlements before catalog, add-item and finalization queries', async () => {
    const owner = await register('Evidence Entitlement Owner');
    const orgA = await organization(owner.token, 'Evidence Entitlement A');
    const orgB = await organization(owner.token, 'Evidence Entitlement B');
    const [centerA, centerB] = await Promise.all([
      prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } }),
      prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } }),
    ]);
    const [inspectionA, inspectionB] = await Promise.all([
      prisma.inspection.create({
        data: {
          organizationId: orgA,
          workCenterId: centerA.id,
          inspectorUserId: owner.userId,
          title: 'Inspección protegida A',
        },
      }),
      prisma.inspection.create({
        data: {
          organizationId: orgB,
          workCenterId: centerB.id,
          inspectorUserId: owner.userId,
          title: 'Inspección ajena B',
        },
      }),
    ]);
    const ownerApi = api(owner.token, orgA);
    const draft = await ownerApi
      .post('/evidence-packages')
      .send({ title: 'Paquete protegido', scope: 'Prueba de entitlement de fuente.' })
      .expect(201);

    const inspectionQuery = jest.spyOn(prisma.inspection, 'findMany');
    await ownerApi.get('/evidence-packages/references/INSPECTION').expect(403);
    expect(inspectionQuery).not.toHaveBeenCalled();
    inspectionQuery.mockRestore();
    await ownerApi
      .post(`/evidence-packages/${draft.body.id as string}/items`)
      .send({ type: 'INSPECTION', sourceId: inspectionA.id })
      .expect(403);

    await setInspectionsAccess(orgA, true);
    const inspectionCatalog = await ownerApi
      .get('/evidence-packages/references/INSPECTION?q=protegida&page=1&pageSize=20')
      .expect(200);
    expect(inspectionCatalog.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(inspectionCatalog.body.items).toEqual([
      expect.objectContaining({ id: inspectionA.id, label: 'Inspección protegida A' }),
    ]);
    expect(inspectionCatalog.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: inspectionB.id })]),
    );
    await ownerApi
      .post(`/evidence-packages/${draft.body.id as string}/items`)
      .send({ type: 'INSPECTION', sourceId: inspectionA.id })
      .expect(201);

    await setInspectionsAccess(orgA, false);
    await ownerApi
      .post(`/evidence-packages/${draft.body.id as string}/finalize`)
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('ENTITLEMENT_REQUIRED'));
    expect(
      await prisma.evidencePackage.findUniqueOrThrow({ where: { id: draft.body.id as string } }),
    ).toMatchObject({ status: 'DRAFT', manifest: null });
    await setInspectionsAccess(orgA, true);
    await ownerApi.post(`/evidence-packages/${draft.body.id as string}/finalize`).expect(201);

    await prisma.organization.update({
      where: { id: orgA },
      data: { demoExpiresAt: new Date(Date.now() - 60_000) },
    });
    const incident = await prisma.incident.create({
      data: {
        organizationId: orgA,
        workCenterId: centerA.id,
        occurredAt: new Date('2026-09-09T12:00:00.000Z'),
        reportedByUserId: owner.userId,
        title: 'Incidente protegido por módulo',
        description: 'Fixture sintético sin datos personales.',
        eventType: 'NEAR_MISS',
      },
    });
    const incidentDraft = await ownerApi
      .post('/evidence-packages')
      .send({ title: 'Paquete de incidente', scope: 'Segunda política comercial.' })
      .expect(201);
    await ownerApi.get('/evidence-packages/references/INCIDENT').expect(403);
    await ownerApi
      .post(`/evidence-packages/${incidentDraft.body.id as string}/items`)
      .send({ type: 'INCIDENT', sourceId: incident.id })
      .expect(403);
    await prisma.organization.update({
      where: { id: orgA },
      data: { demoExpiresAt: new Date(Date.now() + 60_000) },
    });
    await ownerApi
      .get('/evidence-packages/references/INCIDENT?q=protegido')
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({ id: incident.id, label: 'Incidente protegido por módulo' }),
        ]);
      });
    await ownerApi
      .post(`/evidence-packages/${incidentDraft.body.id as string}/items`)
      .send({ type: 'INCIDENT', sourceId: incident.id })
      .expect(201);
  });

  it('paginates searchable references and preserves regulatory and label parity', async () => {
    const owner = await register('Evidence Search Owner');
    const organizationId = await organization(owner.token, 'Evidence Search');
    const ownerApi = api(owner.token, organizationId);
    const body = await prisma.governanceBody.create({
      data: {
        organizationId,
        createdById: owner.userId,
        name: `Gobernanza paginada ${suffix}`,
        category: 'WORK_GROUP',
      },
    });
    await prisma.governanceMeeting.createMany({
      data: Array.from({ length: 105 }, (_, index) => ({
        organizationId,
        bodyId: body.id,
        title: `Reunión paginada ${String(index + 1).padStart(3, '0')} ${suffix}`,
        scheduledAt: new Date(Date.UTC(2026, 8, 1, 12, 0, index)),
        mode: 'VIRTUAL' as const,
        createdById: owner.userId,
      })),
    });
    const firstPage = await ownerApi
      .get('/evidence-packages/references/GOVERNANCE_MEETING?page=1&pageSize=20')
      .expect(200);
    expect(firstPage.body).toMatchObject({ total: 105, page: 1, pageSize: 20 });
    expect(firstPage.body.items).toHaveLength(20);
    const sixthPage = await ownerApi
      .get('/evidence-packages/references/GOVERNANCE_MEETING?page=6&pageSize=20')
      .expect(200);
    expect(sixthPage.body.items).toHaveLength(5);
    const oldestTitle = `Reunión paginada 001 ${suffix}`;
    const searchResult = await ownerApi
      .get(`/evidence-packages/references/GOVERNANCE_MEETING?q=${encodeURIComponent(oldestTitle)}`)
      .expect(200);
    expect(searchResult.body).toMatchObject({ total: 1 });
    expect(searchResult.body.items[0]).toMatchObject({ label: oldestTitle });
    expect(firstPage.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: oldestTitle })]),
    );
    const packageResponse = await ownerApi
      .post('/evidence-packages')
      .send({ title: 'Paquete buscable', scope: 'Seleccionado fuera de la primera página.' })
      .expect(201);
    await ownerApi
      .post(`/evidence-packages/${packageResponse.body.id as string}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: searchResult.body.items[0].id as string })
      .expect(201);

    const source = await prisma.regulatorySource.create({
      data: {
        sourceKey: `EVIDENCE_SEARCH_${suffix.replaceAll(/[^A-Za-z0-9]/g, '_')}`,
        countryCode: 'EC',
        issuer: 'Emisor sintético de pruebas',
        documentType: 'OTHER',
        referenceNumber: `EVIDENCE-${suffix}`,
        canonicalTitle: 'Fuente sintética para búsqueda de evidencia',
        versions: {
          create: {
            catalogVersion: 1,
            candidateStatus: 'DISCOVERED',
            supersessionStatus: 'UNKNOWN_REVIEW_REQUIRED',
          },
        },
      },
      include: { versions: true },
    });
    const regulatoryPrefix = `ZZZZ_EVIDENCE_${suffix.replaceAll(/[^A-Za-z0-9]/g, '_')}`;
    await prisma.regulatoryUnit.createMany({
      data: Array.from({ length: 101 }, (_, index) => ({
        sourceVersionId: source.versions[0]!.id,
        unitType: 'ARTICLE' as const,
        identifier: `${regulatoryPrefix}_${String(index + 1).padStart(3, '0')}`,
        heading: `Encabezado sintético ${index + 1}`,
        ordinal: index + 1,
        officialText: `Texto sintético de prueba ${index + 1}.`,
        normalizedTextHash: `sha256:${index.toString(16).padStart(64, '0')}`,
        locator: `Artículo sintético ${String(index + 1).padStart(3, '0')}`,
        extractionStatus: 'EXTRACTED' as const,
        reviewStatus: 'UNREVIEWED' as const,
      })),
    });
    const regulatoryTarget = await prisma.regulatoryUnit.findFirstOrThrow({
      where: { sourceVersionId: source.versions[0]!.id, ordinal: 101 },
    });
    const regulatoryDefaultFirstHundred = await Promise.all([
      ownerApi.get('/evidence-packages/references/REGULATORY_UNIT?page=1&pageSize=50').expect(200),
      ownerApi.get('/evidence-packages/references/REGULATORY_UNIT?page=2&pageSize=50').expect(200),
    ]);
    expect(regulatoryDefaultFirstHundred.flatMap(({ body }) => body.items)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: regulatoryTarget.id })]),
    );
    const regulatorySearch = await ownerApi
      .get(
        `/evidence-packages/references/REGULATORY_UNIT?q=${encodeURIComponent(regulatoryTarget.identifier)}`,
      )
      .expect(200);
    expect(regulatorySearch.body).toMatchObject({ total: 1 });
    expect(regulatorySearch.body.items[0]).toMatchObject({
      id: regulatoryTarget.id,
      label: `${regulatoryTarget.identifier} · ${regulatoryTarget.locator}`,
    });
    expect(regulatorySearch.body.items[0].label).not.toContain(regulatoryTarget.id);
    await ownerApi
      .post(`/evidence-packages/${packageResponse.body.id as string}/items`)
      .send({ type: 'REGULATORY_UNIT', sourceId: regulatoryTarget.id })
      .expect(201);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { demoExpiresAt: new Date(Date.now() + 60_000) },
    });
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const workers = await Promise.all(
      ['Ana Operadora', 'Beatriz Operadora'].map((displayName) =>
        prisma.worker.create({
          data: { organizationId, displayName, workCenterId: center.id, createdById: owner.userId },
        }),
      ),
    );
    const ppeItem = await prisma.ppeCatalogItem.create({
      data: {
        organizationId,
        name: `Casco compartido ${suffix}`,
        category: 'HEAD',
        createdById: owner.userId,
      },
    });
    await Promise.all(
      workers.map((worker, index) =>
        prisma.ppeIssue.create({
          data: {
            organizationId,
            workerId: worker.id,
            ppeCatalogItemId: ppeItem.id,
            issuedAt: new Date(Date.UTC(2026, 8, 8 + index)),
            issuedById: owner.userId,
          },
        }),
      ),
    );
    const ppeCatalog = await ownerApi
      .get(
        `/evidence-packages/references/PPE_ISSUE?q=${encodeURIComponent(ppeItem.name)}&pageSize=20`,
      )
      .expect(200);
    expect(ppeCatalog.body.items).toHaveLength(2);
    expect(new Set(ppeCatalog.body.items.map((item: { label: string }) => item.label)).size).toBe(
      2,
    );
    expect(ppeCatalog.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: `Ana Operadora · ${ppeItem.name}` }),
        expect.objectContaining({ label: `Beatriz Operadora · ${ppeItem.name}` }),
      ]),
    );
  });
});
