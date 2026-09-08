import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { assertSafetyObservationTransition } from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AddSafetyObservationEvidenceDto,
  CreateSafetyObservationDto,
  LinkSafetyObservationActionDto,
  SafetyObservationQueryDto,
  TransitionSafetyObservationDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const observationInclude = {
  workCenter: { select: { id: true, name: true } },
  workArea: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, displayName: true } },
  assignedTo: { select: { id: true, displayName: true } },
  resolvedBy: { select: { id: true, displayName: true } },
  linkedIncident: { select: { id: true, title: true, status: true } },
  linkedFinding: { select: { id: true, title: true, inspectionId: true } },
  evidence: {
    select: { id: true, type: true, note: true, externalUrl: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
  },
  actionLinks: {
    select: {
      id: true,
      obligationExecution: {
        select: { id: true, title: true, status: true, priority: true, dueAt: true },
      },
    },
  },
} as const;

@Injectable()
export class SafetyObservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: SafetyObservationQueryDto) {
    const where: Prisma.SafetyObservationWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.safetyObservation.findMany({
        where,
        include: observationInclude,
        orderBy: [{ observedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.safetyObservation.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(organizationId: string, id: string) {
    const observation = await this.prisma.safetyObservation.findFirst({
      where: { id, organizationId },
      include: observationInclude,
    });
    if (!observation) throw new NotFoundException('Observación de seguridad no encontrada.');
    return observation;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateSafetyObservationDto,
    context: Context,
  ) {
    await this.requireReferences(organizationId, input);
    const observation = await this.prisma.safetyObservation.create({
      data: {
        organizationId,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        workCenterId: input.workCenterId,
        workAreaId: input.workAreaId,
        observedAt: new Date(input.observedAt),
        reportedById: userId,
        priority: input.priority,
        assignedToUserId: input.assignedToUserId,
        linkedIncidentId: input.linkedIncidentId,
        linkedFindingId: input.linkedFindingId,
      },
      include: observationInclude,
    });
    await this.record(
      organizationId,
      userId,
      'SAFETY_OBSERVATION_CREATED',
      observation.id,
      {},
      context,
    );
    return observation;
  }

  async transition(
    organizationId: string,
    id: string,
    userId: string,
    input: TransitionSafetyObservationDto,
    context: Context,
  ) {
    const current = await this.prisma.safetyObservation.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, version: true },
    });
    if (!current) throw new NotFoundException('Observación de seguridad no encontrada.');
    if (current.version !== input.expectedVersion) this.versionConflict();
    try {
      assertSafetyObservationTransition(current.status, input.status);
    } catch {
      throw new BadRequestException('La transición de la observación no está permitida.');
    }
    const terminal = ['RESOLVED', 'CLOSED_NO_ACTION'].includes(input.status);
    if (terminal && !input.resolutionNote?.trim())
      throw new BadRequestException('La resolución profesional requiere una nota.');
    const result = await this.prisma.safetyObservation.updateMany({
      where: { id, organizationId, version: input.expectedVersion, status: current.status },
      data: {
        status: input.status,
        resolutionNote: terminal ? input.resolutionNote?.trim() : undefined,
        resolvedById: terminal ? userId : undefined,
        resolvedAt: terminal ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) this.versionConflict();
    await this.record(
      organizationId,
      userId,
      'SAFETY_OBSERVATION_TRANSITIONED',
      id,
      { from: current.status, to: input.status },
      context,
    );
    return this.get(organizationId, id);
  }

  async addEvidence(
    organizationId: string,
    id: string,
    userId: string,
    input: AddSafetyObservationEvidenceDto,
    context: Context,
  ) {
    const observation = await this.prisma.safetyObservation.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true },
    });
    if (!observation) throw new NotFoundException('Observación de seguridad no encontrada.');
    if (['RESOLVED', 'CLOSED_NO_ACTION'].includes(observation.status))
      throw new BadRequestException('La observación finalizada no admite nueva evidencia.');
    if ((input.type === 'NOTE') === Boolean(input.externalUrl))
      throw new BadRequestException('Registra una nota o un enlace HTTPS según el tipo elegido.');
    const evidence = await this.prisma.safetyObservationEvidence.create({
      data: {
        organizationId,
        safetyObservationId: id,
        type: input.type,
        note: input.note?.trim(),
        externalUrl: input.externalUrl,
        createdById: userId,
      },
    });
    await this.record(
      organizationId,
      userId,
      'SAFETY_OBSERVATION_EVIDENCE_ADDED',
      id,
      { evidenceId: evidence.id },
      context,
    );
    return evidence;
  }

  async linkAction(
    organizationId: string,
    id: string,
    userId: string,
    input: LinkSafetyObservationActionDto,
    context: Context,
  ) {
    const [observation, action] = await Promise.all([
      this.prisma.safetyObservation.findFirst({
        where: { id, organizationId },
        select: { id: true },
      }),
      this.prisma.obligationExecution.findFirst({
        where: { id: input.obligationExecutionId, organizationId },
        select: { id: true },
      }),
    ]);
    if (!observation) throw new NotFoundException('Observación de seguridad no encontrada.');
    if (!action) throw new BadRequestException('La acción no pertenece a la organización.');
    try {
      const link = await this.prisma.safetyObservationActionLink.create({
        data: { organizationId, safetyObservationId: id, obligationExecutionId: action.id },
      });
      await this.record(
        organizationId,
        userId,
        'SAFETY_OBSERVATION_ACTION_LINKED',
        id,
        { obligationExecutionId: action.id },
        context,
      );
      return link;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        throw new ConflictException('La acción ya está vinculada.');
      throw error;
    }
  }

  private async requireReferences(organizationId: string, input: CreateSafetyObservationDto) {
    const [center, area, member, incident, finding] = await Promise.all([
      this.prisma.workCenter.findFirst({
        where: { id: input.workCenterId, organizationId, isActive: true },
        select: { id: true },
      }),
      input.workAreaId
        ? this.prisma.workArea.findFirst({
            where: { id: input.workAreaId, organizationId, isActive: true },
            select: { id: true, workCenterId: true },
          })
        : null,
      input.assignedToUserId
        ? this.prisma.membership.findFirst({
            where: { organizationId, userId: input.assignedToUserId, status: 'ACTIVE' },
            select: { id: true },
          })
        : null,
      input.linkedIncidentId
        ? this.prisma.incident.findFirst({
            where: { id: input.linkedIncidentId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedFindingId
        ? this.prisma.inspectionFinding.findFirst({
            where: { id: input.linkedFindingId, organizationId },
            select: { id: true },
          })
        : null,
    ]);
    if (!center) throw new BadRequestException('El centro no pertenece a la organización.');
    if (input.workAreaId && !area)
      throw new BadRequestException('El área no pertenece a la organización.');
    if (area && area.workCenterId !== input.workCenterId)
      throw new BadRequestException('El área no pertenece al centro seleccionado.');
    if (input.assignedToUserId && !member)
      throw new BadRequestException('La persona asignada no tiene membresía activa.');
    if (input.linkedIncidentId && !incident)
      throw new BadRequestException('El incidente no pertenece a la organización.');
    if (input.linkedFindingId && !finding)
      throw new BadRequestException('El hallazgo no pertenece a la organización.');
  }

  private versionConflict(): never {
    throw new ConflictException({
      code: 'SAFETY_OBSERVATION_VERSION_CONFLICT',
      message: 'La observación cambió en otra sesión. Actualiza e intenta nuevamente.',
    });
  }

  private record(
    organizationId: string,
    actorUserId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
    context: Context,
  ) {
    return this.audit.record({
      organizationId,
      actorUserId,
      action,
      entityType: 'SafetyObservation',
      entityId,
      metadata: metadata as Prisma.InputJsonObject,
      ...context,
    });
  }
}
