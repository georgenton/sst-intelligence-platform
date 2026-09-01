import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isDemoActive,
  isModuleAccessActive,
  isWorkPermitsDemoPreviewActive,
  parseEntitlement,
  WORKFORCE_PREVIEW_FEATURE_KEYS,
  WORK_PERMITS_FEATURE_KEY,
} from './entitlement';

const MODULE_FEATURES: Record<string, string> = {
  INSPECTIONS_INTELLIGENCE: 'module.inspections',
  TECHNICAL_RISK: 'module.technical_risk',
  WORK_PERMITS: WORK_PERMITS_FEATURE_KEY,
  PSYCHOSOCIAL: 'module.psychosocial',
  COMPLIANCE: 'module.compliance',
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async effective(organizationId: string) {
    const now = new Date();
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        status: true,
        demoExpiresAt: true,
        subscriptions: {
          where: {
            OR: [
              { status: 'ACTIVE', OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
              { status: 'TRIALING', endsAt: { gt: now } },
            ],
          },
          orderBy: { startsAt: 'desc' },
          take: 1,
          select: {
            plan: {
              select: {
                key: true,
                name: true,
                planFeatures: { select: { value: true, feature: { select: { key: true } } } },
              },
            },
          },
        },
        modules: {
          where: { status: { in: ['ACTIVE', 'TRIAL', 'DEMO'] } },
          select: { status: true, expiresAt: true, module: { select: { key: true } } },
        },
      },
    });
    const plan = organization.subscriptions[0]?.plan;
    const features = Object.fromEntries(
      (plan?.planFeatures ?? []).map(({ feature, value }) => [
        feature.key,
        parseEntitlement(value),
      ]),
    ) as Record<string, boolean | number | string>;
    for (const organizationModule of organization.modules) {
      const feature = MODULE_FEATURES[organizationModule.module.key];
      const active = isModuleAccessActive(
        organizationModule.status,
        organizationModule.expiresAt,
        now,
      );
      if (feature && active) features[feature] = true;
    }
    const demoActive = isDemoActive(organization.demoExpiresAt, now);
    if (isWorkPermitsDemoPreviewActive(organization.status, organization.demoExpiresAt, now)) {
      features[WORK_PERMITS_FEATURE_KEY] = true;
    }
    if (demoActive) {
      for (const featureKey of WORKFORCE_PREVIEW_FEATURE_KEYS) features[featureKey] = true;
    }
    return {
      plan: plan ? { key: plan.key, name: plan.name } : { key: 'FREE', name: 'Free' },
      features,
      demoActive,
      demoExpiresAt: organization.demoExpiresAt,
    };
  }

  async require(organizationId: string, featureKey: string) {
    const entitlements = await this.effective(organizationId);
    if (entitlements.features[featureKey] !== true) {
      throw new ForbiddenException({
        code: 'ENTITLEMENT_REQUIRED',
        message: 'Este módulo no está disponible en el plan actual.',
        details: { featureKey },
      });
    }
    return entitlements;
  }

  async requireCapacity(organizationId: string, featureKey: string, currentUsage: number) {
    const entitlements = await this.effective(organizationId);
    const limit = entitlements.features[featureKey];
    if (typeof limit !== 'number' || currentUsage >= limit) {
      throw new ForbiddenException({
        code: 'LIMIT_REACHED',
        message: 'La organización alcanzó el límite disponible en su plan.',
        details: { featureKey, currentUsage, limit: typeof limit === 'number' ? limit : null },
      });
    }
    return { limit, currentUsage };
  }
}
