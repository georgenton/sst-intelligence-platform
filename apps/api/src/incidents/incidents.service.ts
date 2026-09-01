import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertIncidentActionTransition,
  assertIncidentTransition,
  incidentClosureEligibility,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AddIncidentWorkerDto,
  CompleteIncidentInvestigationDto,
  CreateIncidentActionDto,
  CreateIncidentDto,
  CreateIncidentEvidenceDto,
  CreateIncidentFactorDto,
  IncidentQueryDto,
  StartIncidentInvestigationDto,
  TransitionIncidentActionDto,
  TransitionIncidentDto,
  VerifyIncidentActionDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const incidentInclude = {
  workCenter: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, displayName: true } },
  linkedInspection: { select: { id: true, title: true } },
  linkedFinding: { select: { id: true, title: true } },
  linkedAssessment: { select: { id: true, title: true } },
  involvedWorkers: {
    select: {
      id: true,
      involvement: true,
      createdAt: true,
      worker: {
        select: {
          id: true,
          displayName: true,
          status: true,
          jobTitle: true,
          workCenter: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  investigation: {
    select: {
      id: true,
      status: true,
      summary: true,
      startedAt: true,
      completedAt: true,
      version: true,
      startedBy: { select: { id: true, displayName: true } },
      completedBy: { select: { id: true, displayName: true } },
    },
  },
  contributingFactors: {
    select: {
      id: true,
      category: true,
      description: true,
      rationale: true,
      recordedAt: true,
      recordedBy: { select: { id: true, displayName: true } },
    },
    orderBy: { recordedAt: 'asc' as const },
  },
  actions: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      verifiedAt: true,
      verificationNote: true,
      version: true,
      createdAt: true,
      owner: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, displayName: true } },
      verifiedBy: { select: { id: true, displayName: true } },
      evidence: {
        select: {
          id: true,
          type: true,
          note: true,
          externalUrl: true,
          createdAt: true,
          createdBy: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  evidence: {
    where: { scope: 'INVESTIGATION' as const },
    select: {
      id: true,
      type: true,
      note: true,
      externalUrl: true,
      createdAt: true,
      createdBy: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: IncidentQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.IncidentWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
      ...(query.workerId ? { involvedWorkers: { some: { workerId: query.workerId } } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { activityContext: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          eventType: true,
          status: true,
          occurredAt: true,
          reportedAt: true,
          version: true,
          workCenter: { select: { id: true, name: true } },
          involvedWorkers: {
            select: { worker: { select: { id: true, displayName: true } } },
          },
          _count: { select: { actions: true, contributingFactors: true } },
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async get(organizationId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, organizationId },
      include: incidentInclude,
    });
    if (!incident) throw new NotFoundException('Incidente no encontrado.');
    return incident;
  }

  async analytics(organizationId: string) {
    const [total, nearMisses, byWorkCenter, byEventType] = await Promise.all([
      this.prisma.incident.count({ where: { organizationId } }),
      this.prisma.incident.count({ where: { organizationId, eventType: 'NEAR_MISS' } }),
      this.prisma.incident.groupBy({
        by: ['workCenterId'],
        where: { organizationId },
        _count: { _all: true },
        orderBy: { _count: { workCenterId: 'desc' } },
      }),
      this.prisma.incident.groupBy({
        by: ['eventType'],
        where: { organizationId },
        _count: { _all: true },
        orderBy: { eventType: 'asc' },
      }),
    ]);
    const centers = await this.prisma.workCenter.findMany({
      where: { organizationId, id: { in: byWorkCenter.map(({ workCenterId }) => workCenterId) } },
      select: { id: true, name: true },
    });
    const centerNames = new Map(centers.map((center) => [center.id, center.name]));
    return {
      total,
      nearMisses,
      byWorkCenter: byWorkCenter.map((item) => ({
        workCenterId: item.workCenterId,
        workCenterName: centerNames.get(item.workCenterId) ?? 'Centro no disponible',
        count: item._count._all,
      })),
      byEventType: byEventType.map((item) => ({
        eventType: item.eventType,
        count: item._count._all,
      })),
    };
  }

  async create(organizationId: string, userId: string, input: CreateIncidentDto, context: Context) {
    await this.requireTenantReferences(organizationId, input);
    const incident = await this.prisma.incident.create({
      data: {
        organizationId,
        reportedByUserId: userId,
        workCenterId: input.workCenterId,
        occurredAt: new Date(input.occurredAt),
        title: input.title.trim(),
        description: input.description.trim(),
        eventType: input.eventType,
        activityContext: input.activityContext?.trim(),
        linkedInspectionId: input.linkedInspectionId,
        linkedFindingId: input.linkedFindingId,
        linkedAssessmentId: input.linkedAssessmentId,
      },
      include: incidentInclude,
    });
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_CREATED',
      incident.id,
      { eventType: incident.eventType, workCenterId: incident.workCenterId },
      context,
    );
    return incident;
  }

  async transition(
    organizationId: string,
    id: string,
    userId: string,
    input: TransitionIncidentDto,
    context: Context,
  ) {
    const current = await this.requireCurrent(organizationId, id);
    this.assertVersion(current.version, input.expectedVersion, 'INCIDENT_VERSION_CONFLICT');
    if (input.status === 'CLOSED')
      throw new BadRequestException('Usa el cierre profesional del incidente.');
    if (input.status === 'UNDER_INVESTIGATION')
      throw new BadRequestException('Inicia la investigación desde su flujo profesional.');
    try {
      assertIncidentTransition(current.status, input.status);
    } catch {
      throw new BadRequestException('La transición del incidente no está permitida.');
    }
    const result = await this.prisma.incident.updateMany({
      where: { id, organizationId, version: input.expectedVersion, status: current.status },
      data: {
        status: input.status,
        reportedAt: input.status === 'REPORTED' ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
    this.assertSingleWriter(result.count, 'INCIDENT_VERSION_CONFLICT');
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_TRANSITIONED',
      id,
      { from: current.status, to: input.status },
      context,
    );
    return this.get(organizationId, id);
  }

  async addWorker(
    organizationId: string,
    incidentId: string,
    userId: string,
    input: AddIncidentWorkerDto,
    context: Context,
  ) {
    const [incident, worker] = await Promise.all([
      this.requireCurrent(organizationId, incidentId),
      this.prisma.worker.findFirst({
        where: { id: input.workerId, organizationId },
        select: { id: true },
      }),
    ]);
    if (['CLOSED', 'CANCELLED'].includes(incident.status))
      throw new BadRequestException('No puedes cambiar personas en un incidente finalizado.');
    if (!worker) throw new BadRequestException('El trabajador no pertenece a la organización.');
    try {
      const link = await this.prisma.incidentWorker.create({
        data: {
          organizationId,
          incidentId,
          workerId: input.workerId,
          involvement: input.involvement?.trim(),
        },
        select: { id: true, workerId: true, involvement: true, createdAt: true },
      });
      await this.recordAudit(
        organizationId,
        userId,
        'INCIDENT_WORKER_LINKED',
        incidentId,
        { workerId: input.workerId },
        context,
      );
      return link;
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw new ConflictException('El trabajador ya está vinculado al incidente.');
      throw error;
    }
  }

  async startInvestigation(
    organizationId: string,
    incidentId: string,
    userId: string,
    input: StartIncidentInvestigationDto,
    context: Context,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockIncident(tx, organizationId, incidentId);
      this.assertVersion(current.version, input.expectedVersion, 'INCIDENT_VERSION_CONFLICT');
      if (current.status !== 'REPORTED')
        throw new BadRequestException('El incidente debe estar reportado antes de investigar.');
      const existing = await tx.incidentInvestigation.findUnique({
        where: { incidentId },
        select: { id: true },
      });
      if (existing) throw new ConflictException('La investigación ya fue iniciada.');
      await tx.incidentInvestigation.create({
        data: { organizationId, incidentId, startedById: userId },
      });
      const result = await tx.incident.updateMany({
        where: { id: incidentId, organizationId, version: input.expectedVersion },
        data: { status: 'UNDER_INVESTIGATION', version: { increment: 1 } },
      });
      this.assertSingleWriter(result.count, 'INCIDENT_VERSION_CONFLICT');
    });
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_INVESTIGATION_STARTED',
      incidentId,
      {},
      context,
    );
    return this.get(organizationId, incidentId);
  }

  async addFactor(
    organizationId: string,
    incidentId: string,
    userId: string,
    input: CreateIncidentFactorDto,
    context: Context,
  ) {
    const incident = await this.requireCurrent(organizationId, incidentId);
    if (!['UNDER_INVESTIGATION', 'ACTIONS_IN_PROGRESS'].includes(incident.status))
      throw new BadRequestException('Inicia la investigación antes de registrar factores.');
    const investigation = await this.prisma.incidentInvestigation.findFirst({
      where: { incidentId, organizationId, status: 'IN_PROGRESS' },
      select: { id: true },
    });
    if (!investigation) throw new BadRequestException('La investigación ya no admite factores.');
    const factor = await this.prisma.incidentContributingFactor.create({
      data: {
        organizationId,
        incidentId,
        recordedById: userId,
        category: input.category,
        description: input.description.trim(),
        rationale: input.rationale?.trim(),
      },
      select: { id: true, category: true, description: true, rationale: true, recordedAt: true },
    });
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_FACTOR_RECORDED',
      incidentId,
      { factorId: factor.id, category: factor.category },
      context,
    );
    return factor;
  }

  async completeInvestigation(
    organizationId: string,
    incidentId: string,
    userId: string,
    input: CompleteIncidentInvestigationDto,
    context: Context,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const incident = await this.lockIncident(tx, organizationId, incidentId);
      if (!['UNDER_INVESTIGATION', 'ACTIONS_IN_PROGRESS'].includes(incident.status))
        throw new BadRequestException('El incidente no tiene una investigación activa.');
      const investigation = await tx.incidentInvestigation.findFirst({
        where: { incidentId, organizationId },
        select: { id: true, status: true, version: true },
      });
      if (!investigation || investigation.status !== 'IN_PROGRESS')
        throw new BadRequestException('La investigación ya está finalizada o no existe.');
      this.assertVersion(
        investigation.version,
        input.expectedVersion,
        'INCIDENT_INVESTIGATION_VERSION_CONFLICT',
      );
      const result = await tx.incidentInvestigation.updateMany({
        where: {
          id: investigation.id,
          organizationId,
          version: input.expectedVersion,
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'COMPLETED',
          summary: input.summary.trim(),
          completedById: userId,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      this.assertSingleWriter(result.count, 'INCIDENT_INVESTIGATION_VERSION_CONFLICT');
    });
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_INVESTIGATION_COMPLETED',
      incidentId,
      {},
      context,
    );
    return this.get(organizationId, incidentId);
  }

  async createAction(
    organizationId: string,
    incidentId: string,
    userId: string,
    input: CreateIncidentActionDto,
    context: Context,
  ) {
    if (input.ownerUserId) await this.requireActiveMember(organizationId, input.ownerUserId);
    const action = await this.prisma.$transaction(async (tx) => {
      const incident = await this.lockIncident(tx, organizationId, incidentId);
      if (!['UNDER_INVESTIGATION', 'ACTIONS_IN_PROGRESS'].includes(incident.status))
        throw new BadRequestException(
          'El incidente no admite nuevas acciones en su estado actual.',
        );
      const created = await tx.incidentAction.create({
        data: {
          organizationId,
          incidentId,
          createdById: userId,
          title: input.title.trim(),
          description: input.description?.trim(),
          priority: input.priority,
          ownerUserId: input.ownerUserId,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        },
        select: { id: true, title: true, status: true, priority: true, dueAt: true, version: true },
      });
      if (incident.status === 'UNDER_INVESTIGATION') {
        await tx.incident.update({
          where: { id: incidentId },
          data: { status: 'ACTIONS_IN_PROGRESS', version: { increment: 1 } },
        });
      }
      return created;
    });
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_ACTION_CREATED',
      incidentId,
      { actionId: action.id, priority: action.priority },
      context,
    );
    return action;
  }

  async transitionAction(
    organizationId: string,
    incidentId: string,
    actionId: string,
    userId: string,
    input: TransitionIncidentActionDto,
    context: Context,
  ) {
    if (input.status === 'COMPLETED')
      throw new BadRequestException('La acción se completa mediante verificación profesional.');
    const current = await this.requireAction(organizationId, incidentId, actionId);
    this.assertVersion(current.version, input.expectedVersion, 'INCIDENT_ACTION_VERSION_CONFLICT');
    try {
      assertIncidentActionTransition(current.status, input.status);
    } catch {
      throw new BadRequestException('La transición de la acción no está permitida.');
    }
    const result = await this.prisma.incidentAction.updateMany({
      where: {
        id: actionId,
        incidentId,
        organizationId,
        version: input.expectedVersion,
        status: current.status,
      },
      data: { status: input.status, version: { increment: 1 } },
    });
    this.assertSingleWriter(result.count, 'INCIDENT_ACTION_VERSION_CONFLICT');
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_ACTION_TRANSITIONED',
      incidentId,
      { actionId, from: current.status, to: input.status },
      context,
    );
    return this.get(organizationId, incidentId);
  }

  async verifyAction(
    organizationId: string,
    incidentId: string,
    actionId: string,
    userId: string,
    input: VerifyIncidentActionDto,
    context: Context,
  ) {
    const current = await this.requireAction(organizationId, incidentId, actionId);
    this.assertVersion(current.version, input.expectedVersion, 'INCIDENT_ACTION_VERSION_CONFLICT');
    try {
      assertIncidentActionTransition(current.status, 'COMPLETED');
    } catch {
      throw new BadRequestException('La acción debe estar pendiente de verificación.');
    }
    const evidenceCount = await this.prisma.incidentEvidence.count({
      where: { organizationId, incidentId, incidentActionId: actionId, scope: 'ACTION' },
    });
    if (evidenceCount === 0)
      throw new BadRequestException('Registra evidencia antes de verificar la acción.');
    const result = await this.prisma.incidentAction.updateMany({
      where: {
        id: actionId,
        incidentId,
        organizationId,
        version: input.expectedVersion,
        status: 'PENDING_VERIFICATION',
      },
      data: {
        status: 'COMPLETED',
        verifiedById: userId,
        verifiedAt: new Date(),
        verificationNote: input.note?.trim(),
        version: { increment: 1 },
      },
    });
    this.assertSingleWriter(result.count, 'INCIDENT_ACTION_VERSION_CONFLICT');
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_ACTION_VERIFIED',
      incidentId,
      { actionId },
      context,
    );
    return this.get(organizationId, incidentId);
  }

  async addEvidence(
    organizationId: string,
    incidentId: string,
    userId: string,
    input: CreateIncidentEvidenceDto,
    context: Context,
  ) {
    await this.requireCurrent(organizationId, incidentId);
    const validContent =
      (input.type === 'NOTE' && Boolean(input.note) && !input.externalUrl) ||
      (input.type === 'EXTERNAL_LINK' && Boolean(input.externalUrl) && !input.note);
    if (!validContent) throw new BadRequestException('La evidencia requiere una nota o un enlace.');
    if (input.scope === 'ACTION') {
      if (!input.incidentActionId)
        throw new BadRequestException('Selecciona la acción asociada a esta evidencia.');
      await this.requireAction(organizationId, incidentId, input.incidentActionId);
    } else {
      if (input.incidentActionId)
        throw new BadRequestException('La evidencia de investigación no pertenece a una acción.');
      const investigation = await this.prisma.incidentInvestigation.findFirst({
        where: { incidentId, organizationId },
        select: { id: true },
      });
      if (!investigation) throw new BadRequestException('Inicia la investigación primero.');
    }
    const evidence = await this.prisma.incidentEvidence.create({
      data: {
        organizationId,
        incidentId,
        incidentActionId: input.incidentActionId,
        scope: input.scope,
        type: input.type,
        note: input.note?.trim(),
        externalUrl: input.externalUrl,
        createdById: userId,
      },
      select: { id: true, scope: true, type: true, note: true, externalUrl: true, createdAt: true },
    });
    await this.recordAudit(
      organizationId,
      userId,
      'INCIDENT_EVIDENCE_ADDED',
      incidentId,
      { evidenceId: evidence.id, scope: evidence.scope, type: evidence.type },
      context,
    );
    return evidence;
  }

  async close(
    organizationId: string,
    incidentId: string,
    userId: string,
    input: TransitionIncidentDto,
    context: Context,
  ) {
    if (input.status !== 'CLOSED')
      throw new BadRequestException('El destino de cierre no es válido.');
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockIncident(tx, organizationId, incidentId);
      this.assertVersion(current.version, input.expectedVersion, 'INCIDENT_VERSION_CONFLICT');
      try {
        assertIncidentTransition(current.status, 'CLOSED');
      } catch {
        throw new BadRequestException('El incidente no puede cerrarse desde su estado actual.');
      }
      const [investigation, actions] = await Promise.all([
        tx.incidentInvestigation.findUnique({
          where: { incidentId },
          select: { status: true },
        }),
        tx.incidentAction.findMany({
          where: { incidentId, organizationId },
          select: { status: true },
        }),
      ]);
      const eligibility = incidentClosureEligibility({
        investigationStatus: investigation?.status ?? null,
        actionStatuses: actions.map(({ status }) => status),
      });
      if (!eligibility.allowed) throw new BadRequestException(eligibility.reason);
      const result = await tx.incident.updateMany({
        where: {
          id: incidentId,
          organizationId,
          version: input.expectedVersion,
          status: current.status,
        },
        data: { status: 'CLOSED', version: { increment: 1 } },
      });
      this.assertSingleWriter(result.count, 'INCIDENT_VERSION_CONFLICT');
    });
    await this.recordAudit(organizationId, userId, 'INCIDENT_CLOSED', incidentId, {}, context);
    return this.get(organizationId, incidentId);
  }

  private async requireTenantReferences(organizationId: string, input: CreateIncidentDto) {
    const [workCenter, inspection, finding, assessment] = await Promise.all([
      this.prisma.workCenter.findFirst({
        where: { id: input.workCenterId, organizationId, isActive: true },
        select: { id: true },
      }),
      input.linkedInspectionId
        ? this.prisma.inspection.findFirst({
            where: { id: input.linkedInspectionId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedFindingId
        ? this.prisma.inspectionFinding.findFirst({
            where: { id: input.linkedFindingId, organizationId },
            select: { id: true, inspectionId: true },
          })
        : null,
      input.linkedAssessmentId
        ? this.prisma.technicalAssessment.findFirst({
            where: { id: input.linkedAssessmentId, organizationId },
            select: { id: true },
          })
        : null,
    ]);
    if (!workCenter)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización activa.');
    if (input.linkedInspectionId && !inspection)
      throw new BadRequestException('La inspección vinculada no pertenece a la organización.');
    if (input.linkedFindingId && !finding)
      throw new BadRequestException('El hallazgo vinculado no pertenece a la organización.');
    if (input.linkedAssessmentId && !assessment)
      throw new BadRequestException('La evaluación vinculada no pertenece a la organización.');
    if (input.linkedInspectionId && finding && finding.inspectionId !== input.linkedInspectionId) {
      throw new BadRequestException('El hallazgo no pertenece a la inspección vinculada.');
    }
  }

  private async requireCurrent(organizationId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, version: true },
    });
    if (!incident) throw new NotFoundException('Incidente no encontrado.');
    return incident;
  }

  private async lockIncident(
    tx: Prisma.TransactionClient,
    organizationId: string,
    incidentId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Incident"
      WHERE id = ${incidentId}::uuid AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new NotFoundException('Incidente no encontrado.');
    return tx.incident.findUniqueOrThrow({
      where: { id: incidentId },
      select: { id: true, status: true, version: true },
    });
  }

  private async requireAction(organizationId: string, incidentId: string, actionId: string) {
    const action = await this.prisma.incidentAction.findFirst({
      where: { id: actionId, incidentId, organizationId },
      select: { id: true, status: true, version: true },
    });
    if (!action) throw new NotFoundException('Acción del incidente no encontrada.');
    return action;
  }

  private async requireActiveMember(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!membership)
      throw new BadRequestException(
        'La persona responsable no pertenece a la organización activa.',
      );
  }

  private assertVersion(current: number, expected: number, code: string) {
    if (current !== expected) this.assertSingleWriter(0, code);
  }

  private assertSingleWriter(count: number, code: string) {
    if (count !== 1)
      throw new ConflictException({
        code,
        message: 'El registro cambió en otra sesión. Actualiza e intenta nuevamente.',
      });
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private recordAudit(
    organizationId: string,
    actorUserId: string,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
    context: Context,
  ) {
    return this.audit.record({
      organizationId,
      actorUserId,
      action,
      entityType: 'Incident',
      entityId,
      metadata,
      ...context,
    });
  }
}
