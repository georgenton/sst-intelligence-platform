import { Injectable } from '@nestjs/common';
import type { PlanKey } from '@prisma/client';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly audit: AuditService,
  ) {}

  async dashboard(organizationId: string) {
    const [organization, effective] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          demoStartedAt: true,
          demoExpiresAt: true,
          _count: { select: { workCenters: true, memberships: true } },
          modules: {
            select: {
              status: true,
              source: true,
              startsAt: true,
              expiresAt: true,
              metadata: true,
              module: {
                select: {
                  key: true,
                  name: true,
                  description: true,
                  objective: true,
                  demoContent: true,
                },
              },
            },
            orderBy: { module: { sortOrder: 'asc' } },
          },
        },
      }),
      this.entitlements.effective(organizationId),
    ]);
    const inspections =
      effective.features['module.inspections'] === true
        ? await Promise.all([
            this.prisma.inspectionFinding.count({
              where: { organizationId, status: { not: 'CLOSED' } },
            }),
            this.prisma.inspectionFinding.count({
              where: { organizationId, initialRiskLevel: { in: ['HIGH', 'CRITICAL'] } },
            }),
            this.prisma.correctiveAction.count({
              where: {
                organizationId,
                dueAt: { lt: new Date() },
                status: { notIn: ['COMPLETED', 'CANCELED'] },
              },
            }),
            this.prisma.inspectionAlert.count({
              where: { organizationId, type: 'RECURRENCE', status: { not: 'RESOLVED' } },
            }),
          ]).then(([openFindings, highCriticalFindings, overdueActions, recurrences]) => ({
            openFindings,
            highCriticalFindings,
            overdueActions,
            recurrences,
          }))
        : null;
    return { organization, entitlements: effective, inspections };
  }

  async requestUpgrade(
    organizationId: string,
    userId: string,
    input: { requestedPlan?: PlanKey; message?: string },
    context: Context,
  ) {
    const request = await this.prisma.upgradeRequest.create({
      data: { organizationId, requestedById: userId, ...input },
      select: { id: true, status: true, requestedPlan: true, createdAt: true },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'UPGRADE_REQUESTED',
      entityType: 'UpgradeRequest',
      entityId: request.id,
      metadata: { requestedPlan: input.requestedPlan ?? null },
      ...context,
    });
    return request;
  }
}
