import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { assertWorkerDateRange } from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateWorkerDto, DeactivateWorkerDto, UpdateWorkerDto, WorkerQueryDto } from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const workerInclude = {
  workCenter: { select: { id: true, name: true } },
  linkedUser: { select: { id: true, displayName: true, email: true } },
  createdBy: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: WorkerQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.WorkerWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { internalCode: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.worker.findMany({
        where,
        include: workerInclude,
        orderBy: [{ status: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.worker.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async get(organizationId: string, id: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id, organizationId },
      include: workerInclude,
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado.');
    return worker;
  }

  async create(organizationId: string, userId: string, input: CreateWorkerDto, context: Context) {
    const startDate = input.startDate ? new Date(input.startDate) : null;
    const endDate = input.endDate ? new Date(input.endDate) : null;
    this.assertDates(startDate, endDate);
    await this.requireTenantReferences(organizationId, input.workCenterId, input.linkedUserId);
    try {
      const worker = await this.prisma.worker.create({
        data: {
          organizationId,
          createdById: userId,
          displayName: input.displayName.trim(),
          internalCode: input.internalCode?.trim(),
          workCenterId: input.workCenterId,
          jobTitle: input.jobTitle?.trim(),
          linkedUserId: input.linkedUserId,
          startDate,
          endDate,
          notes: input.notes?.trim(),
        },
        include: workerInclude,
      });
      await this.audit.record({
        organizationId,
        actorUserId: userId,
        action: 'WORKER_CREATED',
        entityType: 'Worker',
        entityId: worker.id,
        metadata: {
          workCenterId: worker.workCenterId,
          linkedUserId: worker.linkedUserId,
        },
        ...context,
      });
      return worker;
    } catch (error) {
      this.translateUniqueConflict(error);
    }
  }

  async update(
    organizationId: string,
    id: string,
    userId: string,
    input: UpdateWorkerDto,
    context: Context,
  ) {
    const current = await this.requireCurrent(organizationId, id);
    this.assertVersion(current.version, input.expectedVersion);
    const workCenterId = Object.hasOwn(input, 'workCenterId') ? input.workCenterId : undefined;
    const linkedUserId = Object.hasOwn(input, 'linkedUserId') ? input.linkedUserId : undefined;
    await this.requireTenantReferences(
      organizationId,
      workCenterId ?? undefined,
      linkedUserId ?? undefined,
    );
    const startDate = Object.hasOwn(input, 'startDate')
      ? input.startDate
        ? new Date(input.startDate)
        : null
      : current.startDate;
    const endDate = Object.hasOwn(input, 'endDate')
      ? input.endDate
        ? new Date(input.endDate)
        : null
      : current.endDate;
    this.assertDates(startDate, endDate);
    try {
      const result = await this.prisma.worker.updateMany({
        where: { id, organizationId, version: input.expectedVersion },
        data: {
          ...(Object.hasOwn(input, 'displayName')
            ? { displayName: input.displayName?.trim() }
            : {}),
          ...(Object.hasOwn(input, 'internalCode')
            ? { internalCode: input.internalCode?.trim() ?? null }
            : {}),
          ...(Object.hasOwn(input, 'workCenterId') ? { workCenterId: input.workCenterId } : {}),
          ...(Object.hasOwn(input, 'jobTitle') ? { jobTitle: input.jobTitle?.trim() ?? null } : {}),
          ...(Object.hasOwn(input, 'linkedUserId') ? { linkedUserId: input.linkedUserId } : {}),
          ...(Object.hasOwn(input, 'startDate') ? { startDate } : {}),
          ...(Object.hasOwn(input, 'endDate') ? { endDate } : {}),
          ...(Object.hasOwn(input, 'notes') ? { notes: input.notes?.trim() ?? null } : {}),
          version: { increment: 1 },
        },
      });
      this.assertSingleWriter(result.count);
    } catch (error) {
      this.translateUniqueConflict(error);
    }
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'WORKER_UPDATED',
      entityType: 'Worker',
      entityId: id,
      metadata: { previousVersion: input.expectedVersion },
      ...context,
    });
    return this.get(organizationId, id);
  }

  async deactivate(
    organizationId: string,
    id: string,
    userId: string,
    input: DeactivateWorkerDto,
    context: Context,
  ) {
    const current = await this.requireCurrent(organizationId, id);
    this.assertVersion(current.version, input.expectedVersion);
    if (current.status === 'INACTIVE')
      throw new BadRequestException('El trabajador ya está inactivo.');
    const endDate = input.endDate ? new Date(input.endDate) : new Date();
    this.assertDates(current.startDate, endDate);
    const result = await this.prisma.worker.updateMany({
      where: { id, organizationId, version: input.expectedVersion, status: 'ACTIVE' },
      data: { status: 'INACTIVE', endDate, version: { increment: 1 } },
    });
    this.assertSingleWriter(result.count);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'WORKER_DEACTIVATED',
      entityType: 'Worker',
      entityId: id,
      metadata: { endDate: endDate.toISOString() },
      ...context,
    });
    return this.get(organizationId, id);
  }

  private async requireCurrent(organizationId: string, id: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, version: true, startDate: true, endDate: true },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado.');
    return worker;
  }

  private async requireTenantReferences(
    organizationId: string,
    workCenterId?: string,
    linkedUserId?: string,
  ) {
    const [workCenter, membership] = await Promise.all([
      workCenterId
        ? this.prisma.workCenter.findFirst({
            where: { id: workCenterId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      linkedUserId
        ? this.prisma.membership.findFirst({
            where: { organizationId, userId: linkedUserId, status: 'ACTIVE' },
            select: { id: true },
          })
        : null,
    ]);
    if (workCenterId && !workCenter)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización activa.');
    if (linkedUserId && !membership)
      throw new BadRequestException(
        'La cuenta vinculada requiere una membresía activa en la organización.',
      );
  }

  private assertDates(startDate?: Date | null, endDate?: Date | null) {
    try {
      assertWorkerDateRange(startDate, endDate);
    } catch {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }
  }

  private assertVersion(current: number, expected: number) {
    if (current !== expected) this.assertSingleWriter(0);
  }

  private assertSingleWriter(count: number) {
    if (count !== 1)
      throw new ConflictException({
        code: 'WORKER_VERSION_CONFLICT',
        message: 'El trabajador cambió en otra sesión. Actualiza e intenta nuevamente.',
      });
  }

  private translateUniqueConflict(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException({
        code: 'WORKER_UNIQUE_CONFLICT',
        message: 'El código interno o la cuenta vinculada ya pertenece a otro trabajador.',
      });
    }
    throw error;
  }
}
