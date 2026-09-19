import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PpeCondition, PpeIssueStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PpeService } from '../src/ppe/ppe.service';
import { WorkQueueService } from '../src/work-queue/work-queue.service';
import { ppeContinuityFixture } from './support/ppe-continuity-fixture';

describe('EPP complete canonical Work Queue', () => {
  let app: INestApplication;
  let queue: WorkQueueService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    queue = app.get(WorkQueueService);
  });
  afterAll(async () => app.close());

  it('retains old reviews and all 500+ replacements, with page-independent totals and mixed modules', async () => {
    const f = await ppeContinuityFixture(app);
    const now = new Date();
    const old = new Date(now.getTime() - 86_400_000);
    const base = {
      organizationId: f.organizationId,
      workerId: f.worker.id,
      ppeCatalogItemId: f.item.id,
      issuedAt: old,
      issuedById: f.user.id,
    };
    const review = await f.prisma.ppeIssue.create({
      data: {
        ...base,
        createdAt: old,
        inspections: {
          create: {
            organizationId: f.organizationId,
            inspectedAt: old,
            condition: 'REVIEW_REQUIRED',
            recordedById: f.user.id,
          },
        },
      },
      include: { inspections: true },
    });
    const recent = Array.from({ length: 60 }, () => ({
      ...base,
      id: randomUUID(),
      createdAt: now,
    }));
    await f.prisma.ppeIssue.createMany({ data: recent });
    await f.prisma.ppeInspection.createMany({
      data: recent.map((issue) => ({
        organizationId: f.organizationId,
        issueId: issue.id,
        inspectedAt: now,
        condition: 'SERVICEABLE',
        recordedById: f.user.id,
      })),
    });
    for (const pageSize of [1, 20, 50, 100]) {
      const page = await queue.list(f.organizationId, { module: 'PPE', page: 1, pageSize });
      expect(page.total).toBe(1);
      expect(page.items[0]).toMatchObject({
        type: 'PPE_CONDITION_REVIEW',
        sourceId: review.inspections[0]!.id,
        deepLink: `/app/workers/${f.worker.id}#epp-issue-${review.id}`,
      });
    }

    const replacements = Array.from({ length: 515 }, (_, i) => ({
      ...base,
      id: randomUUID(),
      createdAt: now,
      status: (i % 2 ? 'ISSUED' : 'REPLACEMENT_DUE') as PpeIssueStatus,
      expectedReplacementAt: i % 2 ? old : null,
    }));
    await f.prisma.ppeIssue.createMany({ data: replacements });
    for (const status of ['REPLACED', 'RETIRED'] as const) {
      await f.prisma.ppeIssue.create({
        data: {
          ...base,
          status,
          expectedReplacementAt: old,
          inspections: {
            create: {
              organizationId: f.organizationId,
              inspectedAt: now,
              condition: 'REVIEW_REQUIRED',
              recordedById: f.user.id,
            },
          },
        },
      });
    }
    // A different existing queue source also exceeds pageSize=1. The canonical
    // total cannot vary merely because its per-source prefix changed.
    await f.prisma.safetyObservation.createMany({
      data: Array.from({ length: 7 }, (_, i) => ({
        organizationId: f.organizationId,
        title: `Observación sintética ${i}`,
        description: 'Prueba mixta de paginación',
        category: 'UNSAFE_CONDITION',
        workCenterId: f.center.id,
        observedAt: now,
        reportedById: f.user.id,
      })),
    });
    for (const pageSize of [1, 20, 50, 100]) {
      expect((await queue.list(f.organizationId, { module: 'PPE', page: 1, pageSize })).total).toBe(
        516,
      );
      expect((await queue.list(f.organizationId, { page: 1, pageSize })).total).toBe(523);
      expect(
        (
          await queue.list(f.organizationId, {
            module: 'PPE',
            status: 'REPLACEMENT_DUE',
            page: 1,
            pageSize,
          })
        ).total,
      ).toBe(515);
      expect(
        (
          await queue.list(f.organizationId, {
            module: 'PPE',
            status: 'REVIEW_REQUIRED',
            page: 1,
            pageSize,
          })
        ).total,
      ).toBe(1);
    }
    const ids: string[] = [];
    for (let page = 1; page <= 6; page++) {
      const result = await queue.list(f.organizationId, { module: 'PPE', page, pageSize: 100 });
      expect(result.total).toBe(516);
      ids.push(...result.items.map((item) => `${item.type}:${item.sourceId}`));
    }
    expect(new Set(ids).size).toBe(516);
    expect(ids).toContain(`PPE_CONDITION_REVIEW:${review.inspections[0]!.id}`);
    expect(replacements.every((item) => ids.includes(`PPE_REPLACEMENT_DUE:${item.id}`))).toBe(true);
    expect(
      (await queue.list(f.organizationId, { module: 'PPE', page: 7, pageSize: 100 })).items,
    ).toEqual([]);
    const firstTwenty = await queue.list(f.organizationId, {
      module: 'PPE',
      page: 1,
      pageSize: 20,
    });
    expect(firstTwenty.items.map((item) => `${item.type}:${item.sourceId}`)).toEqual(
      ids.slice(0, 20),
    );

    expect(
      (
        await queue.list(f.organizationId, {
          module: 'PPE',
          workCenterId: f.center.id,
          page: 1,
          pageSize: 1,
        })
      ).total,
    ).toBe(516);
    expect(
      (
        await queue.list(f.organizationId, {
          module: 'PPE',
          workCenterId: randomUUID(),
          page: 1,
          pageSize: 100,
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await queue.list(f.organizationId, {
          module: 'PPE',
          priority: 'LOW',
          page: 1,
          pageSize: 100,
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await queue.list(f.organizationId, {
          module: 'PPE',
          assignedToUserId: f.user.id,
          page: 1,
          pageSize: 100,
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await queue.list(f.organizationId, {
          module: 'PPE',
          dueTo: now.toISOString(),
          page: 1,
          pageSize: 1,
        })
      ).total,
    ).toBe(257);
    const dated = replacements[1]!;
    expect(await f.prisma.ppeIssue.findUniqueOrThrow({ where: { id: dated.id } })).toMatchObject({
      status: 'ISSUED',
      version: 1,
    });
    await expect(
      app
        .get(PpeService)
        .replace(
          f.organizationId,
          dated.id,
          f.user.id,
          { expectedVersion: 1, reason: 'EXPIRY', issuedAt: now.toISOString() },
          { requestId: randomUUID() },
        ),
    ).rejects.toThrow('El elemento debe requerir reemplazo');

    await app
      .get(PpeService)
      .inspect(
        f.organizationId,
        review.id,
        f.user.id,
        { expectedVersion: 1, inspectedAt: now.toISOString(), condition: 'SERVICEABLE' },
        { requestId: randomUUID() },
      );
    expect(
      (
        await queue.list(f.organizationId, {
          module: 'PPE',
          status: 'REVIEW_REQUIRED',
          page: 1,
          pageSize: 1,
        })
      ).total,
    ).toBe(0);
    const replacement = await app
      .get(PpeService)
      .replace(
        f.organizationId,
        replacements[0]!.id,
        f.user.id,
        { expectedVersion: 1, reason: 'WEAR', issuedAt: now.toISOString() },
        { requestId: randomUUID() },
      );
    expect(replacement.status).toBe('ISSUED');
    expect(
      (await queue.list(f.organizationId, { module: 'PPE', page: 1, pageSize: 1 })).total,
    ).toBe(514);
    const foreign = await ppeContinuityFixture(app);
    expect(
      (await queue.list(foreign.organizationId, { module: 'PPE', page: 1, pageSize: 100 })).total,
    ).toBe(0);
    await f.prisma.organization.update({
      where: { id: f.organizationId },
      data: { demoExpiresAt: null },
    });
    expect(
      (await queue.list(f.organizationId, { module: 'PPE', page: 1, pageSize: 100 })).total,
    ).toBe(0);
  });

  it('uses the same deterministic latest inspection for equal observation times in queue and worker workspace', async () => {
    const f = await ppeContinuityFixture(app);
    const time = new Date('2026-01-01T10:00:00Z');
    const issue = await f.prisma.ppeIssue.create({
      data: {
        organizationId: f.organizationId,
        workerId: f.worker.id,
        ppeCatalogItemId: f.item.id,
        issuedAt: time,
        issuedById: f.user.id,
      },
    });
    const record = (id: string, condition: PpeCondition, createdAt: Date) =>
      f.prisma.ppeInspection.create({
        data: {
          id,
          organizationId: f.organizationId,
          issueId: issue.id,
          inspectedAt: time,
          condition,
          createdAt,
          recordedById: f.user.id,
        },
      });
    const tiedIds = [randomUUID(), randomUUID()].sort();
    await record(tiedIds[0]!, 'REVIEW_REQUIRED', time);
    await record(tiedIds[1]!, 'SERVICEABLE', time);
    expect(
      (await queue.list(f.organizationId, { module: 'PPE', page: 1, pageSize: 1 })).total,
    ).toBe(0);
    const latest = await record(randomUUID(), 'REVIEW_REQUIRED', new Date(time.getTime() + 1000));
    const page = await queue.list(f.organizationId, { module: 'PPE', page: 1, pageSize: 1 });
    expect(page.total).toBe(1);
    expect(page.items[0]?.sourceId).toBe(latest.id);
    expect(
      (await app.get(PpeService).workerWorkspace(f.organizationId, f.worker.id)).issues[0]
        ?.inspections[0]?.id,
    ).toBe(latest.id);
  });
});
