import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  HttpException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildDeterministicOperationalPlanDraft,
  buildAssessmentOperationalPlanDraft,
  assessmentOperationalPlanInputSchema,
  adaptiveContentHash,
  canTransitionOperationalPlanItem,
  operationalPlanContentDigest,
  operationalPlanVersionInputSchema,
  type OperationalPlanDraftSignal,
  type OperationalPlanVersionInput,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateOperationalPlanDto,
  AssessmentOperationalPlanDto,
  GenerateOperationalPlanDto,
  OperationalPlanQueryDto,
  TransitionOperationalPlanItemDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const planInclude = {
  createdBy: { select: { id: true, displayName: true } },
  versions: {
    orderBy: { version: 'desc' as const },
    include: {
      responsible: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true, displayName: true } },
      items: {
        orderBy: { displayOrder: 'asc' as const },
        include: {
          workCenter: { select: { id: true, name: true } },
          responsible: { select: { id: true, displayName: true } },
          execution: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class OperationalPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async context(organizationId: string) {
    const [workCenters, memberships] = await Promise.all([
      this.prisma.workCenter.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.membership.findMany({
        where: { organizationId, status: 'ACTIVE' },
        select: { role: true, user: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { workCenters, members: memberships.map(({ user, role }) => ({ ...user, role })) };
  }

  async fromAssessment(
    organizationId: string,
    userId: string,
    assessmentId: string,
    rawInput: AssessmentOperationalPlanDto,
    context: Context,
    creationKey?: string,
  ) {
    if (creationKey !== undefined && !isUUID(creationKey, '4'))
      throw new BadRequestException('La clave de reintento no es válida.');
    const parsed = assessmentOperationalPlanInputSchema.safeParse(rawInput);
    if (!parsed.success)
      throw new BadRequestException('Revisa la selección y las fechas del plan.');
    const input = {
      ...parsed.data,
      selectedCapabilityKeys: [...parsed.data.selectedCapabilityKeys].sort(),
    };
    const keyHash = creationKey
      ? createHash('sha256')
          .update(`${organizationId}:${userId}:${creationKey.toLowerCase()}`)
          .digest('hex')
      : null;
    const fingerprint = adaptiveContentHash({ assessmentId, ...input });
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (keyHash) {
          await tx.$executeRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${keyHash}, 0))`,
          );
          const receipt = await tx.auditLog.findFirst({
            where: {
              organizationId,
              actorUserId: userId,
              action: 'OPERATIONAL_PLAN_CREATED_FROM_ASSESSMENT',
              entityType: 'OperationalPlan',
              metadata: { path: ['idempotencyKeyHash'], equals: keyHash },
            },
            select: { entityId: true, metadata: true },
          });
          if (receipt) {
            const metadata = receipt.metadata as Prisma.JsonObject;
            if (metadata.creationFingerprint !== fingerprint || !receipt.entityId)
              throw new ConflictException({
                code: 'PLAN_CREATE_RETRY_CONFLICT',
                message:
                  'El intento anterior usó otros datos. Revisa el plan creado antes de continuar.',
              });
            const previous = await tx.operationalPlan.findFirst({
              where: { id: receipt.entityId, organizationId },
              include: planInclude,
            });
            if (!previous)
              throw new ConflictException('El plan del intento anterior ya no está disponible.');
            return previous;
          }
        }
        const assessment = await tx.sstAssessmentSession.findFirst({
          where: {
            id: assessmentId,
            organizationId,
            OR: [
              { channel: 'AUTHENTICATED' },
              { channel: 'PUBLIC', claimedAt: { not: null }, claimedById: { not: null } },
            ],
          },
          select: { status: true, latestResult: true, finalizedAt: true },
        });
        if (!assessment) throw new NotFoundException('Diagnóstico SST no encontrado.');
        if (assessment.status !== 'FINALIZED')
          throw new BadRequestException({
            code: 'ASSESSMENT_NOT_FINALIZED',
            message: 'Finaliza el diagnóstico antes de crear un borrador.',
          });
        const result = assessment.latestResult as Prisma.JsonObject | null;
        const evaluation = result?.capabilityEvaluation as Prisma.JsonObject | undefined;
        if (
          !evaluation ||
          !Array.isArray(evaluation.recommendations) ||
          !evaluation.recommendations.length
        )
          throw new BadRequestException({
            code: 'ASSESSMENT_CAPABILITY_EVALUATION_UNAVAILABLE',
            message:
              'Este diagnóstico no tiene propuestas de capacidades disponibles. Puedes realizar una nueva evaluación para crear un plan desde el diagnóstico.',
          });
        let draft: OperationalPlanVersionInput;
        try {
          draft = buildAssessmentOperationalPlanDraft({
            ...input,
            assessmentSessionId: assessmentId,
            assessmentFinalizedAt: assessment.finalizedAt?.toISOString(),
            capabilityEvaluation: evaluation,
          });
        } catch {
          throw new BadRequestException({
            code: 'ASSESSMENT_CAPABILITY_SELECTION_INVALID',
            message: 'Selecciona únicamente capacidades propuestas por este diagnóstico.',
          });
        }
        await this.requireTenantReferences(organizationId, [input.responsibleUserId], [], tx);
        const plan = await tx.operationalPlan.create({
          data: { organizationId, createdById: userId },
        });
        await this.createVersionRecord(tx, plan.id, organizationId, userId, draft, 1);
        await this.audit.record(
          {
            organizationId,
            actorUserId: userId,
            action: 'OPERATIONAL_PLAN_CREATED_FROM_ASSESSMENT',
            entityType: 'OperationalPlan',
            entityId: plan.id,
            metadata: {
              ...draft.provenance,
              engineVersion: evaluation.engineVersion,
              ...(keyHash ? { idempotencyKeyHash: keyHash, creationFingerprint: fingerprint } : {}),
            } as Prisma.InputJsonValue,
            ...context,
          },
          tx,
        );
        return tx.operationalPlan.findFirstOrThrow({
          where: { id: plan.id, organizationId },
          include: planInclude,
        });
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({
        code: 'PLAN_CREATE_UNAVAILABLE',
        message: 'No pudimos crear el borrador. Intenta nuevamente con los mismos datos.',
      });
    }
  }

  async list(organizationId: string, query: OperationalPlanQueryDto) {
    const where: Prisma.OperationalPlanWhereInput = {
      organizationId,
      ...(query.itemStatus
        ? {
            versions: {
              some: { items: { some: { execution: { status: query.itemStatus } } } },
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.operationalPlan.findMany({
        where,
        include: planInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.operationalPlan.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async get(organizationId: string, planId: string) {
    const plan = await this.prisma.operationalPlan.findFirst({
      where: { id: planId, organizationId },
      include: planInclude,
    });
    if (!plan) throw new NotFoundException('Plan operativo no encontrado.');
    return plan;
  }

  createManual(
    organizationId: string,
    userId: string,
    input: CreateOperationalPlanDto,
    context: Context,
  ) {
    return this.create(organizationId, userId, { ...input, origin: 'MANUAL' }, context);
  }

  createGapDraft(
    organizationId: string,
    userId: string,
    input: OperationalPlanVersionInput,
    context: Context,
  ) {
    if (
      input.origin !== 'DETERMINISTIC_DRAFT' ||
      input.items.some(({ provenanceType }) => provenanceType !== 'GAP_ANALYSIS')
    ) {
      throw new BadRequestException('El borrador de gaps debe conservar procedencia GAP_ANALYSIS.');
    }
    return this.create(organizationId, userId, input, context);
  }

  async createVersion(
    organizationId: string,
    planId: string,
    userId: string,
    rawInput: CreateOperationalPlanDto,
    context: Context,
  ) {
    const input = operationalPlanVersionInputSchema.parse({ ...rawInput, origin: 'MANUAL' });
    await this.requireTenantReferences(
      organizationId,
      [input.responsibleUserId, ...input.items.map(({ responsibleUserId }) => responsibleUserId)],
      input.items.map(({ workCenterId }) => workCenterId),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "OperationalPlan" WHERE id = ${planId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
      const plan = await tx.operationalPlan.findFirst({ where: { id: planId, organizationId } });
      if (!plan) throw new NotFoundException('Plan operativo no encontrado.');
      const latest = await tx.operationalPlanVersion.findFirst({
        where: { planId, organizationId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = await this.createVersionRecord(
        tx,
        planId,
        organizationId,
        userId,
        input,
        (latest?.version ?? 0) + 1,
      );
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OPERATIONAL_PLAN_VERSION_CREATED',
          entityType: 'OperationalPlanVersion',
          entityId: version.id,
          metadata: { planId, origin: input.origin, itemCount: input.items.length },
          ...context,
        },
        tx,
      );
    });
    return this.get(organizationId, planId);
  }

  async generateDraft(
    organizationId: string,
    userId: string,
    input: GenerateOperationalPlanDto,
    context: Context,
  ) {
    const [actions, obligations, alerts] = await Promise.all([
      this.prisma.correctiveAction.findMany({
        where: { organizationId, status: { notIn: ['COMPLETED', 'CANCELED'] } },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          dueAt: true,
          assignedToUserId: true,
          finding: { select: { workCenterId: true } },
        },
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        take: 50,
      }),
      this.prisma.obligationExecution.findMany({
        where: { organizationId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          dueAt: true,
          workCenterId: true,
          assignedToUserId: true,
          originType: true,
          requirementId: true,
          regulatoryUnitId: true,
        },
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        take: 50,
      }),
      this.prisma.inspectionAlert.findMany({
        where: { organizationId, status: 'OPEN' },
        select: {
          id: true,
          message: true,
          severity: true,
          finding: {
            select: { id: true, title: true, description: true, workCenterId: true },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
    ]);
    const signals: OperationalPlanDraftSignal[] = [
      ...actions.map((action) => ({
        sourceType: 'CORRECTIVE_ACTION' as const,
        sourceId: action.id,
        title: action.title,
        description: action.description ?? undefined,
        dueAt: action.dueAt?.toISOString().slice(0, 10),
        priority: action.priority,
        workCenterId: action.finding.workCenterId,
        responsibleUserId: action.assignedToUserId ?? undefined,
      })),
      ...obligations.map((obligation) => ({
        sourceType: 'OBLIGATION_EXECUTION' as const,
        sourceId: obligation.id,
        title: obligation.title,
        description: obligation.description ?? undefined,
        dueAt: obligation.dueAt?.toISOString().slice(0, 10),
        priority: obligation.priority,
        workCenterId: obligation.workCenterId ?? undefined,
        responsibleUserId: obligation.assignedToUserId ?? undefined,
      })),
      ...alerts.map((alert) => ({
        sourceType: 'FINDING' as const,
        sourceId: alert.finding.id,
        title: `Revisar recurrencia: ${alert.finding.title}`,
        description: alert.message || alert.finding.description,
        priority: alert.severity === 'CRITICAL' ? ('URGENT' as const) : ('HIGH' as const),
        workCenterId: alert.finding.workCenterId,
      })),
    ];
    if (!signals.length) {
      throw new BadRequestException({
        code: 'PLAN_DRAFT_NO_KNOWN_SIGNALS',
        message:
          'Todavía no hay acciones o ejecuciones conocidas para proponer un plan. Puedes crear uno manualmente.',
      });
    }
    const draft = buildDeterministicOperationalPlanDraft({
      ...input,
      provenance: {
        generator: 'KNOWN_OPERATIONAL_SIGNALS_V1',
        correctiveActionCount: actions.length,
        obligationExecutionCount: obligations.length,
        openInspectionAlertCount: alerts.length,
      },
      signals,
    });
    return this.create(organizationId, userId, draft, context);
  }

  async activate(
    organizationId: string,
    planId: string,
    versionId: string,
    userId: string,
    context: Context,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const version = await tx.operationalPlanVersion.findFirst({
        where: { id: versionId, planId, organizationId },
        select: { id: true, status: true },
      });
      if (!version) throw new NotFoundException('Versión del plan no encontrada.');
      if (version.status !== 'DRAFT')
        throw new BadRequestException('Solo un borrador puede activarse.');
      const now = new Date();
      await tx.operationalPlanVersion.updateMany({
        where: { organizationId, status: 'ACTIVE' },
        data: { status: 'RETIRED', retiredAt: now },
      });
      await tx.operationalPlanVersion.update({
        where: { id: versionId },
        data: { status: 'ACTIVE', activatedAt: now },
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OPERATIONAL_PLAN_ACTIVATED',
          entityType: 'OperationalPlanVersion',
          entityId: versionId,
          metadata: { planId },
          ...context,
        },
        tx,
      );
    });
    return this.get(organizationId, planId);
  }

  async transitionItem(
    organizationId: string,
    itemId: string,
    userId: string,
    input: TransitionOperationalPlanItemDto,
    context: Context,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.operationalPlanItemExecution.findFirst({
        where: {
          planItemId: itemId,
          organizationId,
          planItem: { planVersion: { status: 'ACTIVE' } },
        },
      });
      if (!current) throw new NotFoundException('Ítem de plan no encontrado.');
      if (!canTransitionOperationalPlanItem(current.status, input.status))
        throw new BadRequestException('La transición del ítem no está permitida.');
      const result = await tx.operationalPlanItemExecution.updateMany({
        where: {
          id: current.id,
          organizationId,
          version: input.expectedVersion,
          status: current.status,
        },
        data: {
          status: input.status,
          version: { increment: 1 },
          actorUserId: userId,
          startedAt: input.status === 'IN_PROGRESS' ? new Date() : undefined,
          completedAt: input.status === 'COMPLETED' ? new Date() : undefined,
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'El ítem cambió en otra sesión. Actualiza e intenta nuevamente.',
        );
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OPERATIONAL_PLAN_ITEM_TRANSITIONED',
          entityType: 'OperationalPlanItem',
          entityId: itemId,
          metadata: { from: current.status, to: input.status },
          ...context,
        },
        tx,
      );
      return tx.operationalPlanItemExecution.findUniqueOrThrow({
        where: { planItemId: itemId },
      });
    });
  }

  private async create(
    organizationId: string,
    userId: string,
    rawInput: OperationalPlanVersionInput,
    context: Context,
  ) {
    const input = operationalPlanVersionInputSchema.parse(rawInput);
    await this.requireTenantReferences(
      organizationId,
      [input.responsibleUserId, ...input.items.map(({ responsibleUserId }) => responsibleUserId)],
      input.items.map(({ workCenterId }) => workCenterId),
    );
    const planId = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.operationalPlan.create({
        data: { organizationId, createdById: userId },
      });
      await this.createVersionRecord(tx, plan.id, organizationId, userId, input, 1);
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'OPERATIONAL_PLAN_DRAFT_CREATED',
          entityType: 'OperationalPlan',
          entityId: plan.id,
          metadata: { origin: input.origin, itemCount: input.items.length },
          ...context,
        },
        tx,
      );
      return plan.id;
    });
    return this.get(organizationId, planId);
  }

  private createVersionRecord(
    tx: Prisma.TransactionClient,
    planId: string,
    organizationId: string,
    userId: string,
    input: OperationalPlanVersionInput,
    version: number,
  ) {
    return tx.operationalPlanVersion.create({
      data: {
        planId,
        organizationId,
        version,
        status: 'DRAFT',
        origin: input.origin,
        name: input.name,
        description: input.description,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        responsibleUserId: input.responsibleUserId,
        provenance: input.provenance as Prisma.InputJsonValue,
        contentDigest: operationalPlanContentDigest(input),
        createdById: userId,
        items: {
          create: input.items.map((item, index) => ({
            organizationId,
            title: item.title,
            description: item.description,
            startsAt: item.startsAt ? new Date(item.startsAt) : undefined,
            dueAt: item.dueAt ? new Date(item.dueAt) : undefined,
            frequency: item.frequency,
            priority: item.priority,
            workCenterId: item.workCenterId,
            responsibleUserId: item.responsibleUserId,
            evidenceReferences: item.evidenceReferences,
            provenanceType: item.provenanceType,
            provenanceReference: item.provenanceReference,
            provenanceSnapshot: item.provenanceSnapshot as Prisma.InputJsonValue,
            displayOrder: index + 1,
            execution: { create: { organizationId, actorUserId: userId } },
          })),
        },
      },
    });
  }

  private async requireTenantReferences(
    organizationId: string,
    userIds: Array<string | undefined>,
    workCenterIds: Array<string | undefined>,
    database: Prisma.TransactionClient = this.prisma,
  ) {
    const uniqueUsers = [...new Set(userIds.filter((value): value is string => Boolean(value)))];
    const uniqueCenters = [
      ...new Set(workCenterIds.filter((value): value is string => Boolean(value))),
    ];
    const [members, centers] = await Promise.all([
      database.membership.count({
        where: { organizationId, userId: { in: uniqueUsers }, status: 'ACTIVE' },
      }),
      database.workCenter.count({
        where: { organizationId, id: { in: uniqueCenters }, isActive: true },
      }),
    ]);
    if (members !== uniqueUsers.length)
      throw new BadRequestException(
        'Una persona responsable no pertenece a la organización activa.',
      );
    if (centers !== uniqueCenters.length)
      throw new BadRequestException('Un centro de trabajo no pertenece a la organización activa.');
  }
}
