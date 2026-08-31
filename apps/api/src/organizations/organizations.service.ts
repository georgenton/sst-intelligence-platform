import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const WORK_CENTER_LIMIT_FEATURE = 'organization.max_work_centers';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementService,
  ) {}

  list(userId: string) {
    return this.prisma.organization.findMany({
      where: { memberships: { some: { userId, status: 'ACTIVE' } } },
      select: {
        id: true,
        name: true,
        country: true,
        sector: true,
        status: true,
        demoExpiresAt: true,
        memberships: { where: { userId }, select: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    userId: string,
    input: { name: string; country: string; sector?: string },
    context: Context,
  ) {
    const freePlan = await this.prisma.plan.findUniqueOrThrow({ where: { key: 'FREE' } });
    const core = await this.prisma.moduleDefinition.findUniqueOrThrow({ where: { key: 'CORE' } });
    const organization = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: input.name.trim(),
          country: input.country.trim(),
          sector: input.sector?.trim(),
          memberships: { create: { userId, role: 'ORG_OWNER' } },
          workCenters: { create: { name: 'Centro principal' } },
          subscriptions: { create: { planId: freePlan.id } },
          modules: {
            create: { moduleId: core.id, status: 'ACTIVE', source: 'PLAN', startsAt: new Date() },
          },
        },
        select: { id: true, name: true, country: true, sector: true, status: true },
      });
      return created;
    });
    await Promise.all([
      this.audit.record({
        organizationId: organization.id,
        actorUserId: userId,
        action: 'ORGANIZATION_CREATED',
        entityType: 'Organization',
        entityId: organization.id,
        ...context,
      }),
      this.audit.record({
        organizationId: organization.id,
        actorUserId: userId,
        action: 'MEMBERSHIP_CREATED',
        entityType: 'Membership',
        entityId: organization.id,
        metadata: { role: 'ORG_OWNER' },
        ...context,
      }),
    ]);
    return organization;
  }

  get(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        country: true,
        sector: true,
        status: true,
        demoStartedAt: true,
        demoExpiresAt: true,
        workCenters: {
          select: {
            id: true,
            name: true,
            city: true,
            isDemo: true,
            isActive: true,
            workAreas: {
              where: { isActive: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });
  }

  update(organizationId: string, input: { name?: string; sector?: string }) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: input.name?.trim(), sector: input.sector?.trim() },
      select: { id: true, name: true, country: true, sector: true },
    });
  }

  workCenters(organizationId: string) {
    return this.prisma.workCenter.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        city: true,
        isActive: true,
        isDemo: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { workAreas: true, inspections: true, technicalAssessments: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async workCenter(organizationId: string, workCenterId: string) {
    const center = await this.prisma.workCenter.findFirst({
      where: { id: workCenterId, organizationId },
      select: {
        id: true,
        name: true,
        city: true,
        isActive: true,
        isDemo: true,
        createdAt: true,
        updatedAt: true,
        workAreas: {
          select: { id: true, name: true, isActive: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { inspections: true, findings: true, technicalAssessments: true } },
      },
    });
    if (!center) throw new NotFoundException('Centro de trabajo no encontrado.');
    return center;
  }

  async createWorkCenter(
    organizationId: string,
    actorUserId: string,
    input: { name: string; city?: string },
    context: Context,
  ) {
    const capacity = await this.workCenterCapacity(organizationId);
    try {
      const center = await this.prisma.$transaction(async (tx) => {
        await this.lockOrganization(tx, organizationId);
        const currentUsage = await this.activeWorkCenterUsage(
          tx,
          organizationId,
          capacity.demoActive,
        );
        this.assertWorkCenterCapacity(currentUsage, capacity.limit);
        return tx.workCenter.create({
          data: {
            organizationId,
            name: input.name.trim(),
            city: input.city?.trim(),
          },
          select: { id: true, name: true, city: true, isActive: true, createdAt: true },
        });
      });
      await this.audit.record({
        organizationId,
        actorUserId,
        action: 'WORK_CENTER_CREATED',
        entityType: 'WorkCenter',
        entityId: center.id,
        metadata: { name: center.name },
        ...context,
      });
      return center;
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw new ConflictException('Ya existe un centro de trabajo con ese nombre.');
      throw error;
    }
  }

  async updateWorkCenter(
    organizationId: string,
    workCenterId: string,
    actorUserId: string,
    input: { name?: string; city?: string; isActive?: boolean },
    context: Context,
  ) {
    const capacity = await this.workCenterCapacity(organizationId);
    try {
      const center = await this.prisma.$transaction(async (tx) => {
        await this.lockOrganization(tx, organizationId);
        const current = await tx.workCenter.findFirst({
          where: { id: workCenterId, organizationId },
          select: { id: true, isActive: true, isDemo: true },
        });
        if (!current) throw new NotFoundException('Centro de trabajo no encontrado.');
        if (
          input.isActive === true &&
          !current.isActive &&
          !(capacity.demoActive && current.isDemo)
        ) {
          const currentUsage = await this.activeWorkCenterUsage(
            tx,
            organizationId,
            capacity.demoActive,
          );
          this.assertWorkCenterCapacity(currentUsage, capacity.limit);
        }
        return tx.workCenter.update({
          where: { id: workCenterId },
          data: {
            name: input.name?.trim(),
            city: input.city?.trim(),
            isActive: input.isActive,
          },
          select: { id: true, name: true, city: true, isActive: true, updatedAt: true },
        });
      });
      await this.audit.record({
        organizationId,
        actorUserId,
        action: 'WORK_CENTER_UPDATED',
        entityType: 'WorkCenter',
        entityId: center.id,
        metadata: { name: center.name, isActive: center.isActive },
        ...context,
      });
      return center;
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw new ConflictException('Ya existe un centro de trabajo con ese nombre.');
      throw error;
    }
  }

  private async workCenterCapacity(organizationId: string) {
    const entitlements = await this.entitlements.effective(organizationId);
    const limit = entitlements.features[WORK_CENTER_LIMIT_FEATURE];
    if (typeof limit !== 'number') this.workCenterCapacityExceeded(0, null);
    return { limit, demoActive: entitlements.demoActive };
  }

  private async lockOrganization(tx: Prisma.TransactionClient, organizationId: string) {
    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM "Organization"
      WHERE id = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private activeWorkCenterUsage(
    tx: Prisma.TransactionClient,
    organizationId: string,
    demoActive: boolean,
  ) {
    return tx.workCenter.count({
      where: {
        organizationId,
        isActive: true,
        ...(demoActive ? { isDemo: false } : {}),
      },
    });
  }

  private assertWorkCenterCapacity(currentUsage: number, limit: number) {
    if (currentUsage < limit) return;
    this.workCenterCapacityExceeded(currentUsage, limit);
  }

  private workCenterCapacityExceeded(currentUsage: number, limit: number | null): never {
    throw new ForbiddenException({
      code: 'LIMIT_REACHED',
      message: 'La organización alcanzó el límite disponible en su plan.',
      details: { featureKey: WORK_CENTER_LIMIT_FEATURE, currentUsage, limit },
    });
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
