import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PpeService } from '../src/ppe/ppe.service';
import { ppeContinuityFixture } from './support/ppe-continuity-fixture';

describe('PPE complete aggregate', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
  });
  afterAll(async () => app.close());

  it('aggregates current, required, historical and condition quantities without a page prefix', async () => {
    const fixture = await ppeContinuityFixture(app);
    const now = new Date();
    const old = new Date(now.getTime() - 86_400_000);
    await fixture.prisma.workerPpeRequirement.create({
      data: {
        organizationId: fixture.organizationId,
        workerId: fixture.worker.id,
        ppeCatalogItemId: fixture.item.id,
        workCenterId: fixture.center.id,
        reason: 'Requisito sintético de agregado',
        assignedById: fixture.user.id,
      },
    });
    await fixture.prisma.ppeIssue.create({
      data: {
        organizationId: fixture.organizationId,
        workerId: fixture.worker.id,
        ppeCatalogItemId: fixture.item.id,
        issuedAt: now,
        issuedById: fixture.user.id,
        quantity: 2,
        status: 'IN_SERVICE',
        inspections: {
          create: {
            organizationId: fixture.organizationId,
            inspectedAt: now,
            condition: 'REVIEW_REQUIRED',
            recordedById: fixture.user.id,
          },
        },
      },
    });
    await fixture.prisma.ppeIssue.create({
      data: {
        organizationId: fixture.organizationId,
        workerId: fixture.worker.id,
        ppeCatalogItemId: fixture.item.id,
        issuedAt: old,
        issuedById: fixture.user.id,
        quantity: 3,
        status: 'REPLACED',
      },
    });
    const service = app.get(PpeService);
    const result = await service.aggregate(fixture.organizationId, {});
    expect(result.complete).toBe(true);
    expect(result.totals).toMatchObject({
      groupCount: 1,
      requiredQuantity: 1,
      currentQuantity: 2,
      replacementDueQuantity: 0,
      reviewRequiredQuantity: 2,
      historicalQuantity: 3,
    });
    expect(result.groups[0]).toMatchObject({
      key: `${fixture.item.id}:${fixture.center.id}`,
      workCenter: { id: fixture.center.id },
      currentIssueCount: 1,
      historicalIssueCount: 1,
    });
    expect(result.unavailable).toEqual({
      stock: 'NOT_REGISTERED',
      certifiedExpiry: 'NOT_REGISTERED',
    });
    const filtered = await service.aggregate(fixture.organizationId, { from: now.toISOString() });
    expect(filtered.totals.currentQuantity).toBe(2);
    expect(filtered.totals.historicalQuantity).toBe(0);
    expect((await service.aggregate(randomUUID(), {})).totals.groupCount).toBe(0);
  });
});
