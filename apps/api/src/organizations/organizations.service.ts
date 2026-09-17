import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import type { AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const WORK_CENTER_LIMIT_FEATURE = 'organization.max_work_centers';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
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
    creationKey?: string,
  ) {
    if (creationKey !== undefined && !isUUID(creationKey, '4')) {
      throw new BadRequestException('La clave de reintento no es válida.');
    }
    const normalized = {
      name: input.name.trim(),
      country: input.country.trim(),
      sector: input.sector?.trim(),
    };
    const keyHash = creationKey
      ? createHash('sha256').update(`${userId}:${creationKey.toLowerCase()}`).digest('hex')
      : null;
    const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const select = { id: true, name: true, country: true, sector: true, status: true } as const;
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (keyHash) {
          await tx.$executeRaw(Prisma.sql`
            SELECT pg_advisory_xact_lock(hashtextextended(${keyHash}, 0))
          `);
          const previous = await tx.auditLog.findFirst({
            where: {
              actorUserId: userId,
              action: 'ORGANIZATION_CREATED',
              entityType: 'Organization',
              metadata: { path: ['idempotencyKeyHash'], equals: keyHash },
            },
            select: { organizationId: true, metadata: true },
          });
          if (previous) {
            const metadata = previous.metadata as Prisma.JsonObject;
            if (metadata.creationFingerprint !== fingerprint || !previous.organizationId) {
              throw new ConflictException({
                code: 'ORGANIZATION_CREATE_RETRY_CONFLICT',
                message: 'El intento anterior usó otros datos. Revisa la empresa de destino.',
              });
            }
            const existing = await tx.organization.findFirst({
              where: {
                id: previous.organizationId,
                memberships: { some: { userId, status: 'ACTIVE' } },
              },
              select,
            });
            if (!existing) {
              throw new ConflictException('La empresa del intento anterior ya no está disponible.');
            }
            return existing;
          }
        }
        const freePlan = await tx.plan.findUnique({ where: { key: 'FREE' }, select: { id: true } });
        const core = await tx.moduleDefinition.findUnique({
          where: { key: 'CORE' },
          select: { id: true },
        });
        if (!freePlan || !core) {
          throw new ServiceUnavailableException({
            code: 'ORGANIZATION_BOOTSTRAP_UNAVAILABLE',
            message: 'No pudimos crear la empresa en este momento. Intenta nuevamente.',
          });
        }
        const created = await tx.organization.create({
          data: {
            ...normalized,
            memberships: { create: { userId, role: 'ORG_OWNER' } },
            workCenters: { create: { name: 'Centro principal' } },
            subscriptions: { create: { planId: freePlan.id } },
            modules: {
              create: { moduleId: core.id, status: 'ACTIVE', source: 'PLAN', startsAt: new Date() },
            },
          },
          select,
        });
        await this.audit.record(
          {
            organizationId: created.id,
            actorUserId: userId,
            action: 'ORGANIZATION_CREATED',
            entityType: 'Organization',
            entityId: created.id,
            ...(keyHash
              ? { metadata: { idempotencyKeyHash: keyHash, creationFingerprint: fingerprint } }
              : {}),
            ...context,
          },
          tx,
        );
        await this.audit.record(
          {
            organizationId: created.id,
            actorUserId: userId,
            action: 'MEMBERSHIP_CREATED',
            entityType: 'Membership',
            entityId: created.id,
            metadata: { role: 'ORG_OWNER' },
            ...context,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error({
        event: 'organization_creation_failed',
        code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'UNEXPECTED',
      });
      throw new ServiceUnavailableException({
        code: 'ORGANIZATION_CREATE_UNAVAILABLE',
        message: 'No pudimos crear la empresa en este momento. Intenta nuevamente.',
      });
    }
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
