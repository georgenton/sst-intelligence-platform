import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  INCIDENTS_FEATURE_KEY,
  isDemoActive,
  isModuleAccessActive,
  isWorkPermitsDemoPreviewActive,
  parseEntitlement,
  PPE_FEATURE_KEY,
  TRAINING_FEATURE_KEY,
  WORKFORCE_PREVIEW_FEATURE_KEYS,
  WORK_PERMITS_FEATURE_KEY,
} from './entitlement';

export const MODULE_FEATURES: Record<string, string> = {
  INSPECTIONS_INTELLIGENCE: 'module.inspections',
  TECHNICAL_RISK: 'module.technical_risk',
  WORK_PERMITS: WORK_PERMITS_FEATURE_KEY,
  INCIDENTS: INCIDENTS_FEATURE_KEY,
  PPE: PPE_FEATURE_KEY,
  TRAINING: TRAINING_FEATURE_KEY,
  PSYCHOSOCIAL: 'module.psychosocial',
  COMPLIANCE: 'module.compliance',
};

function isExplicitCapabilitySelection(source: string, metadata: unknown) {
  if (source !== 'RECOMMENDATION' || typeof metadata !== 'object' || metadata === null)
    return false;
  const record = metadata as Record<string, unknown>;
  return typeof record.assessmentId === 'string' && record.accessType === 'DEMO';
}

type EffectiveEntitlementSource = {
  id: string;
  status: string;
  demoExpiresAt: Date | null;
  subscriptions: Array<{
    plan: {
      key: string;
      name: string;
      planFeatures: Array<{ value: string; feature: { key: string } }>;
    };
  }>;
  modules: Array<{
    status: string;
    source: string;
    expiresAt: Date | null;
    metadata: unknown;
    module: { key: string };
  }>;
};

export type EffectiveEntitlements = {
  plan: { key: string; name: string };
  features: Record<string, boolean | number | string>;
  demoActive: boolean;
  demoExpiresAt: Date | null;
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async effective(organizationId: string): Promise<EffectiveEntitlements> {
    const now = new Date();
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
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
          select: {
            status: true,
            source: true,
            expiresAt: true,
            metadata: true,
            module: { select: { key: true } },
          },
        },
      },
    });
    return this.resolveEffective(organization, now);
  }

  async effectiveMany(
    organizationIds: readonly string[],
  ): Promise<Map<string, EffectiveEntitlements>> {
    const ids = [...new Set(organizationIds)];
    if (!ids.length) return new Map();
    const now = new Date();
    const organizations = await this.prisma.organization.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
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
          select: {
            status: true,
            source: true,
            expiresAt: true,
            metadata: true,
            module: { select: { key: true } },
          },
        },
      },
    });
    return new Map(
      organizations.map((organization) => [
        organization.id,
        this.resolveEffective(organization, now),
      ]),
    );
  }

  private resolveEffective(
    organization: EffectiveEntitlementSource,
    now: Date,
  ): EffectiveEntitlements {
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
    // Before explicit capability provenance existed, active demo organizations
    // received the three workforce preview capabilities as a compatibility
    // fallback. Legacy rows and explicit bridge metadata keep that behavior
    // distinguishable from a partial human selection.
    const hasExplicitCapabilitySelection = organization.modules.some(({ metadata, source }) =>
      isExplicitCapabilitySelection(source, metadata),
    );
    if (demoActive && !hasExplicitCapabilitySelection) {
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
