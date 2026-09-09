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
    expect(references.body).toEqual([
      expect.objectContaining({ id: meetingA.id, label: 'Reunión canónica A' }),
    ]);
    expect(references.body).not.toEqual(
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
});
