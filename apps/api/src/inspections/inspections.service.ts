import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InspectionStatus, Prisma } from '@prisma/client';
import {
  assertCorrectiveActionTransition,
  assertInspectionTransition,
  calculateDemoRisk,
  FINDING_CATEGORY_LABELS,
  findingClosureEligibility,
  INSPECTION_RECURRENCE_POLICY,
  isCorrectiveActionOverdue,
  recurrenceStatus,
  resolveFindingCategoriesFromSearch,
  type CorrectiveActionStatus,
  type FindingCategory,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AlertQueryDto,
  CreateActionDto,
  CreateEvidenceDto,
  CreateFindingDto,
  CreateInspectionDto,
  InspectionQueryDto,
  SearchFindingDto,
  UpdateActionDto,
  UpdateFindingDto,
  UpdateInspectionDto,
  VerifyFindingDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;
type OrganizationActor = { id: string; role: string };

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  context(organizationId: string) {
    return Promise.all([
      this.prisma.workCenter.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          city: true,
          isDemo: true,
          workAreas: {
            where: { organizationId, isActive: true },
            select: { id: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.membership.findMany({
        where: { organizationId, status: 'ACTIVE' },
        select: { role: true, user: { select: { id: true, displayName: true } } },
        orderBy: { user: { displayName: 'asc' } },
      }),
    ]).then(([workCenters, memberships]) => ({
      workCenters,
      members: memberships.map(({ role, user }) => ({ ...user, role })),
    }));
  }

  async list(organizationId: string, query: InspectionQueryDto) {
    const where = this.inspectionWhere(organizationId, query);
    const [items, total] = await Promise.all([
      this.prisma.inspection.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          workCenter: { select: { id: true, name: true } },
          workArea: { select: { id: true, name: true } },
          inspector: { select: { id: true, displayName: true } },
          findings: {
            where: { organizationId },
            select: {
              status: true,
              initialRiskLevel: true,
              recurrenceStatus: true,
              actions: { where: { organizationId }, select: { status: true, dueAt: true } },
            },
          },
        },
      }),
      this.prisma.inspection.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        overdueActions: item.findings
          .flatMap((finding) => finding.actions)
          .filter((action) => isCorrectiveActionOverdue(action.status, action.dueAt)).length,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateInspectionDto,
    context: Context,
  ) {
    await this.assertLocation(organizationId, input.workCenterId, input.workAreaId);
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { status: true },
    });
    const inspection = await this.prisma.inspection.create({
      data: {
        organizationId,
        workCenterId: input.workCenterId,
        workAreaId: input.workAreaId,
        title: input.title.trim(),
        description: input.description?.trim(),
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
        inspectorUserId: userId,
        isDemo: organization.status === 'DEMO',
      },
      include: {
        workCenter: { select: { id: true, name: true } },
        workArea: { select: { id: true, name: true } },
      },
    });
    await this.record(
      organizationId,
      userId,
      'INSPECTION_CREATED',
      'Inspection',
      inspection.id,
      { workCenterId: inspection.workCenterId, isDemo: inspection.isDemo },
      context,
    );
    return inspection;
  }

  async get(organizationId: string, inspectionId: string) {
    const inspection = await this.prisma.inspection.findFirst({
      where: { id: inspectionId, organizationId },
      include: {
        workCenter: { select: { id: true, name: true, city: true } },
        workArea: { select: { id: true, name: true } },
        inspector: { select: { id: true, displayName: true } },
        findings: {
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          include: {
            actions: {
              where: { organizationId },
              orderBy: { createdAt: 'asc' },
              include: {
                assignedTo: { select: { id: true, displayName: true } },
                evidence: { where: { organizationId }, orderBy: { createdAt: 'desc' } },
              },
            },
          },
        },
      },
    });
    if (!inspection) throw new NotFoundException('Inspección no encontrada.');
    return {
      ...inspection,
      findings: inspection.findings.map((finding) => ({
        ...finding,
        actions: finding.actions.map((action) => ({
          ...action,
          overdue: isCorrectiveActionOverdue(action.status, action.dueAt),
        })),
      })),
    };
  }

  async update(organizationId: string, inspectionId: string, input: UpdateInspectionDto) {
    await this.requireInspection(organizationId, inspectionId);
    return this.prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        title: input.title?.trim(),
        description: input.description?.trim(),
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
      },
      select: {
        id: true,
        title: true,
        description: true,
        scheduledFor: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async transition(
    organizationId: string,
    inspectionId: string,
    target: InspectionStatus,
    userId: string,
    context: Context,
  ) {
    const inspection = await this.requireInspection(organizationId, inspectionId);
    try {
      assertInspectionTransition(inspection.status, target);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: `No se puede cambiar de ${inspection.status} a ${target}.`,
      });
    }
    const updated = await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        status: target,
        startedAt: target === 'IN_PROGRESS' ? new Date() : undefined,
        completedAt: target === 'COMPLETED' ? new Date() : undefined,
      },
      select: { id: true, status: true, startedAt: true, completedAt: true },
    });
    await this.record(
      organizationId,
      userId,
      target === 'IN_PROGRESS' ? 'INSPECTION_STARTED' : 'INSPECTION_COMPLETED',
      'Inspection',
      inspectionId,
      {},
      context,
    );
    return updated;
  }

  async listFindings(organizationId: string, inspectionId: string, query: InspectionQueryDto) {
    await this.requireInspection(organizationId, inspectionId);
    const where: Prisma.InspectionFindingWhereInput = {
      organizationId,
      inspectionId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.riskLevel ? { initialRiskLevel: query.riskLevel } : {}),
      ...(query.findingStatus ? { status: query.findingStatus } : {}),
      ...(query.hasRecurrence === 'true' ? { recurrenceCount: { gt: 0 } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.inspectionFinding.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          workCenter: { select: { name: true } },
          workArea: { select: { name: true } },
          actions: { where: { organizationId }, select: { id: true, status: true, dueAt: true } },
        },
      }),
      this.prisma.inspectionFinding.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        overdueActions: item.actions.filter((action) =>
          isCorrectiveActionOverdue(action.status, action.dueAt),
        ).length,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async createFinding(
    organizationId: string,
    inspectionId: string,
    userId: string,
    input: CreateFindingDto,
    context: Context,
  ) {
    const inspection = await this.requireInspection(organizationId, inspectionId);
    if (inspection.status === 'COMPLETED' || inspection.status === 'CANCELED')
      throw new BadRequestException({
        code: 'INSPECTION_NOT_EDITABLE',
        message: 'Una inspección finalizada no admite nuevos hallazgos.',
      });
    const risk = calculateDemoRisk(input.likelihood, input.consequence);
    const created = await this.prisma.inspectionFinding.create({
      data: {
        organizationId,
        inspectionId,
        workCenterId: inspection.workCenterId,
        workAreaId: inspection.workAreaId,
        category: input.category,
        title: input.title.trim(),
        description: input.description.trim(),
        riskMethodKey: risk.methodKey,
        riskMethodVersion: risk.methodVersion,
        initialLikelihood: risk.likelihood,
        initialConsequence: risk.consequence,
        initialScore: risk.score,
        initialRiskLevel: risk.level,
        createdById: userId,
      },
    });
    const since = new Date(created.createdAt.getTime() - this.windowDays() * 86_400_000);
    const previous = await this.prisma.inspectionFinding.findMany({
      where: {
        organizationId,
        id: { not: created.id },
        workCenterId: created.workCenterId,
        category: created.category,
        createdAt: { gte: since, lt: created.createdAt },
      },
      select: { id: true },
    });
    const status = recurrenceStatus(previous.length);
    const finding = await this.prisma.inspectionFinding.update({
      where: { id: created.id },
      data: { recurrenceCount: previous.length, recurrenceStatus: status },
      include: { workCenter: { select: { name: true } }, workArea: { select: { name: true } } },
    });
    await this.record(
      organizationId,
      userId,
      'FINDING_CREATED',
      'InspectionFinding',
      finding.id,
      {
        category: finding.category,
        initialRiskLevel: finding.initialRiskLevel,
        riskMethodVersion: finding.riskMethodVersion,
      },
      context,
    );
    if (status !== 'NONE')
      await this.record(
        organizationId,
        userId,
        status === 'SYSTEMIC_REVIEW_RECOMMENDED'
          ? 'SYSTEMIC_REVIEW_RECOMMENDED'
          : 'RECURRENCE_DETECTED',
        'InspectionFinding',
        finding.id,
        {
          category: finding.category,
          workCenterId: finding.workCenterId,
          previousCount: previous.length,
          windowDays: this.windowDays(),
        },
        context,
      );
    if (status === 'SYSTEMIC_REVIEW_RECOMMENDED')
      await this.prisma.inspectionAlert.upsert({
        where: { findingId_type: { findingId: finding.id, type: 'RECURRENCE' } },
        update: {},
        create: {
          organizationId,
          findingId: finding.id,
          type: 'RECURRENCE',
          severity: 'WARNING',
          message: `Se registraron varios hallazgos de categoría ${FINDING_CATEGORY_LABELS[finding.category as FindingCategory]} en este centro durante los últimos ${this.windowDays()} días. Se recomienda revisar si las acciones puntuales son suficientes y evaluar posibles factores sistémicos.`,
        },
      });
    return {
      ...finding,
      previousFindingIds: previous.map(({ id }) => id),
      recurrenceWindowDays: this.windowDays(),
    };
  }

  async getFinding(organizationId: string, inspectionId: string, findingId: string) {
    const finding = await this.prisma.inspectionFinding.findFirst({
      where: { id: findingId, inspectionId, organizationId },
      include: {
        inspection: { select: { id: true, title: true, status: true, isDemo: true } },
        workCenter: { select: { id: true, name: true } },
        workArea: { select: { id: true, name: true } },
        actions: {
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
          include: {
            assignedTo: { select: { id: true, displayName: true } },
            verifiedBy: { select: { id: true, displayName: true } },
            evidence: { where: { organizationId }, orderBy: { createdAt: 'desc' } },
          },
        },
        alerts: { where: { organizationId }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!finding) throw new NotFoundException('Hallazgo no encontrado.');
    const since = new Date(finding.createdAt.getTime() - this.windowDays() * 86_400_000);
    const previous =
      finding.recurrenceCount > 0
        ? await this.prisma.inspectionFinding.findMany({
            where: {
              organizationId,
              id: { not: finding.id },
              workCenterId: finding.workCenterId,
              category: finding.category,
              createdAt: { gte: since, lt: finding.createdAt },
            },
            select: { id: true, inspectionId: true, title: true, createdAt: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : [];
    return {
      ...finding,
      actions: finding.actions.map((action) => ({
        ...action,
        overdue: isCorrectiveActionOverdue(action.status, action.dueAt),
      })),
      recurrence: {
        previousCount: finding.recurrenceCount,
        windowDays: this.windowDays(),
        previous,
      },
    };
  }

  async updateFinding(
    organizationId: string,
    inspectionId: string,
    findingId: string,
    userId: string,
    input: UpdateFindingDto,
    context: Context,
  ) {
    await this.requireFinding(organizationId, inspectionId, findingId);
    const updated = await this.prisma.inspectionFinding.update({
      where: { id: findingId },
      data: { title: input.title?.trim(), description: input.description?.trim() },
      select: { id: true, title: true, description: true, status: true, updatedAt: true },
    });
    await this.record(
      organizationId,
      userId,
      'FINDING_UPDATED',
      'InspectionFinding',
      findingId,
      {},
      context,
    );
    return updated;
  }

  async createAction(
    organizationId: string,
    inspectionId: string,
    findingId: string,
    userId: string,
    input: CreateActionDto,
    context: Context,
  ) {
    const finding = await this.requireFinding(organizationId, inspectionId, findingId);
    this.assertFindingAllowsActionMutation(finding.status);
    await this.assertAssignee(organizationId, input.assignedToUserId);
    const action = await this.prisma.$transaction(async (tx) => {
      const created = await tx.correctiveAction.create({
        data: {
          organizationId,
          findingId,
          title: input.title.trim(),
          description: input.description?.trim(),
          assignedToUserId: input.assignedToUserId,
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          createdById: userId,
        },
        include: { assignedTo: { select: { id: true, displayName: true } } },
      });
      await tx.inspectionFinding.update({
        where: { id: findingId },
        data: { status: 'ACTION_IN_PROGRESS' },
      });
      return created;
    });
    await this.record(
      organizationId,
      userId,
      'CORRECTIVE_ACTION_CREATED',
      'CorrectiveAction',
      action.id,
      { findingId, priority: action.priority, hasAssignee: Boolean(action.assignedToUserId) },
      context,
    );
    return { ...action, overdue: isCorrectiveActionOverdue(action.status, action.dueAt) };
  }

  async updateAction(
    organizationId: string,
    inspectionId: string,
    findingId: string,
    actionId: string,
    userId: string,
    input: UpdateActionDto,
    context: Context,
  ) {
    const finding = await this.requireFinding(organizationId, inspectionId, findingId);
    this.assertFindingAllowsActionMutation(finding.status);
    const current = await this.requireAction(organizationId, inspectionId, findingId, actionId);
    if (input.status) this.assertActionTransition(current.status, input.status);
    await this.assertAssignee(organizationId, input.assignedToUserId);
    const action = await this.prisma.correctiveAction.update({
      where: { id: actionId },
      data: {
        title: input.title?.trim(),
        description: input.description?.trim(),
        assignedToUserId: input.assignedToUserId,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        status: input.status,
      },
      include: { assignedTo: { select: { id: true, displayName: true } } },
    });
    await this.record(
      organizationId,
      userId,
      'CORRECTIVE_ACTION_UPDATED',
      'CorrectiveAction',
      actionId,
      { status: action.status, priority: action.priority },
      context,
    );
    return { ...action, overdue: isCorrectiveActionOverdue(action.status, action.dueAt) };
  }

  async addEvidence(
    organizationId: string,
    inspectionId: string,
    findingId: string,
    actionId: string,
    userId: string,
    input: CreateEvidenceDto,
  ) {
    await this.requireAction(organizationId, inspectionId, findingId, actionId);
    if (input.type === 'NOTE' && !input.note)
      throw new BadRequestException('La evidencia tipo nota requiere contenido.');
    if (input.type === 'EXTERNAL_LINK' && !input.externalUrl)
      throw new BadRequestException('La evidencia tipo enlace requiere una URL HTTPS.');
    return this.prisma.actionEvidence.create({
      data: {
        organizationId,
        correctiveActionId: actionId,
        type: input.type,
        note: input.note?.trim(),
        externalUrl: input.externalUrl,
        createdById: userId,
      },
      select: { id: true, type: true, note: true, externalUrl: true, createdAt: true },
    });
  }

  async completeAction(
    organization: OrganizationActor,
    inspectionId: string,
    findingId: string,
    actionId: string,
    userId: string,
    context: Context,
  ) {
    const finding = await this.requireFinding(
      organization.id,
      inspectionId,
      findingId,
    );
    this.assertFindingAllowsActionMutation(finding.status);
    const action = await this.requireAction(organization.id, inspectionId, findingId, actionId);
    if (organization.role === 'SST_TECHNICIAN' && action.assignedToUserId !== userId)
      throw new ForbiddenException({
        code: 'ACTION_ASSIGNEE_REQUIRED',
        message: 'El técnico solo puede completar acciones que tenga asignadas.',
      });
    this.assertActionTransition(action.status, 'PENDING_VERIFICATION');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.correctiveAction.update({
        where: { id: actionId },
        data: { status: 'PENDING_VERIFICATION', completedAt: new Date() },
        select: { id: true, status: true, completedAt: true },
      });
      await tx.inspectionFinding.update({
        where: { id: findingId },
        data: { status: 'PENDING_VERIFICATION' },
      });
      return result;
    });
    await this.record(
      organization.id,
      userId,
      'CORRECTIVE_ACTION_COMPLETED',
      'CorrectiveAction',
      actionId,
      { findingId },
      context,
    );
    return updated;
  }

  async verifyFinding(
    organizationId: string,
    inspectionId: string,
    findingId: string,
    userId: string,
    input: VerifyFindingDto,
    context: Context,
  ) {
    const finding = await this.requireFinding(organizationId, inspectionId, findingId, true);
    this.assertFindingAllowsActionMutation(finding.status);
    const pending = finding.actions.filter((action) => action.status === 'PENDING_VERIFICATION');
    if (pending.length === 0)
      throw new BadRequestException({
        code: 'NO_ACTION_PENDING_VERIFICATION',
        message: 'No existen acciones pendientes de verificación.',
      });
    pending.forEach((action) => this.assertActionTransition(action.status, 'COMPLETED'));
    const residual = calculateDemoRisk(input.likelihood, input.consequence);
    const projected = finding.actions.map((action) =>
      action.status === 'PENDING_VERIFICATION' ? 'COMPLETED' : action.status,
    );
    const closure = findingClosureEligibility({ actionStatuses: projected, hasResidualRisk: true });
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.correctiveAction.updateMany({
        where: { organizationId, findingId, status: 'PENDING_VERIFICATION' },
        data: { status: 'COMPLETED', verifiedAt: now, verifiedByUserId: userId },
      });
      const result = await tx.inspectionFinding.update({
        where: { id: findingId },
        data: {
          residualLikelihood: residual.likelihood,
          residualConsequence: residual.consequence,
          residualScore: residual.score,
          residualRiskLevel: residual.level,
          status: closure.allowed ? 'CLOSED' : 'ACTION_IN_PROGRESS',
          closedAt: closure.allowed ? now : null,
        },
        include: { actions: { where: { organizationId }, orderBy: { createdAt: 'asc' } } },
      });
      if (residual.level === 'HIGH' || residual.level === 'CRITICAL')
        await tx.inspectionAlert.upsert({
          where: { findingId_type: { findingId, type: 'HIGH_RESIDUAL_RISK' } },
          update: { status: 'OPEN', acknowledgedAt: null, acknowledgedById: null },
          create: {
            organizationId,
            findingId,
            type: 'HIGH_RESIDUAL_RISK',
            severity: residual.level === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
            message: `El riesgo residual permanece ${residual.level === 'CRITICAL' ? 'crítico' : 'alto'}. Revise la eficacia de las acciones antes de considerar controles adicionales.`,
          },
        });
      return result;
    });
    await Promise.all(
      pending.map((action) =>
        this.record(
          organizationId,
          userId,
          'CORRECTIVE_ACTION_VERIFIED',
          'CorrectiveAction',
          action.id,
          { findingId, residualRiskLevel: residual.level },
          context,
        ),
      ),
    );
    if (closure.allowed)
      await this.record(
        organizationId,
        userId,
        'FINDING_CLOSED',
        'InspectionFinding',
        findingId,
        { residualRiskLevel: residual.level },
        context,
      );
    return {
      ...updated,
      residualAssessment: residual,
      closed: closure.allowed,
      closureReason: closure.reason,
    };
  }

  async alerts(organizationId: string, query: AlertQueryDto) {
    const where: Prisma.InspectionAlertWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.inspectionAlert.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          finding: {
            select: {
              id: true,
              title: true,
              category: true,
              recurrenceCount: true,
              workCenter: { select: { id: true, name: true } },
              inspection: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.inspectionAlert.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async acknowledgeAlert(
    organizationId: string,
    alertId: string,
    userId: string,
    context: Context,
  ) {
    const alert = await this.prisma.inspectionAlert.findFirst({
      where: { id: alertId, organizationId },
      select: { id: true },
    });
    if (!alert) throw new NotFoundException('Alerta no encontrada.');
    const updated = await this.prisma.inspectionAlert.update({
      where: { id: alertId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedById: userId },
      select: { id: true, status: true, acknowledgedAt: true },
    });
    await this.record(
      organizationId,
      userId,
      'INSPECTION_ALERT_ACKNOWLEDGED',
      'InspectionAlert',
      alertId,
      {},
      context,
    );
    return updated;
  }

  async search(organizationId: string, query: SearchFindingDto) {
    const text = query.q.trim();
    const categories = resolveFindingCategoriesFromSearch(text);
    const where: Prisma.InspectionFindingWhereInput = {
      organizationId,
      OR: [
        { title: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
        { workCenter: { name: { contains: text, mode: 'insensitive' } } },
        { workArea: { name: { contains: text, mode: 'insensitive' } } },
        ...(categories.length > 0 ? [{ category: { in: categories } }] : []),
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.inspectionFinding.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          workCenter: { select: { id: true, name: true } },
          workArea: { select: { id: true, name: true } },
          inspection: { select: { id: true, title: true } },
        },
      }),
      this.prisma.inspectionFinding.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async analytics(organizationId: string, query: InspectionQueryDto) {
    const inspectionWhere = this.inspectionWhere(organizationId, query);
    const findingWhere: Prisma.InspectionFindingWhereInput = {
      organizationId,
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
      ...(query.workAreaId ? { workAreaId: query.workAreaId } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    const now = new Date();
    const [
      totalInspections,
      totalFindings,
      openFindings,
      highCritical,
      overdueActions,
      recurrenceAlerts,
      closedFindings,
      byCategory,
      byCenter,
      byRisk,
      findingsForAverage,
      residual,
    ] = await Promise.all([
      this.prisma.inspection.count({ where: inspectionWhere }),
      this.prisma.inspectionFinding.count({ where: findingWhere }),
      this.prisma.inspectionFinding.count({
        where: { ...findingWhere, status: { not: 'CLOSED' } },
      }),
      this.prisma.inspectionFinding.count({
        where: { ...findingWhere, initialRiskLevel: { in: ['HIGH', 'CRITICAL'] } },
      }),
      this.prisma.correctiveAction.count({
        where: {
          organizationId,
          dueAt: { lt: now },
          status: { notIn: ['COMPLETED', 'CANCELED'] },
          finding: findingWhere,
        },
      }),
      this.prisma.inspectionAlert.count({
        where: {
          organizationId,
          type: 'RECURRENCE',
          status: { not: 'RESOLVED' },
          finding: findingWhere,
        },
      }),
      this.prisma.inspectionFinding.count({ where: { ...findingWhere, status: 'CLOSED' } }),
      this.prisma.inspectionFinding.groupBy({
        by: ['category'],
        where: findingWhere,
        _count: { _all: true },
      }),
      this.prisma.inspectionFinding.groupBy({
        by: ['workCenterId'],
        where: findingWhere,
        _count: { _all: true },
      }),
      this.prisma.inspectionFinding.groupBy({
        by: ['initialRiskLevel'],
        where: findingWhere,
        _count: { _all: true },
      }),
      this.prisma.inspectionFinding.findMany({
        where: findingWhere,
        select: { createdAt: true, closedAt: true },
      }),
      this.prisma.inspectionFinding.groupBy({
        by: ['residualRiskLevel'],
        where: { ...findingWhere, residualRiskLevel: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const centers = await this.prisma.workCenter.findMany({
      where: { organizationId, id: { in: byCenter.map((item) => item.workCenterId) } },
      select: { id: true, name: true },
    });
    const averageDaysOpen = findingsForAverage.length
      ? findingsForAverage.reduce(
          (sum, finding) =>
            sum + ((finding.closedAt ?? now).getTime() - finding.createdAt.getTime()) / 86_400_000,
          0,
        ) / findingsForAverage.length
      : 0;
    return {
      totalInspections,
      openFindings,
      highCriticalFindings: highCritical,
      overdueActions,
      recurrenceAlerts,
      findingsByCategory: byCategory.map((item) => ({
        category: item.category,
        count: item._count._all,
      })),
      findingsByWorkCenter: byCenter.map((item) => ({
        workCenterId: item.workCenterId,
        name: centers.find((center) => center.id === item.workCenterId)?.name ?? 'Centro',
        count: item._count._all,
      })),
      findingsByRiskLevel: byRisk.map((item) => ({
        riskLevel: item.initialRiskLevel,
        count: item._count._all,
      })),
      averageDaysOpen: Math.round(averageDaysOpen * 10) / 10,
      percentageClosed: totalFindings
        ? Math.round((closedFindings / totalFindings) * 1000) / 10
        : 0,
      initialVsResidual: {
        initial: byRisk.map((item) => ({
          riskLevel: item.initialRiskLevel,
          count: item._count._all,
        })),
        residual: residual.map((item) => ({
          riskLevel: item.residualRiskLevel,
          count: item._count._all,
        })),
      },
    };
  }

  private inspectionWhere(
    organizationId: string,
    query: InspectionQueryDto,
  ): Prisma.InspectionWhereInput {
    return {
      organizationId,
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
      ...(query.workAreaId ? { workAreaId: query.workAreaId } : {}),
      ...(query.inspectionStatus ? { status: query.inspectionStatus } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.category ||
      query.riskLevel ||
      query.findingStatus ||
      query.hasRecurrence === 'true' ||
      query.overdue === 'true'
        ? {
            findings: {
              some: {
                organizationId,
                ...(query.category ? { category: query.category } : {}),
                ...(query.riskLevel ? { initialRiskLevel: query.riskLevel } : {}),
                ...(query.findingStatus ? { status: query.findingStatus } : {}),
                ...(query.hasRecurrence === 'true' ? { recurrenceCount: { gt: 0 } } : {}),
                ...(query.overdue === 'true'
                  ? {
                      actions: {
                        some: {
                          organizationId,
                          dueAt: { lt: new Date() },
                          status: { notIn: ['COMPLETED', 'CANCELED'] },
                        },
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
    };
  }

  private async assertLocation(organizationId: string, workCenterId: string, workAreaId?: string) {
    const center = await this.prisma.workCenter.findFirst({
      where: { id: workCenterId, organizationId },
      select: { id: true },
    });
    if (!center) throw new NotFoundException('Centro de trabajo no encontrado.');
    if (workAreaId) {
      const area = await this.prisma.workArea.findFirst({
        where: { id: workAreaId, organizationId, workCenterId, isActive: true },
        select: { id: true },
      });
      if (!area)
        throw new NotFoundException('Área de trabajo no encontrada para el centro activo.');
    }
  }

  private async assertAssignee(organizationId: string, userId?: string) {
    if (!userId) return;
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!membership)
      throw new BadRequestException('La persona asignada no pertenece a la organización activa.');
  }

  private async requireInspection(organizationId: string, inspectionId: string) {
    const inspection = await this.prisma.inspection.findFirst({
      where: { id: inspectionId, organizationId },
      select: { id: true, status: true, workCenterId: true, workAreaId: true },
    });
    if (!inspection) throw new NotFoundException('Inspección no encontrada.');
    return inspection;
  }

  private async requireFinding(
    organizationId: string,
    inspectionId: string,
    findingId: string,
    includeActions = false,
  ) {
    const finding = await this.prisma.inspectionFinding.findFirst({
      where: { id: findingId, inspectionId, organizationId, inspection: { organizationId } },
      include: includeActions
        ? { actions: { where: { organizationId }, select: { id: true, status: true } } }
        : undefined,
    });
    if (!finding) throw new NotFoundException('Hallazgo no encontrado.');
    return finding as typeof finding & {
      actions: Array<{ id: string; status: CorrectiveActionStatus }>;
    };
  }

  private async requireAction(
    organizationId: string,
    inspectionId: string,
    findingId: string,
    actionId: string,
  ) {
    const action = await this.prisma.correctiveAction.findFirst({
      where: {
        id: actionId,
        findingId,
        organizationId,
        finding: { organizationId, inspectionId, inspection: { organizationId } },
      },
    });
    if (!action) throw new NotFoundException('Acción correctiva no encontrada.');
    return action;
  }

  private windowDays() {
    const configured = Number(
      process.env.INSPECTION_RECURRENCE_WINDOW_DAYS ?? INSPECTION_RECURRENCE_POLICY.windowDays,
    );
    return Number.isInteger(configured) && configured > 0
      ? configured
      : INSPECTION_RECURRENCE_POLICY.windowDays;
  }

  private assertFindingAllowsActionMutation(status: string) {
    if (status === 'CLOSED')
      throw new BadRequestException({
        code: 'FINDING_CLOSED',
        message: 'Un hallazgo cerrado no admite cambios en sus acciones.',
      });
  }

  private assertActionTransition(from: CorrectiveActionStatus, to: CorrectiveActionStatus) {
    try {
      assertCorrectiveActionTransition(from, to);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CORRECTIVE_ACTION_TRANSITION',
        message: `No se puede cambiar la acción de ${from} a ${to}.`,
      });
    }
  }

  private record(
    organizationId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
    context: Context,
  ) {
    return this.audit.record({
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata,
      ...context,
    });
  }
}
