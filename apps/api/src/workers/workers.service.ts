import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PpeCategory, Prisma } from '@prisma/client';
import { assertWorkerDateRange, suggestPpeCategories } from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePositionDto,
  CreatePositionRiskDto,
  CreateWorkerDto,
  DeactivateWorkerDto,
  UpdateWorkerDto,
  WorkerQueryDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const workerInclude = {
  workCenter: { select: { id: true, name: true } },
  workArea: { select: { id: true, name: true, workCenterId: true } },
  position: { select: { id: true, name: true, code: true } },
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
      ...(query.workAreaId ? { workAreaId: query.workAreaId } : {}),
      ...(query.positionId ? { positionId: query.positionId } : {}),
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

  positions(organizationId: string) {
    return this.prisma.position.findMany({
      where: { organizationId },
      include: {
        riskContexts: { where: { isActive: true }, orderBy: [{ category: 'asc' }, { id: 'asc' }] },
        _count: { select: { workers: true, ppeRequirements: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  workAreas(organizationId: string) {
    return this.prisma.workArea.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, workCenterId: true },
      orderBy: [{ workCenterId: 'asc' }, { name: 'asc' }],
    });
  }

  async createPosition(
    organizationId: string,
    userId: string,
    input: CreatePositionDto,
    context: Context,
  ) {
    const position = await this.prisma.position.create({
      data: {
        organizationId,
        createdById: userId,
        name: input.name.trim(),
        code: input.code?.trim(),
        description: input.description?.trim(),
      },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'POSITION_CREATED',
      entityType: 'Position',
      entityId: position.id,
      metadata: { code: position.code },
      ...context,
    });
    return position;
  }

  async addPositionRisk(
    organizationId: string,
    positionId: string,
    userId: string,
    input: CreatePositionRiskDto,
    context: Context,
  ) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!position) throw new NotFoundException('Cargo no encontrado.');
    const risk = await this.prisma.positionRiskContext.create({
      data: {
        organizationId,
        positionId,
        category: input.category,
        description: input.description.trim(),
        provenance: input.provenance?.trim(),
        createdById: userId,
      },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'POSITION_RISK_CONTEXT_CREATED',
      entityType: 'PositionRiskContext',
      entityId: risk.id,
      metadata: { positionId, category: input.category },
      ...context,
    });
    return risk;
  }

  async positionPpeCandidates(organizationId: string, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        riskContexts: {
          where: { isActive: true },
          select: { id: true, category: true, description: true },
        },
      },
    });
    if (!position) throw new NotFoundException('Cargo no encontrado.');
    const categories = suggestPpeCategories(position.riskContexts.map((risk) => risk.category));
    const suggestions = position.riskContexts.map((risk) => ({
      risk,
      categories: suggestPpeCategories([risk.category]),
    }));
    const catalogItems = categories.length
      ? await this.prisma.ppeCatalogItem.findMany({
          where: {
            organizationId,
            status: 'ACTIVE',
            category: { in: categories as PpeCategory[] },
          },
          select: {
            id: true,
            name: true,
            category: true,
            referenceStandard: true,
            referenceJurisdiction: true,
            referenceProvenance: true,
            referenceReviewStatus: true,
          },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        })
      : [];
    return {
      position,
      categories,
      suggestions,
      catalogItems,
      decisionBoundary:
        'Sugerencias determinísticas. Un profesional autorizado debe seleccionar antes de convertirlas en requisito interno.',
    };
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
    await this.requireTenantReferences(
      organizationId,
      input.workCenterId,
      input.linkedUserId,
      input.workAreaId,
      input.positionId,
    );
    try {
      const worker = await this.prisma.worker.create({
        data: {
          organizationId,
          createdById: userId,
          displayName: input.displayName.trim(),
          internalCode: input.internalCode?.trim(),
          workCenterId: input.workCenterId,
          workAreaId: input.workAreaId,
          positionId: input.positionId,
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
    const workAreaId = Object.hasOwn(input, 'workAreaId') ? input.workAreaId : undefined;
    const positionId = Object.hasOwn(input, 'positionId') ? input.positionId : undefined;
    const nextLinkedUserId = Object.hasOwn(input, 'linkedUserId')
      ? (input.linkedUserId ?? null)
      : current.linkedUserId;
    const linkedUserChanged = nextLinkedUserId !== current.linkedUserId;
    await this.requireTenantReferences(
      organizationId,
      workCenterId ?? undefined,
      linkedUserId ?? undefined,
      workAreaId ?? undefined,
      positionId ?? undefined,
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
      await this.prisma.$transaction(
        async (transaction) => {
          const governanceMembers = linkedUserChanged
            ? await transaction.governanceMember.findMany({
                where: { organizationId, workerId: id },
                select: {
                  id: true,
                  membership: { select: { userId: true } },
                },
              })
            : [];
          for (const member of governanceMembers) {
            if (
              nextLinkedUserId &&
              member.membership &&
              member.membership.userId !== nextLinkedUserId
            ) {
              throw new ConflictException(
                'La cuenta vinculada no coincide con la identidad histórica de gobernanza.',
              );
            }
          }
          const result = await transaction.worker.updateMany({
            where: { id, organizationId, version: input.expectedVersion },
            data: {
              ...(Object.hasOwn(input, 'displayName')
                ? { displayName: input.displayName?.trim() }
                : {}),
              ...(Object.hasOwn(input, 'internalCode')
                ? { internalCode: input.internalCode?.trim() ?? null }
                : {}),
              ...(Object.hasOwn(input, 'workCenterId') ? { workCenterId: input.workCenterId } : {}),
              ...(Object.hasOwn(input, 'workAreaId') ? { workAreaId: input.workAreaId } : {}),
              ...(Object.hasOwn(input, 'positionId') ? { positionId: input.positionId } : {}),
              ...(Object.hasOwn(input, 'jobTitle')
                ? { jobTitle: input.jobTitle?.trim() ?? null }
                : {}),
              ...(Object.hasOwn(input, 'linkedUserId') ? { linkedUserId: input.linkedUserId } : {}),
              ...(Object.hasOwn(input, 'startDate') ? { startDate } : {}),
              ...(Object.hasOwn(input, 'endDate') ? { endDate } : {}),
              ...(Object.hasOwn(input, 'notes') ? { notes: input.notes?.trim() ?? null } : {}),
              version: { increment: 1 },
            },
          });
          this.assertSingleWriter(result.count);
          for (const member of governanceMembers) {
            const identityUserId = nextLinkedUserId ?? member.membership?.userId;
            await transaction.governanceMember.update({
              where: { id: member.id },
              data: { personKey: identityUserId ? `USER:${identityUserId}` : `WORKER:${id}` },
            });
          }
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (this.errorCode(error) === 'P2034') this.assertSingleWriter(0);
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
      select: {
        id: true,
        status: true,
        version: true,
        linkedUserId: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado.');
    return worker;
  }

  private async requireTenantReferences(
    organizationId: string,
    workCenterId?: string,
    linkedUserId?: string,
    workAreaId?: string,
    positionId?: string,
  ) {
    const [workCenter, membership, workArea, position] = await Promise.all([
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
      workAreaId
        ? this.prisma.workArea.findFirst({
            where: { id: workAreaId, organizationId, isActive: true },
            select: { id: true, workCenterId: true },
          })
        : null,
      positionId
        ? this.prisma.position.findFirst({
            where: { id: positionId, organizationId, isActive: true },
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
    if (workAreaId && !workArea)
      throw new BadRequestException('El área no pertenece a la organización activa.');
    if (workCenterId && workArea && workArea.workCenterId !== workCenterId)
      throw new BadRequestException('El área no pertenece al centro de trabajo seleccionado.');
    if (positionId && !position)
      throw new BadRequestException('El cargo no pertenece a la organización activa.');
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
    if (this.errorCode(error) === 'P2002') {
      throw new ConflictException({
        code: 'WORKER_UNIQUE_CONFLICT',
        message:
          'El código interno, la cuenta vinculada o la identidad de gobernanza ya está en uso.',
      });
    }
    throw error;
  }

  private errorCode(error: unknown) {
    return error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  }
}
