import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('counts active work centers while preserving the membership count', async () => {
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'org-1',
      name: 'Synthetic review organization',
      status: 'DEMO',
      demoStartedAt: null,
      demoExpiresAt: null,
      _count: { workCenters: 2, memberships: 1 },
      modules: [],
    });
    const prisma = {
      organization: { findUniqueOrThrow },
      inspectionFinding: { count: jest.fn() },
      correctiveAction: { count: jest.fn() },
      inspectionAlert: { count: jest.fn() },
    } as never;
    const entitlements = {
      effective: jest.fn().mockResolvedValue({
        plan: { key: 'FREE', name: 'Free' },
        features: { 'module.inspections': false },
        demoActive: true,
        demoExpiresAt: null,
      }),
    } as never;
    const audit = { record: jest.fn() } as never;

    const result = await new DashboardService(prisma, entitlements, audit).dashboard('org-1');

    expect(result.organization._count).toEqual({ workCenters: 2, memberships: 1 });
    expect(findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: {
            select: {
              workCenters: { where: { isActive: true } },
              memberships: true,
            },
          },
        }),
      }),
    );
  });
});
