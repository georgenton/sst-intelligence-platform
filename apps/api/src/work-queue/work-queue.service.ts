import { Injectable } from '@nestjs/common';
import {
  workQueuePriorityRank,
  type WorkQueueItemType,
  type WorkQueueModule,
} from '@sst/contracts';
import { WORK_PERMITS_FEATURE_KEY } from '../catalog/entitlement';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';
import type { WorkQueueQueryDto } from './dto';

type QueuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type QueueItem = {
  type: WorkQueueItemType;
  sourceId: string;
  organizationId: string;
  workCenter: { id: string; name: string } | null;
  title: string;
  summary: string;
  status: string;
  priority: QueuePriority;
  dueAt: Date | null;
  overdue: boolean;
  assignee: { id: string; displayName: string } | null;
  origin: string;
  module: WorkQueueModule;
  deepLink: string;
  regulatoryContext: { label: string; candidate: boolean } | null;
  riskContext: { method: string; level: string | null } | null;
  createdAt: Date;
};

@Injectable()
export class WorkQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async list(organizationId: string, query: WorkQueueQueryDto) {
    const now = new Date();
    const dueSoonBoundary = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const limit = Math.min(query.page * query.pageSize, 500);
    const dueFilter = {
      ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
      ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
    };
    const moduleEnabled = (module: WorkQueueModule) => !query.module || query.module === module;
    const effectiveEntitlements = await this.entitlements.effective(organizationId);
    const workPermitsEnabled = effectiveEntitlements.features[WORK_PERMITS_FEATURE_KEY] === true;

    const [actions, assessments, expertItems, obligations, systemicReviews, permits] =
      await Promise.all([
        moduleEnabled('INSPECTIONS')
          ? this.prisma.correctiveAction.findMany({
              where: {
                organizationId,
                status: { notIn: ['COMPLETED', 'CANCELED'] },
                ...(query.priority ? { priority: query.priority } : {}),
                ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
                ...(query.workCenterId ? { finding: { workCenterId: query.workCenterId } } : {}),
                ...(Object.keys(dueFilter).length ? { dueAt: dueFilter } : {}),
              },
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                priority: true,
                dueAt: true,
                createdAt: true,
                assignedTo: { select: { id: true, displayName: true } },
                finding: {
                  select: {
                    id: true,
                    inspectionId: true,
                    initialRiskLevel: true,
                    riskMethodSnapshot: true,
                    workCenter: { select: { id: true, name: true } },
                  },
                },
              },
              take: limit,
              orderBy: { createdAt: 'desc' },
            })
          : [],
        moduleEnabled('TECHNICAL_RISK') && !query.assignedToUserId && !query.priority
          ? this.prisma.technicalAssessment.findMany({
              where: {
                organizationId,
                status: 'COMPLETED',
                ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
              },
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                createdAt: true,
                methodSnapshot: true,
                workCenter: { select: { id: true, name: true } },
                result: { select: { level: true } },
                reviews: { select: { decision: true }, orderBy: { createdAt: 'desc' }, take: 1 },
              },
              take: limit,
              orderBy: { createdAt: 'desc' },
            })
          : [],
        moduleEnabled('REGULATORY') &&
        !query.assignedToUserId &&
        !query.priority &&
        !query.workCenterId
          ? this.prisma.unifiedSstEvaluationItem.findMany({
              where: {
                proposedState: 'NEEDS_EXPERT_REVIEW',
                evaluation: { organizationId },
              },
              select: {
                id: true,
                whyMatched: true,
                requirement: { select: { title: true, editorialStatus: true } },
                unit: { select: { identifier: true, locator: true } },
                evaluation: { select: { id: true, createdAt: true } },
              },
              take: limit,
              orderBy: { evaluation: { createdAt: 'desc' } },
            })
          : [],
        moduleEnabled('OPERATIONAL_EXECUTION')
          ? this.prisma.obligationExecution.findMany({
              where: {
                organizationId,
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
                ...(query.priority ? { priority: query.priority } : {}),
                ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
                ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
                ...(Object.keys(dueFilter).length ? { dueAt: dueFilter } : {}),
              },
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                priority: true,
                dueAt: true,
                createdAt: true,
                originType: true,
                requirement: { select: { title: true } },
                regulatoryUnit: { select: { identifier: true, locator: true } },
                workCenter: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, displayName: true } },
              },
              take: limit,
              orderBy: { createdAt: 'desc' },
            })
          : [],
        moduleEnabled('INSPECTIONS') && !query.assignedToUserId && !query.priority
          ? this.prisma.inspectionSystemicReview.findMany({
              where: {
                organizationId,
                status: { in: ['OPEN', 'IN_REVIEW'] },
                ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
              },
              select: {
                id: true,
                status: true,
                category: true,
                workCenterId: true,
                workCenterName: true,
                createdAt: true,
                alert: { select: { message: true } },
              },
              take: limit,
              orderBy: { createdAt: 'desc' },
            })
          : [],
        moduleEnabled('WORK_PERMITS') && workPermitsEnabled && !query.priority
          ? this.prisma.workPermit.findMany({
              where: {
                organizationId,
                status: { in: ['PENDING_APPROVAL', 'AUTHORIZED', 'ACTIVE', 'SUSPENDED'] },
                ...(query.assignedToUserId
                  ? {
                      OR: [
                        {
                          status: 'PENDING_APPROVAL',
                          approverUserId: query.assignedToUserId,
                        },
                        {
                          status: { in: ['AUTHORIZED', 'ACTIVE', 'SUSPENDED'] },
                          requesterUserId: query.assignedToUserId,
                        },
                      ],
                    }
                  : {}),
                ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
                ...(Object.keys(dueFilter).length ? { plannedStartAt: dueFilter } : {}),
              },
              select: {
                id: true,
                activity: true,
                area: true,
                status: true,
                plannedStartAt: true,
                createdAt: true,
                workCenter: { select: { id: true, name: true } },
                requester: { select: { id: true, displayName: true } },
                approver: { select: { id: true, displayName: true } },
                permitTemplateVersion: {
                  select: { permitTemplate: { select: { name: true, isDemo: true } } },
                },
              },
              take: limit,
              orderBy: { createdAt: 'desc' },
            })
          : [],
      ]);

    const items: QueueItem[] = [
      ...actions.map((action) => {
        const snapshot = action.finding.riskMethodSnapshot as { displayName?: string };
        return {
          type: 'CORRECTIVE_ACTION' as const,
          sourceId: action.id,
          organizationId,
          workCenter: action.finding.workCenter,
          title: action.title,
          summary: action.description ?? 'Acción correctiva pendiente de ejecución.',
          status: action.status,
          priority: action.priority,
          dueAt: action.dueAt,
          overdue: Boolean(action.dueAt && action.dueAt < now),
          assignee: action.assignedTo,
          origin: 'Hallazgo de inspección',
          module: 'INSPECTIONS' as const,
          deepLink: `/app/inspections/${action.finding.inspectionId}?finding=${action.finding.id}&action=${action.id}`,
          regulatoryContext: null,
          riskContext: {
            method: snapshot.displayName ?? 'Método de riesgo registrado',
            level: action.finding.initialRiskLevel,
          },
          createdAt: action.createdAt,
        };
      }),
      ...assessments.map((assessment) => {
        const snapshot = assessment.methodSnapshot as { methodName?: string };
        const revision = assessment.reviews[0]?.decision === 'NEEDS_REVISION';
        return {
          type: revision ? ('TECHNICAL_REVISION' as const) : ('TECHNICAL_REVIEW' as const),
          sourceId: assessment.id,
          organizationId,
          workCenter: assessment.workCenter,
          title: assessment.title,
          summary: revision
            ? 'La revisión profesional solicitó ajustes.'
            : 'Evaluación lista para revisión profesional.',
          status: revision ? 'NEEDS_REVISION' : assessment.status,
          priority: 'HIGH' as const,
          dueAt: null,
          overdue: false,
          assignee: null,
          origin: 'Evaluación técnica',
          module: 'TECHNICAL_RISK' as const,
          deepLink: `/app/technical-risk/${assessment.id}`,
          regulatoryContext: null,
          riskContext: {
            method: snapshot.methodName ?? 'Método técnico',
            level: assessment.result?.level ?? null,
          },
          createdAt: assessment.createdAt,
        };
      }),
      ...expertItems.map((item) => ({
        type: 'REGULATORY_EXPERT_REVIEW' as const,
        sourceId: item.id,
        organizationId,
        workCenter: null,
        title: item.requirement.title,
        summary: item.whyMatched,
        status: 'NEEDS_EXPERT_REVIEW',
        priority: 'HIGH' as const,
        dueAt: null,
        overdue: false,
        assignee: null,
        origin: 'Evaluación regulatoria adaptativa',
        module: 'REGULATORY' as const,
        deepLink: `/app/evaluation/expert-review?evaluation=${item.evaluation.id}&item=${item.id}`,
        regulatoryContext: {
          label: `${item.unit.identifier} · ${item.unit.locator}`,
          candidate: item.requirement.editorialStatus !== 'APPROVED_FOR_RULE_DRAFTING',
        },
        riskContext: null,
        createdAt: item.evaluation.createdAt,
      })),
      ...obligations.map((obligation) => ({
        type: 'OBLIGATION_EXECUTION' as const,
        sourceId: obligation.id,
        organizationId,
        workCenter: obligation.workCenter,
        title: obligation.title,
        summary: obligation.description ?? 'Actividad operativa pendiente.',
        status: obligation.status,
        priority: obligation.priority,
        dueAt: obligation.dueAt,
        overdue: Boolean(obligation.dueAt && obligation.dueAt < now),
        assignee: obligation.assignedTo,
        origin: obligation.originType,
        module: 'OPERATIONAL_EXECUTION' as const,
        deepLink: `/app/work/obligations/${obligation.id}`,
        regulatoryContext:
          obligation.requirement || obligation.regulatoryUnit
            ? {
                label:
                  obligation.requirement?.title ??
                  `${obligation.regulatoryUnit?.identifier} · ${obligation.regulatoryUnit?.locator}`,
                candidate: obligation.originType === 'CANDIDATE_REQUIREMENT',
              }
            : null,
        riskContext: null,
        createdAt: obligation.createdAt,
      })),
      ...systemicReviews.map((review) => ({
        type: 'SYSTEMIC_REVIEW' as const,
        sourceId: review.id,
        organizationId,
        workCenter: { id: review.workCenterId, name: review.workCenterName },
        title: `Revisión sistémica: ${review.category}`,
        summary: review.alert.message,
        status: review.status,
        priority: 'HIGH' as const,
        dueAt: null,
        overdue: false,
        assignee: null,
        origin: 'Recurrencia de hallazgos',
        module: 'INSPECTIONS' as const,
        deepLink: `/app/inspections/alerts?systemicReview=${review.id}`,
        regulatoryContext: null,
        riskContext: null,
        createdAt: review.createdAt,
      })),
      ...permits.map((permit) => ({
        type:
          permit.status === 'PENDING_APPROVAL'
            ? ('WORK_PERMIT_APPROVAL' as const)
            : permit.status === 'SUSPENDED'
              ? ('WORK_PERMIT_SUSPENDED' as const)
              : ('WORK_PERMIT_DUE' as const),
        sourceId: permit.id,
        organizationId,
        workCenter: permit.workCenter,
        title: permit.activity,
        summary:
          permit.status === 'PENDING_APPROVAL'
            ? 'Permiso interno pendiente de una autorización separada.'
            : permit.status === 'SUSPENDED'
              ? 'Permiso suspendido; revisa las condiciones antes de continuar.'
              : `Actividad planificada en ${permit.area}.`,
        status: permit.status,
        priority:
          permit.status === 'SUSPENDED' || permit.status === 'PENDING_APPROVAL'
            ? ('HIGH' as const)
            : ('MEDIUM' as const),
        dueAt: permit.plannedStartAt,
        overdue: permit.plannedStartAt < now,
        assignee: permit.status === 'PENDING_APPROVAL' ? permit.approver : permit.requester,
        origin: permit.permitTemplateVersion.permitTemplate.isDemo
          ? 'Plantilla interna demostrativa'
          : 'Plantilla interna',
        module: 'WORK_PERMITS' as const,
        deepLink: `/app/work-permits/${permit.id}`,
        regulatoryContext: null,
        riskContext: null,
        createdAt: permit.createdAt,
      })),
    ];

    items.sort((left, right) => {
      const leftRank = workQueuePriorityRank({
        ...left,
        dueSoon: Boolean(left.dueAt && left.dueAt >= now && left.dueAt <= dueSoonBoundary),
      });
      const rightRank = workQueuePriorityRank({
        ...right,
        dueSoon: Boolean(right.dueAt && right.dueAt >= now && right.dueAt <= dueSoonBoundary),
      });
      return (
        leftRank - rightRank ||
        (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        right.createdAt.getTime() - left.createdAt.getTime() ||
        left.sourceId.localeCompare(right.sourceId)
      );
    });
    const filtered = items.filter((item) => !query.status || item.status === query.status);
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
      generatedAt: now,
    };
  }
}
