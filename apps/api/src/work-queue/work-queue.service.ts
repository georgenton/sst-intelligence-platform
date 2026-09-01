import { Injectable } from '@nestjs/common';
import {
  deriveWorkerCompetencyStatus,
  workQueuePriorityRank,
  type WorkQueueItemType,
  type WorkQueueModule,
} from '@sst/contracts';
import {
  INCIDENTS_FEATURE_KEY,
  PPE_FEATURE_KEY,
  TRAINING_FEATURE_KEY,
  WORK_PERMITS_FEATURE_KEY,
} from '../catalog/entitlement';
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
    const incidentsEnabled = effectiveEntitlements.features[INCIDENTS_FEATURE_KEY] === true;
    const ppeEnabled = effectiveEntitlements.features[PPE_FEATURE_KEY] === true;
    const trainingEnabled = effectiveEntitlements.features[TRAINING_FEATURE_KEY] === true;

    const [
      actions,
      assessments,
      expertItems,
      obligations,
      systemicReviews,
      permits,
      incidentInvestigations,
      incidentActions,
      ppeReplacements,
      ppeConditionReviews,
      trainingRequirements,
      trainingCompletions,
      trainingSessions,
    ] = await Promise.all([
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
      moduleEnabled('INCIDENTS') &&
      incidentsEnabled &&
      !query.assignedToUserId &&
      (!query.priority || query.priority === 'HIGH') &&
      !Object.keys(dueFilter).length
        ? this.prisma.incident.findMany({
            where: {
              organizationId,
              status: { in: ['REPORTED', 'UNDER_INVESTIGATION', 'ACTIONS_IN_PROGRESS'] },
              OR: [
                { investigation: { is: null } },
                { investigation: { is: { status: 'IN_PROGRESS' } } },
              ],
              ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
            },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              createdAt: true,
              workCenter: { select: { id: true, name: true } },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],
      moduleEnabled('INCIDENTS') && incidentsEnabled
        ? this.prisma.incidentAction.findMany({
            where: {
              organizationId,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              ...(query.priority ? { priority: query.priority } : {}),
              ...(query.assignedToUserId ? { ownerUserId: query.assignedToUserId } : {}),
              ...(query.workCenterId ? { incident: { workCenterId: query.workCenterId } } : {}),
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
              owner: { select: { id: true, displayName: true } },
              incident: {
                select: {
                  id: true,
                  title: true,
                  workCenter: { select: { id: true, name: true } },
                },
              },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],
      moduleEnabled('PPE') &&
      ppeEnabled &&
      !query.assignedToUserId &&
      (!query.priority || query.priority === 'HIGH')
        ? this.prisma.ppeIssue.findMany({
            where: {
              organizationId,
              status: { notIn: ['REPLACED', 'RETIRED'] },
              OR: [{ status: 'REPLACEMENT_DUE' }, { expectedReplacementAt: { lte: now } }],
              ...(query.workCenterId ? { worker: { workCenterId: query.workCenterId } } : {}),
              ...(Object.keys(dueFilter).length ? { expectedReplacementAt: dueFilter } : {}),
            },
            select: {
              id: true,
              status: true,
              expectedReplacementAt: true,
              createdAt: true,
              worker: {
                select: {
                  id: true,
                  displayName: true,
                  workCenter: { select: { id: true, name: true } },
                },
              },
              ppeCatalogItem: { select: { name: true } },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],
      moduleEnabled('PPE') &&
      ppeEnabled &&
      !query.assignedToUserId &&
      (!query.priority || query.priority === 'HIGH') &&
      !Object.keys(dueFilter).length
        ? this.prisma.ppeIssue.findMany({
            where: {
              organizationId,
              status: { notIn: ['REPLACED', 'RETIRED'] },
              inspections: { some: {} },
              ...(query.workCenterId ? { worker: { workCenterId: query.workCenterId } } : {}),
            },
            select: {
              id: true,
              createdAt: true,
              worker: {
                select: {
                  id: true,
                  displayName: true,
                  workCenter: { select: { id: true, name: true } },
                },
              },
              ppeCatalogItem: { select: { name: true } },
              inspections: {
                select: { id: true, condition: true, note: true, createdAt: true },
                orderBy: { inspectedAt: 'desc' },
                take: 1,
              },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],
      moduleEnabled('TRAINING') &&
      trainingEnabled &&
      !query.assignedToUserId &&
      (!query.priority || query.priority === 'HIGH' || query.priority === 'MEDIUM')
        ? this.prisma.workerCompetencyRequirement.findMany({
            where: {
              organizationId,
              status: 'REQUIRED',
              ...(query.workCenterId ? { worker: { workCenterId: query.workCenterId } } : {}),
              ...(Object.keys(dueFilter).length ? { requiredByDate: dueFilter } : {}),
            },
            select: {
              id: true,
              reason: true,
              requiredByDate: true,
              status: true,
              createdAt: true,
              worker: {
                select: {
                  id: true,
                  displayName: true,
                  workCenter: { select: { id: true, name: true } },
                },
              },
              trainingDefinition: { select: { title: true } },
              linkedRegulatoryRequirement: {
                select: { title: true, editorialStatus: true },
              },
              linkedAssessment: {
                select: {
                  methodSnapshot: true,
                  result: { select: { level: true } },
                },
              },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],
      moduleEnabled('TRAINING') &&
      trainingEnabled &&
      !query.assignedToUserId &&
      (!query.priority || query.priority === 'HIGH' || query.priority === 'MEDIUM')
        ? this.prisma.workerTrainingCompletion.findMany({
            where: {
              organizationId,
              ...(query.workCenterId ? { worker: { workCenterId: query.workCenterId } } : {}),
            },
            select: {
              id: true,
              completedAt: true,
              validUntil: true,
              createdAt: true,
              trainingDefinitionId: true,
              workerId: true,
              worker: {
                select: {
                  id: true,
                  displayName: true,
                  workCenter: { select: { id: true, name: true } },
                },
              },
              trainingDefinition: { select: { title: true } },
              requirement: {
                select: {
                  linkedRegulatoryRequirement: {
                    select: { title: true, editorialStatus: true },
                  },
                  linkedAssessment: {
                    select: {
                      methodSnapshot: true,
                      result: { select: { level: true } },
                    },
                  },
                },
              },
            },
            take: limit,
            orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
          })
        : [],
      moduleEnabled('TRAINING') &&
      trainingEnabled &&
      !query.assignedToUserId &&
      (!query.priority || query.priority === 'HIGH')
        ? this.prisma.trainingSession.findMany({
            where: {
              organizationId,
              status: 'SCHEDULED',
              scheduledEnd: Object.keys(dueFilter).length ? dueFilter : { lt: now },
              ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
            },
            select: {
              id: true,
              status: true,
              scheduledEnd: true,
              createdAt: true,
              workCenter: { select: { id: true, name: true } },
              trainingDefinition: { select: { title: true } },
              _count: { select: { participants: true, completions: true } },
            },
            take: limit,
            orderBy: { scheduledEnd: 'asc' },
          })
        : [],
    ]);

    const latestTrainingCompletions = trainingCompletions
      .filter(
        (completion, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.workerId === completion.workerId &&
              candidate.trainingDefinitionId === completion.trainingDefinitionId,
          ) === index,
      )
      .filter((completion) => {
        const status = deriveWorkerCompetencyStatus({
          completionExists: true,
          validUntil: completion.validUntil,
          now,
        });
        if (status !== 'DUE_SOON' && status !== 'EXPIRED') return false;
        if (!completion.validUntil) return false;
        if (query.dueFrom && completion.validUntil < new Date(query.dueFrom)) return false;
        if (query.dueTo && completion.validUntil > new Date(query.dueTo)) return false;
        return true;
      });

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
      ...incidentInvestigations.map((incident) => ({
        type: 'INCIDENT_INVESTIGATION' as const,
        sourceId: incident.id,
        organizationId,
        workCenter: incident.workCenter,
        title: incident.title,
        summary:
          incident.status === 'REPORTED'
            ? 'Incidente reportado pendiente de iniciar investigación.'
            : 'Investigación de incidente pendiente de conclusión profesional.',
        status: incident.status,
        priority: 'HIGH' as const,
        dueAt: null,
        overdue: false,
        assignee: null,
        origin: 'Gestión de incidentes',
        module: 'INCIDENTS' as const,
        deepLink: `/app/incidents/${incident.id}`,
        regulatoryContext: null,
        riskContext: null,
        createdAt: incident.createdAt,
      })),
      ...incidentActions.map((action) => ({
        type: 'INCIDENT_ACTION' as const,
        sourceId: action.id,
        organizationId,
        workCenter: action.incident.workCenter,
        title: action.title,
        summary: action.description ?? `Acción asociada a ${action.incident.title}.`,
        status: action.status,
        priority: action.priority,
        dueAt: action.dueAt,
        overdue: Boolean(action.dueAt && action.dueAt < now),
        assignee: action.owner,
        origin: 'Acción de incidente',
        module: 'INCIDENTS' as const,
        deepLink: `/app/incidents/${action.incident.id}?action=${action.id}`,
        regulatoryContext: null,
        riskContext: null,
        createdAt: action.createdAt,
      })),
      ...ppeReplacements.map((issue) => ({
        type: 'PPE_REPLACEMENT_DUE' as const,
        sourceId: issue.id,
        organizationId,
        workCenter: issue.worker.workCenter,
        title: `${issue.ppeCatalogItem.name} · ${issue.worker.displayName}`,
        summary: 'El elemento de EPP requiere reemplazo y su entrega histórica se conservará.',
        status: 'REPLACEMENT_DUE',
        priority: 'HIGH' as const,
        dueAt: issue.expectedReplacementAt,
        overdue: Boolean(issue.expectedReplacementAt && issue.expectedReplacementAt < now),
        assignee: null,
        origin: 'Gestión de EPP',
        module: 'PPE' as const,
        deepLink: `/app/workers/${issue.worker.id}#epp-issue-${issue.id}`,
        regulatoryContext: null,
        riskContext: null,
        createdAt: issue.createdAt,
      })),
      ...ppeConditionReviews
        .filter((issue) => issue.inspections[0]?.condition === 'REVIEW_REQUIRED')
        .map((issue) => ({
          type: 'PPE_CONDITION_REVIEW' as const,
          sourceId: issue.inspections[0]!.id,
          organizationId,
          workCenter: issue.worker.workCenter,
          title: `${issue.ppeCatalogItem.name} · ${issue.worker.displayName}`,
          summary:
            issue.inspections[0]!.note ?? 'La condición registrada requiere revisión profesional.',
          status: issue.inspections[0]!.condition,
          priority: 'HIGH' as const,
          dueAt: null,
          overdue: false,
          assignee: null,
          origin: 'Inspección de EPP',
          module: 'PPE' as const,
          deepLink: `/app/workers/${issue.worker.id}#epp-issue-${issue.id}`,
          regulatoryContext: null,
          riskContext: null,
          createdAt: issue.inspections[0]!.createdAt,
        })),
      ...trainingRequirements
        .map((requirement) => {
          const overdue = Boolean(
            requirement.requiredByDate && requirement.requiredByDate.getTime() < now.getTime(),
          );
          const snapshot = requirement.linkedAssessment?.methodSnapshot as
            { displayName?: string } | undefined;
          return {
            type: 'TRAINING_REQUIRED' as const,
            sourceId: requirement.id,
            organizationId,
            workCenter: requirement.worker.workCenter,
            title: `${requirement.trainingDefinition.title} · ${requirement.worker.displayName}`,
            summary: requirement.reason,
            status: requirement.status,
            priority: overdue ? ('HIGH' as const) : ('MEDIUM' as const),
            dueAt: requirement.requiredByDate,
            overdue,
            assignee: null,
            origin: 'Requisito profesional de capacitación',
            module: 'TRAINING' as const,
            deepLink: `/app/workers/${requirement.worker.id}#training-requirement-${requirement.id}`,
            regulatoryContext: requirement.linkedRegulatoryRequirement
              ? {
                  label: requirement.linkedRegulatoryRequirement.title,
                  candidate:
                    requirement.linkedRegulatoryRequirement.editorialStatus !==
                    'APPROVED_FOR_RULE_DRAFTING',
                }
              : null,
            riskContext: requirement.linkedAssessment
              ? {
                  method: snapshot?.displayName ?? 'Método de riesgo registrado',
                  level: requirement.linkedAssessment.result?.level ?? null,
                }
              : null,
            createdAt: requirement.createdAt,
          };
        })
        .filter((item) => !query.priority || item.priority === query.priority),
      ...latestTrainingCompletions
        .map((completion) => {
          const status = deriveWorkerCompetencyStatus({
            completionExists: true,
            validUntil: completion.validUntil,
            now,
          });
          const regulatoryRequirement = completion.requirement?.linkedRegulatoryRequirement;
          const assessment = completion.requirement?.linkedAssessment;
          const snapshot = assessment?.methodSnapshot as { displayName?: string } | undefined;
          return {
            type: 'TRAINING_DUE' as const,
            sourceId: completion.id,
            organizationId,
            workCenter: completion.worker.workCenter,
            title: `${completion.trainingDefinition.title} · ${completion.worker.displayName}`,
            summary:
              status === 'EXPIRED'
                ? 'La vigencia operativa registrada expiró; evalúa una renovación.'
                : 'La vigencia operativa registrada se aproxima a su fecha de renovación.',
            status,
            priority: status === 'EXPIRED' ? ('HIGH' as const) : ('MEDIUM' as const),
            dueAt: completion.validUntil,
            overdue: status === 'EXPIRED',
            assignee: null,
            origin: 'Vigencia de capacitación',
            module: 'TRAINING' as const,
            deepLink: `/app/workers/${completion.worker.id}#training-completion-${completion.id}`,
            regulatoryContext: regulatoryRequirement
              ? {
                  label: regulatoryRequirement.title,
                  candidate: regulatoryRequirement.editorialStatus !== 'APPROVED_FOR_RULE_DRAFTING',
                }
              : null,
            riskContext: assessment
              ? {
                  method: snapshot?.displayName ?? 'Método de riesgo registrado',
                  level: assessment.result?.level ?? null,
                }
              : null,
            createdAt: completion.createdAt,
          };
        })
        .filter((item) => !query.priority || item.priority === query.priority),
      ...trainingSessions.map((session) => ({
        type: 'TRAINING_SESSION_FOLLOW_UP' as const,
        sourceId: session.id,
        organizationId,
        workCenter: session.workCenter,
        title: session.trainingDefinition.title,
        summary: `La sesión terminó con ${session._count.participants} participante(s) y ${session._count.completions} completitud(es) registradas.`,
        status: session.status,
        priority: 'HIGH' as const,
        dueAt: session.scheduledEnd,
        overdue: session.scheduledEnd < now,
        assignee: null,
        origin: 'Seguimiento de sesión de capacitación',
        module: 'TRAINING' as const,
        deepLink: `/app/training/sessions/${session.id}`,
        regulatoryContext: null,
        riskContext: null,
        createdAt: session.createdAt,
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
