import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildDeterministicOperationalPlanDraft,
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
    const versionId = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "OperationalPlan" WHERE id = ${planId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
      const plan = await tx.operationalPlan.findFirst({ where: { id: planId, organizationId } });
      if (!plan) throw new NotFoundException('Plan operativo no encontrado.');
      const latest = await tx.operationalPlanVersion.findFirst({
        where: { planId, organizationId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      return (
        await this.createVersionRecord(
          tx,
          planId,
          organizationId,
          userId,
          input,
          (latest?.version ?? 0) + 1,
        )
      ).id;
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OPERATIONAL_PLAN_VERSION_CREATED',
      entityType: 'OperationalPlanVersion',
      entityId: versionId,
      metadata: { planId, origin: input.origin, itemCount: input.items.length },
      ...context,
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
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OPERATIONAL_PLAN_ACTIVATED',
      entityType: 'OperationalPlanVersion',
      entityId: versionId,
      metadata: { planId },
      ...context,
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
    const current = await this.prisma.operationalPlanItemExecution.findFirst({
      where: {
        planItemId: itemId,
        organizationId,
        planItem: { planVersion: { status: 'ACTIVE' } },
      },
    });
    if (!current) throw new NotFoundException('Ítem de plan no encontrado.');
    if (!canTransitionOperationalPlanItem(current.status, input.status))
      throw new BadRequestException('La transición del ítem no está permitida.');
    const result = await this.prisma.operationalPlanItemExecution.updateMany({
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
      throw new ConflictException('El ítem cambió en otra sesión. Actualiza e intenta nuevamente.');
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OPERATIONAL_PLAN_ITEM_TRANSITIONED',
      entityType: 'OperationalPlanItem',
      entityId: itemId,
      metadata: { from: current.status, to: input.status },
      ...context,
    });
    return this.prisma.operationalPlanItemExecution.findUniqueOrThrow({
      where: { planItemId: itemId },
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
      return plan.id;
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OPERATIONAL_PLAN_DRAFT_CREATED',
      entityType: 'OperationalPlan',
      entityId: planId,
      metadata: { origin: input.origin, itemCount: input.items.length },
      ...context,
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
  ) {
    const uniqueUsers = [...new Set(userIds.filter((value): value is string => Boolean(value)))];
    const uniqueCenters = [
      ...new Set(workCenterIds.filter((value): value is string => Boolean(value))),
    ];
    const [members, centers] = await Promise.all([
      this.prisma.membership.count({
        where: { organizationId, userId: { in: uniqueUsers }, status: 'ACTIVE' },
      }),
      this.prisma.workCenter.count({
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
