import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ppeContinuityFixture } from './support/ppe-continuity-fixture';

const operations = [
  ['catalog', 'PPE_CATALOG_ITEM_CREATED'],
  ['position', 'POSITION_PPE_REQUIREMENT_SELECTED'],
  ['requirement', 'PPE_REQUIREMENT_CREATED'],
  ['delivery', 'PPE_ISSUED'],
  ['acknowledgement', 'PPE_DELIVERY_ACKNOWLEDGED'],
  ['condition', 'PPE_CONDITION_INSPECTED'],
  ['replacement', 'PPE_REPLACED'],
] as const;

describe('EPP mandatory audit transaction boundaries', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let audit: AuditService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    audit = app.get(AuditService);
  });
  afterAll(async () => app.close());

  async function snapshot(organizationId: string) {
    const args = { where: { organizationId }, orderBy: { id: 'asc' as const } };
    return {
      catalog: await prisma.ppeCatalogItem.findMany(args),
      positions: await prisma.positionPpeRequirement.findMany(args),
      requirements: await prisma.workerPpeRequirement.findMany(args),
      issues: await prisma.ppeIssue.findMany(args),
      inspections: await prisma.ppeInspection.findMany(args),
      incidentLinks: await prisma.incidentPpeIssue.findMany(args),
      incidents: await prisma.incident.findMany(args),
      audit: await prisma.auditLog.findMany(args),
    };
  }

  it.each(operations)(
    '%s rolls back a failed audit and retries exactly once (%s)',
    async (operation, action) => {
      const f = await ppeContinuityFixture(app);
      const requirement = await prisma.workerPpeRequirement.create({
        data: {
          organizationId: f.organizationId,
          workerId: f.worker.id,
          ppeCatalogItemId: f.item.id,
          reason: 'Fixture sintético',
          assignedById: f.user.id,
        },
      });
      const issue = await prisma.ppeIssue.create({
        data: {
          organizationId: f.organizationId,
          workerId: f.worker.id,
          ppeCatalogItemId: f.item.id,
          issuedAt: new Date(),
          issuedById: f.user.id,
          status:
            operation === 'replacement'
              ? 'REPLACEMENT_DUE'
              : operation === 'condition'
                ? 'IN_SERVICE'
                : 'ISSUED',
        },
      });
      const incident = await prisma.incident.create({
        data: {
          organizationId: f.organizationId,
          workCenterId: f.center.id,
          occurredAt: new Date(),
          reportedByUserId: f.user.id,
          title: 'Evento sintético',
          description: 'Solo una prueba de continuidad.',
          eventType: 'NEAR_MISS',
          involvedWorkers: { create: { organizationId: f.organizationId, workerId: f.worker.id } },
        },
      });
      const cases = {
        catalog: {
          path: '/ppe/catalog',
          body: { name: 'Nuevo elemento sintético', category: 'HEAD' },
        },
        position: {
          path: '/ppe/position-requirements',
          body: {
            positionId: f.position.id,
            ppeCatalogItemId: f.item.id,
            reason: 'Decisión sintética explícita',
            decision: 'SELECTED_BY_PROFESSIONAL',
          },
        },
        requirement: {
          path: '/ppe/requirements',
          body: {
            workerId: f.worker.id,
            ppeCatalogItemId: f.item.id,
            reason: 'Asignación sintética explícita',
          },
        },
        delivery: {
          path: '/ppe/issues',
          body: {
            workerId: f.worker.id,
            ppeCatalogItemId: f.item.id,
            requirementId: requirement.id,
            issuedAt: new Date().toISOString(),
            evidenceNote: 'Entrega sintética',
          },
        },
        acknowledgement: {
          path: `/ppe/issues/${issue.id}/acknowledge`,
          body: { expectedVersion: 1, note: 'Confirmación sintética' },
        },
        condition: {
          path: `/ppe/issues/${issue.id}/inspect`,
          body: {
            expectedVersion: 1,
            inspectedAt: new Date().toISOString(),
            condition: 'UNSERVICEABLE',
            note: 'Condición sintética',
          },
        },
        replacement: {
          path: `/ppe/issues/${issue.id}/replace`,
          body: {
            expectedVersion: 1,
            issuedAt: new Date().toISOString(),
            reason: 'DAMAGE',
            linkedIncidentId: incident.id,
            evidenceUrl: 'https://example.test/evidence',
          },
        },
      };
      const selected = cases[operation];
      const call = () =>
        request(app.getHttpServer())
          .post(`/api/v1${selected.path}`)
          .set('Authorization', `Bearer ${f.token}`)
          .set('x-organization-id', f.organizationId)
          .send(selected.body);
      const before = await snapshot(f.organizationId);
      const fault = jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('Synthetic mandatory audit unavailable'));
      try {
        const response = await call().expect(500);
        expect(JSON.stringify(response.body)).not.toMatch(/Synthetic|Prisma|SELECT|INSERT/);
        expect(fault).toHaveBeenCalledTimes(1);
        expect(fault.mock.calls[0]?.[0]).toMatchObject({
          action,
          organizationId: f.organizationId,
          actorUserId: f.user.id,
        });
        expect(fault.mock.calls[0]?.[1]).toBeDefined();
        expect(await snapshot(f.organizationId)).toEqual(before);
      } finally {
        fault.mockRestore();
      }

      const response = await call().expect(201);
      const after = await snapshot(f.organizationId);
      const events = after.audit.filter((row) => row.action === action);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        entityId: response.body.id,
        actorUserId: f.user.id,
        organizationId: f.organizationId,
      });
      expect(after.audit).toHaveLength(before.audit.length + 1);
      expect(after.incidents).toEqual(before.incidents);
      expect(after.catalog.length - before.catalog.length).toBe(operation === 'catalog' ? 1 : 0);
      expect(after.positions.length - before.positions.length).toBe(
        operation === 'position' ? 1 : 0,
      );
      expect(after.requirements.length - before.requirements.length).toBe(
        operation === 'requirement' ? 1 : 0,
      );
      expect(after.issues.length - before.issues.length).toBe(
        ['delivery', 'replacement'].includes(operation) ? 1 : 0,
      );
      expect(after.inspections.length - before.inspections.length).toBe(
        operation === 'condition' ? 1 : 0,
      );
      expect(after.incidentLinks.length).toBe(operation === 'replacement' ? 1 : 0);
      if (operation === 'delivery') {
        expect(after.requirements.find((row) => row.id === requirement.id)).toMatchObject({
          status: 'FULFILLED',
          version: 2,
        });
        expect(after.issues.filter((row) => row.requirementId === requirement.id)).toHaveLength(1);
      }
      if (operation === 'acknowledgement')
        expect(response.body).toMatchObject({
          status: 'IN_SERVICE',
          acknowledgementStatus: 'RECORDED',
          version: 2,
        });
      if (operation === 'condition')
        expect(response.body).toMatchObject({ status: 'REPLACEMENT_DUE', version: 2 });
      if (operation === 'replacement') {
        expect(after.issues.find((row) => row.id === issue.id)).toMatchObject({
          status: 'REPLACED',
          version: 2,
        });
        expect(response.body).toMatchObject({
          replacesIssueId: issue.id,
          status: 'ISSUED',
          acknowledgementStatus: 'PENDING',
          replacementReason: 'DAMAGE',
          version: 1,
        });
        expect(after.incidentLinks[0]).toMatchObject({
          incidentId: incident.id,
          ppeIssueId: issue.id,
        });
      }
    },
  );
});
