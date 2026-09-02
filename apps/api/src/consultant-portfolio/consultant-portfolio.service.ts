import { Injectable, NotFoundException } from '@nestjs/common';
import {
  portfolioDueState,
  workQueuePriorityRank,
  type PortfolioDueState,
  type PortfolioQuery,
  type PortfolioWorkType,
} from '@sst/contracts';
import { INCIDENTS_FEATURE_KEY, WORK_PERMITS_FEATURE_KEY } from '../catalog/entitlement';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';

type OrganizationAccess = {
  id: string;
  name: string;
  country: string;
  sector: string | null;
  status: string;
  role: string;
  workCenterCount: number;
  features: Record<string, boolean | number | string>;
};

export type PortfolioWorkItem = {
  type: PortfolioWorkType;
  sourceId: string;
  organizationId: string;
  organizationName: string;
  title: string;
  summary: string;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: Date | null;
  dueState: 'NO_DUE' | 'OVERDUE' | 'DUE_SOON' | 'FUTURE';
  assignee: { id: string; displayName: string } | null;
  sourceObject: { type: string; id: string };
  deepLink: string;
  createdAt: Date;
};

type CountRow = { organizationId: string; _count: { _all: number } };

@Injectable()
export class ConsultantPortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async authorizedOrganizationSet(userId: string): Promise<OrganizationAccess[]> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { status: { in: ['ACTIVE', 'DEMO'] } },
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            country: true,
            sector: true,
            status: true,
            _count: { select: { workCenters: { where: { isActive: true } } } },
          },
        },
      },
      orderBy: [{ organization: { name: 'asc' } }, { organizationId: 'asc' }],
    });
    const entitlements = await this.entitlements.effectiveMany(
      memberships.map(({ organization }) => organization.id),
    );
    return memberships.map(({ role, organization }) => ({
      id: organization.id,
      name: organization.name,
      country: organization.country,
      sector: organization.sector,
      status: organization.status,
      role,
      workCenterCount: organization._count.workCenters,
      features: entitlements.get(organization.id)?.features ?? {},
    }));
  }

  async get(userId: string, rawQuery: Partial<PortfolioQuery> = {}) {
    const query: PortfolioQuery = {
      attention: rawQuery.attention ?? 'ALL',
      dueState: rawQuery.dueState ?? 'ALL',
      page: rawQuery.page ?? 1,
      pageSize: rawQuery.pageSize ?? 20,
      ...rawQuery,
    };
    const authorized = await this.authorizedOrganizationSet(userId);
    const search = query.search
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const scoped = authorized.filter((organization) => {
      if (query.organizationId && organization.id !== query.organizationId) return false;
      if (!search) return true;
      return [organization.name, organization.country, organization.sector, organization.role]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .includes(search),
        );
    });
    const organizationIds = scoped.map(({ id }) => id);
    if (!organizationIds.length) return this.emptyPortfolio(authorized.length, query);
    const organizationById = new Map(scoped.map((organization) => [organization.id, organization]));
    const [work, signals, evidence, recentIncidents] = await Promise.all([
      this.work(organizationIds, organizationById, query.dueState, query.workType),
      this.signals(organizationIds, organizationById, query.signalType),
      this.evidence(organizationIds, organizationById),
      this.recentIncidentCounts(organizationIds, organizationById),
    ]);
    const cards = scoped.map((organization) => {
      const actionableWorkCount = work.counts.get(organization.id) ?? 0;
      const overdueActionableWorkCount = work.overdueCounts.get(organization.id) ?? 0;
      const activeSignalCount = signals.counts.get(organization.id) ?? 0;
      const evidenceState = evidence.counts.get(organization.id) ?? {
        draft: 0,
        finalized: 0,
        archived: 0,
      };
      const needsAttentionCount =
        overdueActionableWorkCount + activeSignalCount + evidenceState.draft;
      return {
        organization: {
          id: organization.id,
          name: organization.name,
          country: organization.country,
          sector: organization.sector,
          status: organization.status,
        },
        currentRole: organization.role,
        workCenterCount: organization.workCenterCount,
        needsAttention: needsAttentionCount > 0,
        needsAttentionCount,
        actionableWorkCount,
        overdueActionableWorkCount,
        activeSignalCount,
        evidencePackages: evidenceState,
        recentIncidentCount: recentIncidents.get(organization.id) ?? null,
        language:
          needsAttentionCount > 0 ? 'Necesita atención' : 'Sin pendientes críticos registrados',
      };
    });
    const filteredCards = cards.filter((card) => {
      if (query.attention === 'NEEDS_ATTENTION') return card.needsAttention;
      if (query.attention === 'NO_CRITICAL_PENDING') return !card.needsAttention;
      return true;
    });
    const visibleIds = new Set(filteredCards.map(({ organization }) => organization.id));
    const visibleWork = work.items.filter(({ organizationId }) => visibleIds.has(organizationId));
    const visibleSignals = signals.items.filter(({ organizationId }) =>
      visibleIds.has(organizationId),
    );
    const visibleEvidence = evidence.items.filter(({ organizationId }) =>
      visibleIds.has(organizationId),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      context: 'PORTFOLIO_READ_ONLY',
      generatedAt: new Date(),
      authorization: {
        source: 'CURRENT_ACTIVE_MEMBERSHIPS',
        perOrganizationRole: true,
        perOrganizationEntitlements: true,
        requestedOrganizationIntersected: Boolean(query.organizationId),
      },
      summary: {
        authorizedOrganizations: authorized.length,
        visibleOrganizations: filteredCards.length,
        organizationsRequiringAttention: filteredCards.filter(
          ({ needsAttention }) => needsAttention,
        ).length,
        totalActionableWork: filteredCards.reduce((sum, card) => sum + card.actionableWorkCount, 0),
        totalOverdueWork: filteredCards.reduce(
          (sum, card) => sum + card.overdueActionableWorkCount,
          0,
        ),
        openOperationalSignals: filteredCards.reduce(
          (sum, card) => sum + card.activeSignalCount,
          0,
        ),
        evidencePackagesRequiringWork: filteredCards.reduce(
          (sum, card) => sum + card.evidencePackages.draft,
          0,
        ),
        organizationSafetyScore: null,
        ranking: 'DETERMINISTIC_OPERATIONAL_ORDER_ONLY',
      },
      organizations: filteredCards,
      work: {
        items: visibleWork.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        total: visibleWork.length,
        sourceTotal: filteredCards.reduce((sum, card) => sum + card.actionableWorkCount, 0),
        boundedResult: true,
      },
      signals: visibleSignals,
      evidence: visibleEvidence,
      boundaries: {
        complianceConclusion: false,
        organizationSafetyScore: false,
        workerSafetyScore: false,
        automaticRootCause: false,
      },
    };
  }

  async organization(userId: string, organizationId: string) {
    const portfolio = await this.get(userId, { organizationId, pageSize: 50 });
    const organization = portfolio.organizations[0];
    if (!organization) throw new NotFoundException('Organización no disponible en tu portafolio.');
    return portfolio;
  }

  private async work(
    organizationIds: string[],
    organizationById: Map<string, OrganizationAccess>,
    dueFilter: PortfolioDueState,
    typeFilter?: PortfolioWorkType,
  ) {
    const now = new Date();
    const inspectionsIds = organizationIds.filter(
      (id) => organizationById.get(id)?.features['module.inspections'] === true,
    );
    const incidentIds = organizationIds.filter(
      (id) => organizationById.get(id)?.features[INCIDENTS_FEATURE_KEY] === true,
    );
    const permitIds = organizationIds.filter(
      (id) => organizationById.get(id)?.features[WORK_PERMITS_FEATURE_KEY] === true,
    );
    const [
      correctiveActions,
      incidentActions,
      obligations,
      governanceActions,
      permits,
      operationalSignals,
      correctiveCounts,
      incidentCounts,
      obligationCounts,
      governanceCounts,
      permitCounts,
      signalCounts,
      correctiveOverdue,
      incidentOverdue,
      obligationOverdue,
      governanceOverdue,
      permitOverdue,
    ] = await Promise.all([
      this.prisma.correctiveAction.findMany({
        where: {
          organizationId: { in: inspectionsIds },
          status: { notIn: ['COMPLETED', 'CANCELED'] },
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          createdAt: true,
          assignedTo: { select: { id: true, displayName: true } },
          finding: { select: { id: true, inspectionId: true } },
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.incidentAction.findMany({
        where: {
          organizationId: { in: incidentIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          createdAt: true,
          owner: { select: { id: true, displayName: true } },
          incident: { select: { id: true, title: true } },
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.obligationExecution.findMany({
        where: {
          organizationId: { in: organizationIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          createdAt: true,
          assignedTo: { select: { id: true, displayName: true } },
          originType: true,
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.governanceAction.findMany({
        where: {
          organizationId: { in: organizationIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          createdAt: true,
          assignedToMembership: {
            select: { user: { select: { id: true, displayName: true } } },
          },
          decision: { select: { meeting: { select: { id: true } } } },
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.workPermit.findMany({
        where: {
          organizationId: { in: permitIds },
          status: { in: ['PENDING_APPROVAL', 'AUTHORIZED', 'ACTIVE', 'SUSPENDED'] },
        },
        select: {
          id: true,
          organizationId: true,
          activity: true,
          area: true,
          status: true,
          plannedStartAt: true,
          createdAt: true,
          requester: { select: { id: true, displayName: true } },
          approver: { select: { id: true, displayName: true } },
        },
        orderBy: [{ plannedStartAt: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.operationalSignal.findMany({
        where: { organizationId: { in: organizationIds }, status: 'ACTIVE', attention: 'REVIEW' },
        select: {
          id: true,
          organizationId: true,
          title: true,
          explanation: true,
          status: true,
          type: true,
          ruleKey: true,
          lastDetectedAt: true,
        },
        orderBy: [{ lastDetectedAt: 'desc' }, { id: 'asc' }],
        take: 500,
      }),
      this.countCorrective(inspectionsIds),
      this.countIncidentActions(incidentIds),
      this.countObligations(organizationIds),
      this.countGovernanceActions(organizationIds),
      this.countPermits(permitIds),
      this.countSignals(organizationIds),
      this.countCorrective(inspectionsIds, now),
      this.countIncidentActions(incidentIds, now),
      this.countObligations(organizationIds, now),
      this.countGovernanceActions(organizationIds, now),
      this.countPermits(permitIds, now),
    ]);
    const named = (organizationId: string) => organizationById.get(organizationId)!.name;
    const items: PortfolioWorkItem[] = [
      ...correctiveActions.map((item) => ({
        type: 'CORRECTIVE_ACTION' as const,
        sourceId: item.id,
        organizationId: item.organizationId,
        organizationName: named(item.organizationId),
        title: item.title,
        summary: item.description ?? 'Acción correctiva pendiente de ejecución.',
        status: item.status,
        priority: item.priority,
        dueAt: item.dueAt,
        dueState: portfolioDueState({ dueAt: item.dueAt, now }),
        assignee: item.assignedTo,
        sourceObject: { type: 'CorrectiveAction', id: item.id },
        deepLink: `/app/inspections/${item.finding.inspectionId}?finding=${item.finding.id}&action=${item.id}`,
        createdAt: item.createdAt,
      })),
      ...incidentActions.map((item) => ({
        type: 'INCIDENT_ACTION' as const,
        sourceId: item.id,
        organizationId: item.organizationId,
        organizationName: named(item.organizationId),
        title: item.title,
        summary: item.description ?? `Acción asociada a ${item.incident.title}.`,
        status: item.status,
        priority: item.priority,
        dueAt: item.dueAt,
        dueState: portfolioDueState({ dueAt: item.dueAt, now }),
        assignee: item.owner,
        sourceObject: { type: 'IncidentAction', id: item.id },
        deepLink: `/app/incidents/${item.incident.id}?action=${item.id}`,
        createdAt: item.createdAt,
      })),
      ...obligations.map((item) => ({
        type: 'OBLIGATION_EXECUTION' as const,
        sourceId: item.id,
        organizationId: item.organizationId,
        organizationName: named(item.organizationId),
        title: item.title,
        summary: item.description ?? 'Actividad operativa pendiente.',
        status: item.status,
        priority: item.priority,
        dueAt: item.dueAt,
        dueState: portfolioDueState({ dueAt: item.dueAt, now }),
        assignee: item.assignedTo,
        sourceObject: { type: 'ObligationExecution', id: item.id },
        deepLink: `/app/work/obligations/${item.id}`,
        createdAt: item.createdAt,
      })),
      ...governanceActions.map((item) => ({
        type: 'GOVERNANCE_ACTION' as const,
        sourceId: item.id,
        organizationId: item.organizationId,
        organizationName: named(item.organizationId),
        title: item.title,
        summary: item.description ?? 'Compromiso pendiente de una decisión registrada.',
        status: item.status,
        priority: item.priority,
        dueAt: item.dueAt,
        dueState: portfolioDueState({ dueAt: item.dueAt, now }),
        assignee: item.assignedToMembership?.user ?? null,
        sourceObject: { type: 'GovernanceAction', id: item.id },
        deepLink: `/app/governance?meeting=${item.decision.meeting.id}&action=${item.id}`,
        createdAt: item.createdAt,
      })),
      ...permits.map((item) => ({
        type:
          item.status === 'PENDING_APPROVAL'
            ? ('WORK_PERMIT_APPROVAL' as const)
            : item.status === 'SUSPENDED'
              ? ('WORK_PERMIT_SUSPENDED' as const)
              : ('WORK_PERMIT_DUE' as const),
        sourceId: item.id,
        organizationId: item.organizationId,
        organizationName: named(item.organizationId),
        title: item.activity,
        summary: `Actividad planificada en ${item.area}.`,
        status: item.status,
        priority:
          item.status === 'SUSPENDED' || item.status === 'PENDING_APPROVAL'
            ? ('HIGH' as const)
            : ('MEDIUM' as const),
        dueAt: item.plannedStartAt,
        dueState: portfolioDueState({ dueAt: item.plannedStartAt, now }),
        assignee: item.status === 'PENDING_APPROVAL' ? item.approver : item.requester,
        sourceObject: { type: 'WorkPermit', id: item.id },
        deepLink: `/app/work-permits/${item.id}`,
        createdAt: item.createdAt,
      })),
      ...operationalSignals.map((item) => ({
        type: 'OPERATIONAL_SIGNAL' as const,
        sourceId: item.id,
        organizationId: item.organizationId,
        organizationName: named(item.organizationId),
        title: item.title,
        summary: item.explanation,
        status: item.status,
        priority: 'HIGH' as const,
        dueAt: null,
        dueState: 'NO_DUE' as const,
        assignee: null,
        sourceObject: { type: 'OperationalSignal', id: item.id },
        deepLink: `/app/intelligence?signal=${item.id}`,
        createdAt: item.lastDetectedAt,
      })),
    ];
    const filtered = items.filter((item) => {
      if (typeFilter && item.type !== typeFilter) return false;
      if (dueFilter !== 'ALL' && item.dueState !== dueFilter) return false;
      return true;
    });
    filtered.sort((left, right) => {
      const leftRank = workQueuePriorityRank({
        priority: left.priority,
        overdue: left.dueState === 'OVERDUE',
        dueSoon: left.dueState === 'DUE_SOON',
        status: left.status,
        type: left.type,
      });
      const rightRank = workQueuePriorityRank({
        priority: right.priority,
        overdue: right.dueState === 'OVERDUE',
        dueSoon: right.dueState === 'DUE_SOON',
        status: right.status,
        type: right.type,
      });
      return (
        leftRank - rightRank ||
        (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        left.organizationName.localeCompare(right.organizationName) ||
        left.sourceId.localeCompare(right.sourceId)
      );
    });
    return {
      items: filtered,
      counts: this.mergeCounts([
        correctiveCounts,
        incidentCounts,
        obligationCounts,
        governanceCounts,
        permitCounts,
        signalCounts,
      ]),
      overdueCounts: this.mergeCounts([
        correctiveOverdue,
        incidentOverdue,
        obligationOverdue,
        governanceOverdue,
        permitOverdue,
      ]),
    };
  }

  private async signals(
    organizationIds: string[],
    organizationById: Map<string, OrganizationAccess>,
    signalType?: 'REPEATED_FINDING' | 'OVERDUE_ACTION_CLUSTER',
  ) {
    const [items, counts] = await Promise.all([
      this.prisma.operationalSignal.findMany({
        where: {
          organizationId: { in: organizationIds },
          status: 'ACTIVE',
          ...(signalType ? { type: signalType } : {}),
        },
        select: {
          id: true,
          organizationId: true,
          type: true,
          title: true,
          explanation: true,
          attention: true,
          ruleKey: true,
          ruleVersion: true,
          threshold: true,
          observedCount: true,
          windowStart: true,
          windowEnd: true,
          lastDetectedAt: true,
          workCenter: { select: { id: true, name: true } },
        },
        orderBy: [{ lastDetectedAt: 'desc' }, { id: 'asc' }],
        take: 500,
      }),
      this.prisma.operationalSignal.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: organizationIds }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        organizationName: organizationById.get(item.organizationId)!.name,
        deepLink: `/app/intelligence?signal=${item.id}`,
        meaning: 'Umbral operativo de plataforma; no representa una regla legal.',
      })),
      counts: this.countMap(counts),
    };
  }

  private async evidence(
    organizationIds: string[],
    organizationById: Map<string, OrganizationAccess>,
  ) {
    const [grouped, items] = await Promise.all([
      this.prisma.evidencePackage.groupBy({
        by: ['organizationId', 'status'],
        where: { organizationId: { in: organizationIds } },
        _count: { _all: true },
      }),
      this.prisma.evidencePackage.findMany({
        where: { organizationId: { in: organizationIds } },
        select: {
          id: true,
          organizationId: true,
          title: true,
          scope: true,
          status: true,
          version: true,
          generatedAt: true,
          finalizedAt: true,
          createdAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 200,
      }),
    ]);
    const counts = new Map<string, { draft: number; finalized: number; archived: number }>();
    for (const row of grouped) {
      const current = counts.get(row.organizationId) ?? { draft: 0, finalized: 0, archived: 0 };
      current[row.status.toLowerCase() as 'draft' | 'finalized' | 'archived'] = row._count._all;
      counts.set(row.organizationId, current);
    }
    return {
      counts,
      items: items.map((item) => ({
        ...item,
        organizationName: organizationById.get(item.organizationId)!.name,
        deepLink: `/app/evidence-packages?package=${item.id}`,
        certificationClaimed: false,
      })),
    };
  }

  private async recentIncidentCounts(
    organizationIds: string[],
    organizationById: Map<string, OrganizationAccess>,
  ) {
    const entitledIds = organizationIds.filter(
      (id) => organizationById.get(id)?.features[INCIDENTS_FEATURE_KEY] === true,
    );
    const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000);
    const counts = await this.prisma.incident.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: entitledIds }, occurredAt: { gte: windowStart } },
      _count: { _all: true },
    });
    return this.countMap(counts);
  }

  private countCorrective(organizationIds: string[], overdueBefore?: Date) {
    return this.prisma.correctiveAction.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizationIds },
        status: { notIn: ['COMPLETED', 'CANCELED'] },
        ...(overdueBefore ? { dueAt: { lt: overdueBefore } } : {}),
      },
      _count: { _all: true },
    });
  }

  private countIncidentActions(organizationIds: string[], overdueBefore?: Date) {
    return this.prisma.incidentAction.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizationIds },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(overdueBefore ? { dueAt: { lt: overdueBefore } } : {}),
      },
      _count: { _all: true },
    });
  }

  private countObligations(organizationIds: string[], overdueBefore?: Date) {
    return this.prisma.obligationExecution.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizationIds },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(overdueBefore ? { dueAt: { lt: overdueBefore } } : {}),
      },
      _count: { _all: true },
    });
  }

  private countGovernanceActions(organizationIds: string[], overdueBefore?: Date) {
    return this.prisma.governanceAction.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizationIds },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(overdueBefore ? { dueAt: { lt: overdueBefore } } : {}),
      },
      _count: { _all: true },
    });
  }

  private countPermits(organizationIds: string[], overdueBefore?: Date) {
    return this.prisma.workPermit.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizationIds },
        status: { in: ['PENDING_APPROVAL', 'AUTHORIZED', 'ACTIVE', 'SUSPENDED'] },
        ...(overdueBefore ? { plannedStartAt: { lt: overdueBefore } } : {}),
      },
      _count: { _all: true },
    });
  }

  private countSignals(organizationIds: string[]) {
    return this.prisma.operationalSignal.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: organizationIds }, status: 'ACTIVE', attention: 'REVIEW' },
      _count: { _all: true },
    });
  }

  private countMap(rows: CountRow[]) {
    return new Map(rows.map(({ organizationId, _count }) => [organizationId, _count._all]));
  }

  private mergeCounts(groups: CountRow[][]) {
    const merged = new Map<string, number>();
    for (const rows of groups) {
      for (const { organizationId, _count } of rows) {
        merged.set(organizationId, (merged.get(organizationId) ?? 0) + _count._all);
      }
    }
    return merged;
  }

  private emptyPortfolio(authorizedOrganizations: number, query: PortfolioQuery) {
    return {
      context: 'PORTFOLIO_READ_ONLY',
      generatedAt: new Date(),
      authorization: {
        source: 'CURRENT_ACTIVE_MEMBERSHIPS',
        perOrganizationRole: true,
        perOrganizationEntitlements: true,
        requestedOrganizationIntersected: Boolean(query.organizationId),
      },
      summary: {
        authorizedOrganizations,
        visibleOrganizations: 0,
        organizationsRequiringAttention: 0,
        totalActionableWork: 0,
        totalOverdueWork: 0,
        openOperationalSignals: 0,
        evidencePackagesRequiringWork: 0,
        organizationSafetyScore: null,
        ranking: 'DETERMINISTIC_OPERATIONAL_ORDER_ONLY',
      },
      organizations: [],
      work: {
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        sourceTotal: 0,
        boundedResult: true,
      },
      signals: [],
      evidence: [],
      boundaries: {
        complianceConclusion: false,
        organizationSafetyScore: false,
        workerSafetyScore: false,
        automaticRootCause: false,
      },
    };
  }
}
