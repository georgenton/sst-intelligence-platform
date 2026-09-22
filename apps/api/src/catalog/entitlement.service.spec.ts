import type { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from './entitlement.service';

const plan = {
  key: 'FREE',
  name: 'Free',
  planFeatures: [
    { value: 'true', feature: { key: 'demo.enabled' } },
    { value: '14', feature: { key: 'demo.duration_days' } },
  ],
};

function organization(demoStartedAt: Date, bridgeStarts: readonly Date[], id = 'organization-1') {
  return {
    id,
    status: 'DEMO',
    demoStartedAt,
    demoExpiresAt: new Date(Date.now() + 86_400_000),
    auditLogs: bridgeStarts.map((start) => ({ metadata: { demoStartedAt: start.toISOString() } })),
    subscriptions: [{ plan }],
    modules: [],
  };
}

describe('EntitlementService lifecycle-scoped bridge marker', () => {
  it('interprets bridge and legacy cycles independently across T1, T2 and T3', async () => {
    const prisma = {
      organization: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new EntitlementService(prisma);
    const t1 = new Date('2026-09-22T10:00:00.000Z');
    const t2 = new Date('2026-09-23T10:00:00.000Z');
    const t3 = new Date('2026-09-24T10:00:00.000Z');

    prisma.organization.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce(organization(t1, [t1]))
      .mockResolvedValueOnce(organization(t2, [t1]))
      .mockResolvedValueOnce(organization(t3, [t1, t3]));

    const cycleA = await service.effective('organization-1');
    const cycleB = await service.effective('organization-1');
    const cycleC = await service.effective('organization-1');

    expect(cycleA.features['module.work_permits']).toBeUndefined();
    expect(cycleA.features['module.incidents']).toBeUndefined();
    expect(cycleB.features['module.work_permits']).toBe(true);
    expect(cycleB.features['module.incidents']).toBe(true);
    expect(cycleB.features['module.ppe']).toBe(true);
    expect(cycleB.features['module.training']).toBe(true);
    expect(cycleC.features['module.work_permits']).toBeUndefined();
    expect(cycleC.features['module.incidents']).toBeUndefined();
  });

  it('keeps effectiveMany equivalent without per-organization audit queries', async () => {
    const prisma = {
      organization: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new EntitlementService(prisma);
    const t1 = new Date('2026-09-22T10:00:00.000Z');
    const row = organization(t1, [t1]);
    prisma.organization.findMany = jest.fn().mockResolvedValue([row]);

    const result = await service.effectiveMany(['organization-1', 'organization-1']);

    expect(result.get('organization-1')?.demoActive).toBe(true);
    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
  });
});
