import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ObligationExecutionOriginType, Prisma } from '@prisma/client';
import {
  assertObligationExecutionTransition,
  obligationProvenanceSnapshotSchema,
  obligationReviewTargetStatus,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateObligationEvidenceDto,
  CreateObligationExecutionDto,
  ObligationExecutionQueryDto,
  ReviewObligationExecutionDto,
  TransitionObligationExecutionDto,
  UpdateObligationExecutionDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const obligationInclude = {
  workCenter: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, displayName: true, email: true } },
  createdBy: { select: { id: true, displayName: true } },
  completedBy: { select: { id: true, displayName: true } },
  reviewedBy: { select: { id: true, displayName: true } },
  requirement: {
    select: { id: true, title: true, description: true, editorialStatus: true },
  },
  regulatoryUnit: {
    select: {
      id: true,
      identifier: true,
      heading: true,
      locator: true,
      reviewStatus: true,
      sourceVersion: {
        select: {
          source: { select: { canonicalTitle: true, referenceNumber: true, issuer: true } },
        },
      },
    },
  },
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
} as const;

@Injectable()
export class OperationalExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: ObligationExecutionQueryDto) {
    const where: Prisma.ObligationExecutionWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
      ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.obligationExecution.findMany({
        where,
        include: obligationInclude,
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.obligationExecution.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async get(organizationId: string, id: string) {
    const obligation = await this.prisma.obligationExecution.findFirst({
      where: { id, organizationId },
      include: obligationInclude,
    });
    if (!obligation) throw new NotFoundException('Ejecución operativa no encontrada.');
    return obligation;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateObligationExecutionDto,
    context: Context,
  ) {
    const [workCenter, assignee, requirement, unit] = await Promise.all([
      input.workCenterId
        ? this.prisma.workCenter.findFirst({
            where: { id: input.workCenterId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.assignedToUserId
        ? this.prisma.membership.findFirst({
            where: {
              organizationId,
              userId: input.assignedToUserId,
              status: 'ACTIVE',
            },
            select: { userId: true },
          })
        : null,
      input.requirementId
        ? this.prisma.regulatoryRequirement.findUnique({
            where: { id: input.requirementId },
            select: { id: true, title: true, editorialStatus: true },
          })
        : null,
      input.regulatoryUnitId
        ? this.prisma.regulatoryUnit.findUnique({
            where: { id: input.regulatoryUnitId },
            select: { id: true, identifier: true, locator: true, normalizedTextHash: true },
          })
        : null,
    ]);
    if (input.workCenterId && !workCenter)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización activa.');
    if (input.assignedToUserId && !assignee)
      throw new BadRequestException('La persona asignada no pertenece a la organización activa.');
    if (input.requirementId && !requirement)
      throw new BadRequestException('El requisito regulatorio no existe.');
    if (input.regulatoryUnitId && !unit)
      throw new BadRequestException('La unidad regulatoria no existe.');
    this.assertOrigin(input.originType, requirement, input);

    const snapshot = obligationProvenanceSnapshotSchema.parse({
      originType: input.originType,
      capturedAt: new Date().toISOString(),
      requirement: requirement ?? null,
      regulatoryUnit: unit ?? null,
      internalReference: input.internalReference ?? null,
      manualReference: input.manualReference ?? null,
    });
    const obligation = await this.prisma.obligationExecution.create({
      data: {
        organizationId,
        createdById: userId,
        title: input.title,
        description: input.description,
        originType: input.originType,
        workCenterId: input.workCenterId,
        requirementId: input.requirementId,
        regulatoryUnitId: input.regulatoryUnitId,
        internalReference: input.internalReference,
        manualReference: input.manualReference,
        priority: input.priority,
        assignedToUserId: input.assignedToUserId,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        evidenceExpectation: input.evidenceExpectation,
        reviewRequired: input.reviewRequired,
        provenanceSnapshot: snapshot,
      },
      include: obligationInclude,
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OBLIGATION_EXECUTION_CREATED',
      entityType: 'ObligationExecution',
      entityId: obligation.id,
      metadata: { originType: obligation.originType, reviewRequired: obligation.reviewRequired },
      ...context,
    });
    return obligation;
  }

  async update(organizationId: string, id: string, input: UpdateObligationExecutionDto) {
    const current = await this.requireCurrent(organizationId, id);
    this.assertExpectedVersion(current.version, input.expectedVersion);
    if (['COMPLETED', 'CANCELLED'].includes(current.status))
      throw new BadRequestException('Una ejecución finalizada no puede editarse.');
    await this.requireTenantReferences(organizationId, input.workCenterId, input.assignedToUserId);
    const result = await this.prisma.obligationExecution.updateMany({
      where: { id, organizationId, version: input.expectedVersion },
      data: {
        title: input.title,
        description: input.description,
        workCenterId: input.workCenterId,
        priority: input.priority,
        assignedToUserId: input.assignedToUserId,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        evidenceExpectation: input.evidenceExpectation,
        reviewRequired: input.reviewRequired,
        version: { increment: 1 },
      },
    });
    this.assertSingleWriter(result.count);
    return this.get(organizationId, id);
  }

  async transition(
    organizationId: string,
    id: string,
    userId: string,
    input: TransitionObligationExecutionDto,
    context: Context,
  ) {
    const current = await this.requireCurrent(organizationId, id);
    this.assertExpectedVersion(current.version, input.expectedVersion);
    try {
      assertObligationExecutionTransition(current.status, input.status);
    } catch {
      throw new BadRequestException('La transición de estado no está permitida.');
    }
    if (input.status === 'READY_FOR_REVIEW' && !current.reviewRequired)
      throw new BadRequestException('Esta ejecución no requiere revisión profesional.');
    if (input.status === 'COMPLETED' && current.reviewRequired)
      throw new BadRequestException('La revisión profesional debe aprobar esta ejecución.');
    if (['READY_FOR_REVIEW', 'COMPLETED'].includes(input.status)) {
      await this.requireExpectedEvidence(current.id, current.evidenceExpectation);
    }
    const completed = input.status === 'COMPLETED';
    const result = await this.prisma.obligationExecution.updateMany({
      where: { id, organizationId, version: input.expectedVersion, status: current.status },
      data: {
        status: input.status,
        completedAt: completed ? new Date() : undefined,
        completedById: completed ? userId : undefined,
        version: { increment: 1 },
      },
    });
    this.assertSingleWriter(result.count);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OBLIGATION_EXECUTION_TRANSITIONED',
      entityType: 'ObligationExecution',
      entityId: id,
      metadata: { from: current.status, to: input.status },
      ...context,
    });
    return this.get(organizationId, id);
  }

  async review(
    organizationId: string,
    id: string,
    userId: string,
    input: ReviewObligationExecutionDto,
    context: Context,
  ) {
    const current = await this.requireCurrent(organizationId, id);
    this.assertExpectedVersion(current.version, input.expectedVersion);
    if (!current.reviewRequired)
      throw new BadRequestException('Esta ejecución no requiere revisión profesional.');
    let target: 'COMPLETED' | 'IN_PROGRESS';
    try {
      target = obligationReviewTargetStatus(current.status, input.decision);
    } catch {
      throw new BadRequestException('La ejecución no está lista para revisión profesional.');
    }
    await this.requireExpectedEvidence(current.id, current.evidenceExpectation);
    const approved = target === 'COMPLETED';
    const now = new Date();
    const result = await this.prisma.obligationExecution.updateMany({
      where: { id, organizationId, version: input.expectedVersion, status: 'READY_FOR_REVIEW' },
      data: {
        status: target,
        reviewedById: userId,
        reviewDecision: input.decision,
        reviewedAt: now,
        reviewComment: input.comment,
        completedById: approved ? userId : null,
        completedAt: approved ? now : null,
        version: { increment: 1 },
      },
    });
    this.assertSingleWriter(result.count);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OBLIGATION_EXECUTION_REVIEWED',
      entityType: 'ObligationExecution',
      entityId: id,
      metadata: { decision: input.decision, resultingStatus: target },
      ...context,
    });
    return this.get(organizationId, id);
  }

  async addEvidence(
    organizationId: string,
    id: string,
    userId: string,
    input: CreateObligationEvidenceDto,
    context: Context,
  ) {
    await this.requireCurrent(organizationId, id);
    const valid =
      (input.type === 'NOTE' && Boolean(input.note) && !input.externalUrl) ||
      (input.type === 'EXTERNAL_LINK' && Boolean(input.externalUrl) && !input.note);
    if (!valid) throw new BadRequestException('La evidencia debe contener una nota o un enlace.');
    const evidence = await this.prisma.obligationExecutionEvidence.create({
      data: {
        organizationId,
        obligationExecutionId: id,
        createdById: userId,
        type: input.type,
        note: input.note,
        externalUrl: input.externalUrl,
      },
      select: { id: true, type: true, note: true, externalUrl: true, createdAt: true },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OBLIGATION_EXECUTION_EVIDENCE_ADDED',
      entityType: 'ObligationExecution',
      entityId: id,
      metadata: { evidenceId: evidence.id, type: evidence.type },
      ...context,
    });
    return evidence;
  }

  private async requireCurrent(organizationId: string, id: string) {
    const current = await this.prisma.obligationExecution.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        version: true,
        reviewRequired: true,
        evidenceExpectation: true,
      },
    });
    if (!current) throw new NotFoundException('Ejecución operativa no encontrada.');
    return current;
  }

  private async requireTenantReferences(
    organizationId: string,
    workCenterId?: string,
    assignedToUserId?: string,
  ) {
    const [workCenter, membership] = await Promise.all([
      workCenterId
        ? this.prisma.workCenter.findFirst({
            where: { id: workCenterId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      assignedToUserId
        ? this.prisma.membership.findFirst({
            where: { organizationId, userId: assignedToUserId, status: 'ACTIVE' },
            select: { id: true },
          })
        : null,
    ]);
    if (workCenterId && !workCenter)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización activa.');
    if (assignedToUserId && !membership)
      throw new BadRequestException('La persona asignada no pertenece a la organización activa.');
  }

  private assertOrigin(
    originType: ObligationExecutionOriginType,
    requirement: { id: string; editorialStatus: string } | null,
    input: CreateObligationExecutionDto,
  ) {
    if (originType === 'APPROVED_REQUIREMENT') {
      if (!requirement || requirement.editorialStatus !== 'APPROVED_FOR_RULE_DRAFTING')
        throw new BadRequestException(
          'El origen aprobado requiere un requisito editorial aprobado.',
        );
      return;
    }
    if (originType === 'CANDIDATE_REQUIREMENT') {
      if (
        !requirement ||
        ['APPROVED_FOR_RULE_DRAFTING', 'REJECTED', 'SUPERSEDED'].includes(
          requirement.editorialStatus,
        )
      )
        throw new BadRequestException('El origen candidato requiere un requisito aún no aprobado.');
      return;
    }
    if (originType === 'INTERNAL_PROGRAM' && !input.internalReference)
      throw new BadRequestException('Documenta la referencia del programa interno.');
    if (originType === 'MANUAL' && !input.manualReference)
      throw new BadRequestException('Documenta la referencia manual.');
    if (requirement)
      throw new BadRequestException('Solo los orígenes regulatorios admiten un requisito.');
  }

  private async requireExpectedEvidence(id: string, expectation: string | null) {
    if (!expectation) return;
    const count = await this.prisma.obligationExecutionEvidence.count({
      where: { obligationExecutionId: id },
    });
    if (count === 0)
      throw new BadRequestException('Registra la evidencia esperada antes de finalizar.');
  }

  private assertSingleWriter(count: number) {
    if (count !== 1)
      throw new ConflictException({
        code: 'OBLIGATION_VERSION_CONFLICT',
        message:
          'La ejecución cambió en otra sesión. Actualiza la información e intenta nuevamente.',
      });
  }

  private assertExpectedVersion(currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) this.assertSingleWriter(0);
  }
}
