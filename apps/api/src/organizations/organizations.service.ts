import { randomBytes, createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MembershipRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

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
    const current = await this.prisma.workCenter.count({ where: { organizationId } });
    await this.entitlements.requireCapacity(
      organizationId,
      'organization.max_work_centers',
      current,
    );
    try {
      const center = await this.prisma.workCenter.create({
        data: {
          organizationId,
          name: input.name.trim(),
          city: input.city?.trim(),
        },
        select: { id: true, name: true, city: true, isActive: true, createdAt: true },
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
    await this.workCenter(organizationId, workCenterId);
    try {
      const center = await this.prisma.workCenter.update({
        where: { id: workCenterId },
        data: {
          name: input.name?.trim(),
          city: input.city?.trim(),
          isActive: input.isActive,
        },
        select: { id: true, name: true, city: true, isActive: true, updatedAt: true },
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

  members(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(
    organizationId: string,
    actorUserId: string,
    input: { email: string; role: MembershipRole },
    context: Context,
  ) {
    if (input.role === 'ORG_OWNER')
      throw new ForbiddenException('La propiedad de la organización requiere un flujo dedicado.');
    const [members, pendingInvitations] = await Promise.all([
      this.prisma.membership.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.organizationInvitation.count({
        where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);
    await this.entitlements.requireCapacity(
      organizationId,
      'organization.max_members',
      members + pendingInvitations,
    );
    const rawToken = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.organizationInvitation.upsert({
      where: { organizationId_email: { organizationId, email: input.email.toLowerCase() } },
      update: {
        role: input.role,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        acceptedAt: null,
      },
      create: {
        organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    await this.audit.record({
      organizationId,
      actorUserId,
      action: 'MEMBERSHIP_INVITED',
      entityType: 'OrganizationInvitation',
      entityId: invitation.id,
      metadata: { delivery: 'CONSOLE_DEVELOPMENT_PROVIDER' },
      ...context,
    });
    return { ...invitation, delivery: 'CONSOLE_DEVELOPMENT_PROVIDER' as const };
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
