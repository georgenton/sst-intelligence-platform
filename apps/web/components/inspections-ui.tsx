'use client';

import { ApiClientError } from '@sst/api-client';
import type { FindingCategory } from '@sst/contracts';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  actionPrimaryLabel,
  actionPrimaryStep,
  actionProgressMeta,
  alertTypeLabel,
  apiQuery,
  canAcknowledgeInspectionAlerts,
  canCompleteCorrectiveAction,
  canVerifyFindings,
  canWriteInspections,
  filterSearchParams,
  statusMeta,
  type InspectionFilters,
} from '@/lib/inspection-experience';
import { queryKeys } from '@/lib/query-keys';
import {
  AUTHORIZED_TECHNICAL_REVIEWER_LABELS,
  AUTHORIZED_TECHNICAL_WRITER_LABELS,
  humanRoleLabel,
} from '@/lib/human-lexicon';
import { presentInspectionRiskMethod } from '@/lib/risk-method-presentation';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ActiveFilters,
  ContextLine,
  DomainStatusBadge,
  EntitlementState,
  InlineRequestState,
  InspectionDemoNotice,
  InspectionDialog,
  InspectionPageHeader,
  InspectionRiskBadge,
  InspectionSkeleton,
  InspectionState,
  PermissionState,
  QuestionScale,
} from './inspection-experience-ui';
import { useDashboardData } from './use-app-data';
import { TechnicalDetails } from './technical-details';

type ContextData = {
  workCenters: Array<{
    id: string;
    name: string;
    city?: string;
    isDemo: boolean;
    workAreas: Array<{ id: string; name: string }>;
  }>;
  members: Array<{ id: string; displayName: string; role: string }>;
};

type ActionEvidence = {
  id: string;
  type: 'NOTE' | 'EXTERNAL_LINK';
  note?: string;
  externalUrl?: string;
  createdAt?: string;
};

type Action = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  overdue: boolean;
  assignedToUserId?: string;
  assignedTo?: { id: string; displayName: string };
  verifiedBy?: { id: string; displayName: string };
  verificationBasis?: 'RECORDED_EVIDENCE' | 'FIELD_OBSERVATION' | 'OTHER_JUSTIFIED';
  verificationNote?: string;
  selfVerification?: boolean;
  selfVerificationAcknowledged?: boolean;
  evidence: ActionEvidence[];
};

type Finding = {
  id: string;
  title: string;
  description: string;
  category: FindingCategory;
  status: string;
  initialLikelihood: number;
  initialConsequence: number;
  initialScore: number;
  initialRiskLevel: string;
  residualLikelihood?: number;
  residualConsequence?: number;
  residualScore?: number;
  residualRiskLevel?: string;
  riskMethodKey?: string;
  riskMethodVersion?: string;
  recurrenceCount: number;
  recurrenceStatus: string;
  createdAt?: string;
  workCenter?: { id?: string; name: string };
  workArea?: { id?: string; name: string };
  inspection?: { id: string; title: string; status: string; isDemo: boolean };
  actions: Action[];
  alerts?: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    message: string;
    acknowledgedAt?: string;
    acknowledgedBy?: { id: string; displayName: string };
    systemicReview?: { id: string; status: string };
  }>;
  recurrence?: {
    previousCount: number;
    windowDays: number;
    previous: Array<{
      id: string;
      inspectionId: string;
      title: string;
      createdAt: string;
      status: string;
    }>;
  };
};

type Inspection = {
  id: string;
  title: string;
  description?: string;
  status: string;
  scheduledFor?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  isDemo: boolean;
  workCenter: { id: string; name: string; city?: string };
  workArea?: { id: string; name: string };
  inspector?: { id: string; displayName: string };
  findings?: Finding[];
  overdueActions?: number;
};

type CreatedFinding = Finding & { recurrenceWindowDays: number };

type Analytics = {
  totalInspections: number;
  openFindings: number;
  highCriticalFindings: number;
  overdueActions: number;
  recurrenceAlerts: number;
  averageDaysOpen: number;
  percentageClosed: number;
  findingsByCategory: Array<{ category: FindingCategory; count: number }>;
  findingsByWorkCenter: Array<{ workCenterId: string; name: string; count: number }>;
  findingsByRiskLevel: Array<{ riskLevel: string; count: number }>;
  initialVsResidual: {
    initial: Array<{ riskLevel: string; count: number }>;
    residual: Array<{ riskLevel: string | null; count: number }>;
  };
};

type InspectionList = { items: Inspection[]; total: number; page: number; pageSize: number };
type AlertList = {
  items: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    message: string;
    createdAt?: string;
    acknowledgedAt?: string;
    acknowledgedBy?: { id: string; displayName: string };
    systemicReview?: { id: string; status: string };
    finding: {
      id: string;
      title: string;
      recurrenceCount: number;
      category?: FindingCategory;
      workCenter: { id?: string; name: string };
      inspection: { id: string; title?: string };
    };
  }>;
  total: number;
};

type SystemicFindingSnapshot = {
  id: string;
  title: string;
  status: string;
  initialScore: number;
  initialRiskLevel: string;
  residualScore?: number | null;
  residualRiskLevel?: string | null;
  riskMethodKey: string;
  riskMethodVersion: string;
};

type SystemicReview = {
  id: string;
  status: string;
  workCenterName: string;
  category: FindingCategory;
  recurrenceWindowDays: number;
  relatedFindingsSnapshot: SystemicFindingSnapshot[];
  actionsSufficient?: 'YES' | 'NO' | 'NEEDS_MORE_INFORMATION';
  broaderReviewRecommended?: boolean;
  notes?: string;
  suspectedFactors?: string;
  completedAt?: string;
  completedBy?: { displayName: string };
};

export type InspectionsDashboardFilters = Pick<
  InspectionFilters,
  | 'workCenterId'
  | 'workAreaId'
  | 'inspectionStatus'
  | 'riskLevel'
  | 'findingStatus'
  | 'hasRecurrence'
  | 'overdue'
>;
export type InspectionAlertFilters = Pick<InspectionFilters, 'status'>;
export type InspectionAnalyticsFilters = Pick<
  InspectionFilters,
  'workCenterId' | 'workAreaId' | 'category'
>;

const likelihoodDescriptions = [
  'Muy improbable',
  'Improbable',
  'Posible',
  'Probable',
  'Muy probable',
] as const;
const consequenceDescriptions = ['Menor', 'Leve', 'Moderada', 'Grave', 'Muy grave'] as const;
const FINDING_CATEGORIES: FindingCategory[] = [
  'ELECTRICAL',
  'FIRE',
  'MECHANICAL',
  'CHEMICAL',
  'ERGONOMIC',
  'PHYSICAL',
  'BIOLOGICAL',
  'PSYCHOSOCIAL',
  'HOUSEKEEPING',
  'OTHER',
];
const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  ELECTRICAL: 'Eléctrico',
  FIRE: 'Incendio',
  MECHANICAL: 'Mecánico',
  CHEMICAL: 'Químico',
  ERGONOMIC: 'Ergonómico',
  PHYSICAL: 'Físico',
  BIOLOGICAL: 'Biológico',
  PSYCHOSOCIAL: 'Psicosocial',
  HOUSEKEEPING: 'Orden y limpieza',
  OTHER: 'Otro',
};
const WRITE_ROLE_COPY = AUTHORIZED_TECHNICAL_WRITER_LABELS;
const VERIFY_ROLE_COPY = AUTHORIZED_TECHNICAL_REVIEWER_LABELS;

function shouldRetryGet(failureCount: number, error: Error): boolean {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 1;
}

function formatDate(value?: string): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(value));
}

function resultCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
}

function labelPriority(value: string): string {
  return { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' }[value] ?? value;
}

function riskLevelLabel(value?: string | null): string {
  return (
    { LOW: 'Bajo', MODERATE: 'Moderado', HIGH: 'Alto', CRITICAL: 'Crítico' }[value ?? ''] ??
    'Sin nivel'
  );
}

function labelRecurrence(value: string): string {
  return (
    {
      NONE: 'Sin recurrencia',
      REPEATED: 'Hallazgo recurrente',
      SYSTEMIC_REVIEW_RECOMMENDED: 'Revisión sistémica recomendada',
    }[value] ?? value
  );
}

function verificationBasisLabel(value: string): string {
  return (
    {
      RECORDED_EVIDENCE: 'Evidencia registrada',
      FIELD_OBSERVATION: 'Observación en campo',
      OTHER_JUSTIFIED: 'Otra justificación profesional',
    }[value] ?? value
  );
}

function useInspectionApi() {
  const auth = useAuth();
  const organization = useOrganization();
  const dashboard = useDashboardData();
  const activeOrganization = organization.organizations.find(
    (candidate) => candidate.id === organization.activeId,
  );
  const role = activeOrganization?.memberships[0]?.role;
  const moduleEnabled = dashboard.data?.entitlements.features['module.inspections'] === true;
  return {
    organizationId: organization.activeId,
    organizationName: activeOrganization?.name,
    role,
    userId: auth.user?.id,
    planName: dashboard.data?.entitlements.plan.name,
    accessLoading: organization.loading || dashboard.isLoading,
    accessError: dashboard.isError,
    moduleEnabled,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function useInspectionContext(api: ReturnType<typeof useInspectionApi>, enabled = true) {
  const organizationId = api.organizationId;
  return useQuery({
    queryKey: queryKeys.organization.inspectionContext(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<ContextData>('/inspections/context', { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled && enabled),
    retry: shouldRetryGet,
  });
}

function AccessGate({
  api,
  children,
}: {
  api: ReturnType<typeof useInspectionApi>;
  children: React.ReactNode;
}) {
  if (api.accessLoading) return <InspectionSkeleton label="Comprobando acceso a inspecciones" />;
  if (!api.organizationId)
    return (
      <InspectionState
        kind="info"
        title="Selecciona una organización"
        description="El contexto de organización es necesario antes de consultar inspecciones."
      />
    );
  if (api.accessError)
    return (
      <InspectionState
        kind="error"
        title="No pudimos comprobar el acceso"
        description="Revisa tu conexión y vuelve a intentarlo. La navegación permanece disponible."
      />
    );
  if (!api.moduleEnabled) return <EntitlementState planName={api.planName} />;
  return children;
}

function PageQueryError({ retry }: { retry(): void }) {
  return (
    <InspectionState
      kind="error"
      title="No pudimos cargar esta vista"
      description="Revisa tu conexión. No se modificó ningún registro."
      action={
        <button className="button secondary" type="button" onClick={retry}>
          Reintentar
        </button>
      }
    />
  );
}

function replaceFilters(
  path: string,
  filters: InspectionFilters,
  router: ReturnType<typeof useRouter>,
) {
  const search = filterSearchParams(filters);
  router.replace(search ? `${path}?${search}` : path);
}

function MetricLink({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link className="inspection-metric" href={href} aria-label={`${label}: ${value}. Ver detalle`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>
        Ver detalle <span aria-hidden="true">→</span>
      </small>
    </Link>
  );
}

function DemoChip() {
  return <span className="demo-chip">Demostración</span>;
}

export function InspectionsDashboard({ filters = {} }: { filters?: InspectionsDashboardFilters }) {
  const api = useInspectionApi();
  const router = useRouter();
  const organizationId = api.organizationId;
  const context = useInspectionContext(api);
  const filterKey = apiQuery(filters);
  const analytics = useQuery({
    queryKey: queryKeys.organization.inspectionAnalyticsSummary(
      organizationId ?? 'inactive',
      filterKey,
    ),
    queryFn: ({ signal }) =>
      api.request<Analytics>(`/inspections/analytics/summary?${filterKey}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const inspections = useQuery({
    queryKey: queryKeys.organization.inspectionList(organizationId ?? 'inactive', filterKey),
    queryFn: ({ signal }) => api.request<InspectionList>(`/inspections?${filterKey}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const activeCenter = context.data?.workCenters.find(({ id }) => id === filters.workCenterId);
  const activeArea = activeCenter?.workAreas.find(({ id }) => id === filters.workAreaId);
  const activeFilters = [
    filters.workCenterId && {
      key: 'workCenterId',
      label: activeCenter?.name ?? 'Centro seleccionado',
    },
    filters.workAreaId && { key: 'workAreaId', label: activeArea?.name ?? 'Área seleccionada' },
    filters.inspectionStatus && {
      key: 'inspectionStatus',
      label: statusMeta('inspection', filters.inspectionStatus).label,
    },
    filters.riskLevel && { key: 'riskLevel', label: `Riesgo ${filters.riskLevel.toLowerCase()}` },
    filters.findingStatus && {
      key: 'findingStatus',
      label: `Hallazgos ${statusMeta('finding', filters.findingStatus).label.toLowerCase()}`,
    },
    filters.hasRecurrence && { key: 'hasRecurrence', label: 'Con recurrencia' },
    filters.overdue && { key: 'overdue', label: 'Con acciones vencidas' },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  function updateFilter(key: keyof InspectionsDashboardFilters, value: string) {
    const next = { ...filters, [key]: value || undefined };
    if (key === 'workCenterId') next.workAreaId = undefined;
    replaceFilters('/app/inspections', next, router);
  }

  return (
    <AccessGate api={api}>
      <div className="inspection-workspace stack">
        <InspectionPageHeader
          eyebrow="Operación · Inspecciones"
          title="Inspecciones"
          description="Prioriza recorridos, identifica hallazgos y sigue las acciones sin mezclar sus ciclos de vida."
          context={<ContextLine>{api.organizationName ?? 'Organización activa'}</ContextLine>}
          actions={
            <>
              <Link className="button secondary" href="/app/inspections/alerts">
                Alertas
              </Link>
              <Link className="button secondary" href="/app/inspections/analytics">
                Tendencias
              </Link>
              {canWriteInspections(api.role) ? (
                <Link className="button" href="/app/inspections/new">
                  Nueva inspección
                </Link>
              ) : null}
            </>
          }
        />
        <InspectionDemoNotice compact />
        {!canWriteInspections(api.role) ? (
          <PermissionState
            role={api.role}
            capability="crear o modificar inspecciones"
            authorizedRoles={WRITE_ROLE_COPY}
          />
        ) : null}
        {analytics.isLoading ? (
          <InspectionSkeleton label="Cargando indicadores" />
        ) : analytics.isError ? (
          <PageQueryError retry={() => void analytics.refetch()} />
        ) : analytics.data ? (
          <section aria-labelledby="inspection-indicators-title">
            <div className="inspection-section-heading">
              <div>
                <p className="eyebrow">Señales operativas</p>
                <h2 id="inspection-indicators-title">Estado de la operación</h2>
              </div>
            </div>
            <div className="inspection-metric-grid">
              <MetricLink
                value={analytics.data.totalInspections}
                label="Inspecciones"
                href="/app/inspections"
              />
              <MetricLink
                value={analytics.data.openFindings}
                label="Hallazgos abiertos"
                href="/app/inspections?findingStatus=OPEN"
              />
              <MetricLink
                value={analytics.data.highCriticalFindings}
                label="Altos o críticos"
                href="/app/inspections/analytics#risk-summary"
              />
              <MetricLink
                value={analytics.data.overdueActions}
                label="Acciones vencidas"
                href="/app/inspections?overdue=true"
              />
              <MetricLink
                value={analytics.data.recurrenceAlerts}
                label="Recurrencias"
                href="/app/inspections?hasRecurrence=true"
              />
            </div>
          </section>
        ) : null}

        <section className="inspection-list-section" aria-labelledby="inspection-list-title">
          <div className="inspection-section-heading">
            <div>
              <p className="eyebrow">Recorridos</p>
              <h2 id="inspection-list-title">Inspecciones recientes</h2>
            </div>
            {inspections.data ? (
              <span aria-live="polite">{resultCountLabel(inspections.data.total)}</span>
            ) : null}
          </div>
          <div className="inspection-filter-panel focus-dim">
            <div className="inspection-filter-grid">
              <label>
                <span>Centro</span>
                <select
                  aria-label="Filtrar por centro"
                  value={filters.workCenterId ?? ''}
                  onChange={(event) => updateFilter('workCenterId', event.target.value)}
                >
                  <option value="">Todos los centros</option>
                  {context.data?.workCenters.map((center) => (
                    <option value={center.id} key={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Área</span>
                <select
                  aria-label="Filtrar por área"
                  value={filters.workAreaId ?? ''}
                  disabled={!activeCenter}
                  title={!activeCenter ? 'Selecciona primero un centro.' : undefined}
                  onChange={(event) => updateFilter('workAreaId', event.target.value)}
                >
                  <option value="">Todas las áreas</option>
                  {activeCenter?.workAreas.map((area) => (
                    <option value={area.id} key={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Estado</span>
                <select
                  aria-label="Filtrar por estado"
                  value={filters.inspectionStatus ?? ''}
                  onChange={(event) => updateFilter('inspectionStatus', event.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="COMPLETED">Completada</option>
                  <option value="CANCELED">Cancelada</option>
                </select>
              </label>
            </div>
            <ActiveFilters
              filters={activeFilters}
              onRemove={(key) => updateFilter(key as keyof InspectionsDashboardFilters, '')}
              onClear={() => replaceFilters('/app/inspections', {}, router)}
            />
          </div>
          {inspections.isLoading || context.isLoading ? (
            <InspectionSkeleton label="Cargando inspecciones" />
          ) : inspections.isError || context.isError ? (
            <PageQueryError
              retry={() => void Promise.all([inspections.refetch(), context.refetch()])}
            />
          ) : inspections.data?.items.length === 0 ? (
            <InspectionState
              kind="empty"
              title={
                activeFilters.length ? 'Ninguna inspección coincide' : 'Aún no hay inspecciones'
              }
              description={
                activeFilters.length
                  ? 'Quita uno o más filtros para ampliar la búsqueda.'
                  : 'Crea un recorrido en borrador y luego inícialo cuando comience el trabajo de campo.'
              }
              action={
                activeFilters.length ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => replaceFilters('/app/inspections', {}, router)}
                  >
                    Quitar filtros
                  </button>
                ) : canWriteInspections(api.role) ? (
                  <Link className="button" href="/app/inspections/new">
                    Nueva inspección
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="inspection-adaptive-list" data-density="compact">
              {inspections.data?.items.map((inspection) => (
                <Link
                  href={`/app/inspections/${inspection.id}`}
                  key={inspection.id}
                  className="inspection-operational-row"
                  aria-label={`Abrir inspección ${inspection.title}`}
                >
                  <span className="inspection-row-main">
                    <span className="inspection-row-kind">Inspección</span>
                    <strong>{inspection.title}</strong>
                    <small>
                      {inspection.workCenter.name}
                      {inspection.workArea ? ` · ${inspection.workArea.name}` : ''}
                      {inspection.inspector ? ` · ${inspection.inspector.displayName}` : ''}
                    </small>
                  </span>
                  <DomainStatusBadge domain="inspection" status={inspection.status} />
                  {inspection.overdueActions ? (
                    <span className="overdue-chip">{inspection.overdueActions} vencidas</span>
                  ) : (
                    <span className="inspection-row-muted">Sin acciones vencidas</span>
                  )}
                  {inspection.isDemo ? <DemoChip /> : null}
                  <span aria-hidden="true" className="inspection-row-chevron">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AccessGate>
  );
}

type InspectionForm = {
  workCenterId: string;
  workAreaId: string;
  title: string;
  description: string;
  scheduledFor: string;
};

export function NewInspection() {
  const api = useInspectionApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const context = useInspectionContext(api);
  const form = useForm<InspectionForm>({
    mode: 'onBlur',
    defaultValues: {
      workCenterId: '',
      workAreaId: '',
      title: '',
      description: '',
      scheduledFor: '',
    },
  });
  const centerId = form.watch('workCenterId');
  const areas = context.data?.workCenters.find((center) => center.id === centerId)?.workAreas ?? [];
  useEffect(() => {
    if (!areas.some(({ id }) => id === form.getValues('workAreaId')))
      form.setValue('workAreaId', '');
  }, [areas, form]);
  const mutation = useMutation({
    mutationFn: (values: InspectionForm) =>
      api.request<Inspection>('/inspections', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          workAreaId: values.workAreaId || undefined,
          scheduledFor: values.scheduledFor || undefined,
          description: values.description || undefined,
        }),
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspections(api.organizationId!),
      });
      router.push(`/app/inspections/${created.id}`);
    },
  });

  return (
    <AccessGate api={api}>
      <div className="inspection-task-page">
        <InspectionPageHeader
          eyebrow="Nueva inspección"
          title="Planifica el recorrido"
          description="Define el lugar y el objetivo. La inspección se crea como borrador; iniciar el trabajo es un acto separado."
          context={<ContextLine>{api.organizationName ?? 'Organización activa'}</ContextLine>}
        />
        <InspectionDemoNotice compact />
        {!canWriteInspections(api.role) ? (
          <PermissionState
            role={api.role}
            capability="crear una inspección"
            authorizedRoles={WRITE_ROLE_COPY}
          />
        ) : context.isLoading ? (
          <InspectionSkeleton label="Cargando centros y áreas" />
        ) : context.isError ? (
          <PageQueryError retry={() => void context.refetch()} />
        ) : context.data?.workCenters.length === 0 ? (
          <InspectionState
            kind="empty"
            title="No hay centros configurados"
            description="Configura un centro de trabajo antes de crear la inspección."
            action={
              <Link className="button secondary" href="/app/settings/organization">
                Ir a Organización
              </Link>
            }
          />
        ) : (
          <Card className="inspection-form-card">
            <form
              className="inspection-form"
              noValidate
              onSubmit={form.handleSubmit((values) => {
                if (!mutation.isPending) mutation.mutate(values);
              })}
            >
              <div className="inspection-form-intro">
                <p className="eyebrow">Contexto operacional</p>
                <h2>Ubicación y alcance</h2>
                <p>Los centros y áreas pertenecen a la organización activa.</p>
              </div>
              <div className="inspection-form-grid">
                <div className="field">
                  <label htmlFor="center">Centro de trabajo</label>
                  <select
                    id="center"
                    aria-invalid={Boolean(form.formState.errors.workCenterId)}
                    {...form.register('workCenterId', {
                      required: 'Selecciona un centro de trabajo.',
                    })}
                  >
                    <option value="">Selecciona un centro</option>
                    {context.data?.workCenters.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.workCenterId ? (
                    <p className="field-error">{form.formState.errors.workCenterId.message}</p>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor="area">Área (opcional)</label>
                  <select id="area" disabled={!centerId} {...form.register('workAreaId')}>
                    <option value="">Sin área específica</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                  {!centerId ? <small>Selecciona primero un centro.</small> : null}
                </div>
              </div>
              <div className="field">
                <label htmlFor="inspection-title">Título</label>
                <input
                  id="inspection-title"
                  placeholder="Ej. Recorrido de seguridad en Planta A"
                  aria-invalid={Boolean(form.formState.errors.title)}
                  {...form.register('title', {
                    required: 'Escribe un título para identificar el recorrido.',
                    minLength: { value: 3, message: 'Usa al menos 3 caracteres.' },
                    maxLength: { value: 160, message: 'Usa como máximo 160 caracteres.' },
                  })}
                />
                {form.formState.errors.title ? (
                  <p className="field-error">{form.formState.errors.title.message}</p>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="inspection-description">Descripción (opcional)</label>
                <textarea
                  id="inspection-description"
                  rows={4}
                  placeholder="Objetivo y límites del recorrido"
                  {...form.register('description', {
                    maxLength: { value: 2000, message: 'Usa como máximo 2000 caracteres.' },
                  })}
                />
              </div>
              <div className="field">
                <label htmlFor="scheduled">Fecha programada (opcional)</label>
                <input id="scheduled" type="datetime-local" {...form.register('scheduledFor')} />
              </div>
              <p className="inspection-invariant-note">
                Guardar el borrador no inicia la inspección.
              </p>
              {mutation.isError ? (
                <InlineRequestState>
                  No pudimos crear la inspección. Tus datos permanecen en el formulario; vuelve a
                  intentarlo.
                </InlineRequestState>
              ) : null}
              <div className="inspection-sticky-actions">
                <Link className="button secondary" href="/app/inspections">
                  Cancelar
                </Link>
                <button className="button" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Creando borrador…' : 'Crear inspección'}
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AccessGate>
  );
}

export function InspectionDetail({ inspectionId }: { inspectionId: string }) {
  const api = useInspectionApi();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const [showComplete, setShowComplete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({
    queryKey: queryKeys.organization.inspection(organizationId ?? 'inactive', inspectionId),
    queryFn: ({ signal }) => api.request<Inspection>(`/inspections/${inspectionId}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const transition = useMutation({
    mutationFn: (action: 'start' | 'complete') =>
      api.request(`/inspections/${inspectionId}/${action}`, { method: 'POST' }),
    onSuccess: async (_, action) => {
      setShowComplete(false);
      setNotice(
        action === 'start'
          ? 'Inspección iniciada. Ya puedes registrar hallazgos.'
          : 'Inspección completada.',
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspection(organizationId!, inspectionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspections(organizationId!),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspectionAnalytics(organizationId!),
        }),
      ]);
    },
  });

  return (
    <AccessGate api={api}>
      {query.isLoading ? (
        <InspectionSkeleton label="Cargando detalle de inspección" />
      ) : query.isError ? (
        query.error instanceof ApiClientError && query.error.status === 404 ? (
          <InspectionState
            kind="empty"
            title="No encontramos esta inspección"
            description={`Comprueba que el enlace corresponde a ${api.organizationName ?? 'la organización activa'}.`}
            action={
              <Link className="button secondary" href="/app/inspections">
                Volver a inspecciones
              </Link>
            }
          />
        ) : (
          <PageQueryError retry={() => void query.refetch()} />
        )
      ) : query.data ? (
        <div className="inspection-workspace stack">
          <InspectionPageHeader
            eyebrow="Inspección"
            title={query.data.title}
            description={
              query.data.description ??
              'Recorrido operativo con captura de hallazgos y seguimiento independiente de acciones.'
            }
            context={
              <ContextLine>
                {api.organizationName} · {query.data.workCenter.name}
                {query.data.workArea ? ` · ${query.data.workArea.name}` : ''}
              </ContextLine>
            }
            actions={
              canWriteInspections(api.role) ? (
                <>
                  {query.data.status === 'DRAFT' ? (
                    <button
                      className="button"
                      type="button"
                      disabled={transition.isPending}
                      onClick={() => transition.mutate('start')}
                    >
                      {transition.isPending ? 'Iniciando…' : 'Iniciar inspección'}
                    </button>
                  ) : null}
                  {query.data.status === 'IN_PROGRESS' ? (
                    <>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => setShowComplete(true)}
                      >
                        Completar inspección
                      </button>
                      <Link
                        className="button"
                        href={`/app/inspections/${query.data.id}/findings/new`}
                      >
                        Registrar hallazgo
                      </Link>
                    </>
                  ) : null}
                </>
              ) : undefined
            }
          />
          <div className="inspection-object-strip">
            <DomainStatusBadge domain="inspection" status={query.data.status} />
            {query.data.isDemo ? <DemoChip /> : null}
            <span>Creada {formatDate(query.data.createdAt)}</span>
            {query.data.inspector ? (
              <span>Inspector: {query.data.inspector.displayName}</span>
            ) : null}
          </div>
          <InspectionDemoNotice compact />
          {notice ? (
            <p className="inspection-success" role="status">
              {notice}
            </p>
          ) : null}
          {!canWriteInspections(api.role) ? (
            <PermissionState
              role={api.role}
              capability="iniciar, completar o registrar hallazgos"
              authorizedRoles={WRITE_ROLE_COPY}
            />
          ) : null}
          {transition.isError ? (
            <InlineRequestState>
              No pudimos cambiar el estado. Revisa el estado actual y vuelve a intentarlo.
            </InlineRequestState>
          ) : null}
          <section aria-labelledby="inspection-findings-title">
            <div className="inspection-section-heading">
              <div>
                <p className="eyebrow">Registro de campo</p>
                <h2 id="inspection-findings-title">
                  Hallazgos <span>{query.data.findings?.length ?? 0}</span>
                </h2>
              </div>
            </div>
            {query.data.findings?.length ? (
              <div className="inspection-adaptive-list" data-density="compact">
                {query.data.findings.map((finding) => (
                  <Link
                    className="inspection-operational-row finding-row"
                    href={`/app/inspections/${query.data.id}/findings/${finding.id}`}
                    key={finding.id}
                    aria-label={`Abrir hallazgo ${finding.title}`}
                  >
                    <span className="inspection-row-main">
                      <span className="inspection-row-kind">
                        {FINDING_CATEGORY_LABELS[finding.category]}
                      </span>
                      <strong>{finding.title}</strong>
                      <small>
                        Probabilidad {finding.initialLikelihood} × consecuencia{' '}
                        {finding.initialConsequence}
                      </small>
                    </span>
                    <InspectionRiskBadge
                      level={finding.initialRiskLevel}
                      score={finding.initialScore}
                    />
                    <DomainStatusBadge domain="finding" status={finding.status} />
                    {finding.recurrenceCount > 0 ? (
                      <span className="recurrence-chip">
                        {finding.recurrenceCount} antecedentes
                      </span>
                    ) : null}
                    <span aria-hidden="true" className="inspection-row-chevron">
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <InspectionState
                kind="empty"
                title="No hay hallazgos registrados"
                description={
                  query.data.status === 'IN_PROGRESS'
                    ? 'Registra lo observado durante el recorrido. Guardar un hallazgo no completa la inspección.'
                    : 'Inicia la inspección para habilitar la captura de campo.'
                }
              />
            )}
          </section>
          <InspectionDialog
            open={showComplete}
            title="Completar inspección"
            description="Esta acción termina el recorrido y no admite nuevos hallazgos. Las acciones correctivas y sus verificaciones conservan su ciclo independiente."
            onClose={() => {
              if (!transition.isPending) setShowComplete(false);
            }}
          >
            <div className="inspection-dialog-actions">
              <button
                className="button secondary"
                type="button"
                disabled={transition.isPending}
                onClick={() => setShowComplete(false)}
              >
                Volver
              </button>
              <button
                className="button"
                type="button"
                disabled={transition.isPending}
                onClick={() => transition.mutate('complete')}
              >
                {transition.isPending ? 'Completando…' : 'Completar inspección'}
              </button>
            </div>
          </InspectionDialog>
        </div>
      ) : null}
    </AccessGate>
  );
}

type FindingForm = {
  title: string;
  description: string;
  category: FindingCategory;
  likelihood: number | undefined;
  consequence: number | undefined;
};

export function NewFinding({ inspectionId }: { inspectionId: string }) {
  const api = useInspectionApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState<CreatedFinding | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const inspection = useQuery({
    queryKey: queryKeys.organization.inspection(organizationId ?? 'inactive', inspectionId),
    queryFn: ({ signal }) => api.request<Inspection>(`/inspections/${inspectionId}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const form = useForm<FindingForm>({
    mode: 'onBlur',
    defaultValues: {
      title: '',
      description: '',
      category: 'ELECTRICAL',
      likelihood: undefined,
      consequence: undefined,
    },
  });
  const values = form.watch();
  const mutation = useMutation({
    mutationFn: (input: FindingForm) =>
      api.request<CreatedFinding>(`/inspections/${inspectionId}/findings`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (result) => {
      setCreated(result);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspection(organizationId!, inspectionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspections(organizationId!),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspectionAnalytics(organizationId!),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspectionAlerts(organizationId!),
        }),
      ]);
    },
  });

  useEffect(() => {
    if (step > 1) stepHeadingRef.current?.focus();
  }, [step]);

  async function continueStep() {
    const fields: Array<keyof FindingForm> =
      step === 2
        ? ['title', 'description']
        : step === 3
          ? ['category']
          : step === 4
            ? ['likelihood', 'consequence']
            : [];
    const valid = fields.length === 0 || (await form.trigger(fields));
    if (valid) setStep((current) => Math.min(current + 1, 5));
  }

  if (created) {
    return (
      <AccessGate api={api}>
        <div className="inspection-task-page">
          <InspectionPageHeader
            eyebrow="Hallazgo guardado"
            title={created.title}
            description="La valoración se calculó y guardó con la metodología demostrativa vigente."
            context={
              <ContextLine>
                {api.organizationName} · {created.workCenter?.name}
                {created.workArea ? ` · ${created.workArea.name}` : ''}
              </ContextLine>
            }
          />
          <Card className="inspection-result-card" role="status">
            <div>
              <p className="eyebrow">Resultado calculado automáticamente</p>
              <strong className="inspection-result-score">{created.initialScore}</strong>
            </div>
            <div>
              <InspectionRiskBadge level={created.initialRiskLevel} score={created.initialScore} />
              <h2>
                Probabilidad {created.initialLikelihood} × consecuencia {created.initialConsequence}
              </h2>
              <p>Método DEMO_5X5 · versión {created.riskMethodVersion ?? '1.0.0'}</p>
            </div>
          </Card>
          <InspectionDemoNotice />
          {created.recurrenceCount > 0 ? (
            <div className="inspection-recurrence" role="note">
              <strong>{labelRecurrence(created.recurrenceStatus)}</strong>
              <p>
                {created.recurrenceCount} antecedentes en los últimos {created.recurrenceWindowDays}{' '}
                días para el mismo centro y categoría.
              </p>
              <p>Este aviso indica recurrencia, no confirma una causa raíz.</p>
            </div>
          ) : null}
          <Card className="inspection-next-card">
            <div>
              <p className="eyebrow">Siguiente paso</p>
              <h2>Planifica la acción correctiva</h2>
              <p>El hallazgo queda guardado. Su estado y el de cada acción son independientes.</p>
            </div>
            <div className="inspection-dialog-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => router.push(`/app/inspections/${inspectionId}`)}
              >
                Volver a la inspección
              </button>
              <button
                className="button"
                type="button"
                onClick={() =>
                  router.push(`/app/inspections/${inspectionId}/findings/${created.id}`)
                }
              >
                Crear acción correctiva
              </button>
            </div>
          </Card>
        </div>
      </AccessGate>
    );
  }

  return (
    <AccessGate api={api}>
      {inspection.isLoading ? (
        <InspectionSkeleton label="Cargando captura de hallazgo" />
      ) : inspection.isError ? (
        <PageQueryError retry={() => void inspection.refetch()} />
      ) : !canWriteInspections(api.role) ? (
        <PermissionState
          role={api.role}
          capability="registrar un hallazgo"
          authorizedRoles={WRITE_ROLE_COPY}
        />
      ) : inspection.data && ['COMPLETED', 'CANCELED'].includes(inspection.data.status) ? (
        <InspectionState
          kind="info"
          title="La inspección ya no admite hallazgos"
          description="Una inspección completada o cancelada conserva sus registros, pero no acepta nuevas capturas."
          action={
            <Link className="button secondary" href={`/app/inspections/${inspectionId}`}>
              Volver al detalle
            </Link>
          }
        />
      ) : inspection.data ? (
        <div className="inspection-field-capture">
          <InspectionPageHeader
            eyebrow={`Paso ${step} de 5 · Nuevo hallazgo`}
            title={
              [
                'Confirma el contexto',
                'Describe lo observado',
                'Clasifica el hallazgo',
                'Valora el riesgo',
                'Revisa y guarda',
              ][step - 1] ?? 'Nuevo hallazgo'
            }
            description="Captura guiada con la organización, el centro y el área siempre visibles."
            context={
              <ContextLine>
                {api.organizationName} · {inspection.data.workCenter.name}
                {inspection.data.workArea ? ` · ${inspection.data.workArea.name}` : ''}
              </ContextLine>
            }
          />
          <InspectionDemoNotice compact />
          <div className="inspection-stepper" aria-label={`Paso ${step} de 5`}>
            <span>Paso {step} de 5</span>
            <div aria-hidden="true">
              {[1, 2, 3, 4, 5].map((item) => (
                <i className={item <= step ? 'active' : ''} key={item} />
              ))}
            </div>
          </div>
          <Card className="inspection-wizard-card">
            <form
              noValidate
              onSubmit={form.handleSubmit((input) => {
                if (!mutation.isPending)
                  mutation.mutate({
                    ...input,
                    likelihood: Number(values.likelihood),
                    consequence: Number(values.consequence),
                  });
              })}
            >
              <h2 className="sr-only" ref={stepHeadingRef} tabIndex={-1}>
                Paso {step} de 5
              </h2>
              {step === 1 ? (
                <div className="inspection-review-list">
                  <div>
                    <span>Inspección</span>
                    <strong>{inspection.data.title}</strong>
                  </div>
                  <div>
                    <span>Centro</span>
                    <strong>{inspection.data.workCenter.name}</strong>
                  </div>
                  <div>
                    <span>Área</span>
                    <strong>{inspection.data.workArea?.name ?? 'Sin área específica'}</strong>
                  </div>
                  <p className="inspection-invariant-note">
                    Este contexto proviene de la inspección y no se envía como una organización
                    arbitraria.
                  </p>
                </div>
              ) : null}
              {step === 2 ? (
                <div className="inspection-form">
                  <div className="field">
                    <label htmlFor="finding-title">Título del hallazgo</label>
                    <input
                      id="finding-title"
                      autoFocus
                      aria-invalid={Boolean(form.formState.errors.title)}
                      {...form.register('title', {
                        required: 'Escribe un título para el hallazgo.',
                        minLength: { value: 3, message: 'Usa al menos 3 caracteres.' },
                        maxLength: { value: 160, message: 'Usa como máximo 160 caracteres.' },
                      })}
                    />
                    {form.formState.errors.title ? (
                      <p className="field-error">{form.formState.errors.title.message}</p>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor="finding-description">Descripción</label>
                    <textarea
                      id="finding-description"
                      rows={6}
                      aria-invalid={Boolean(form.formState.errors.description)}
                      {...form.register('description', {
                        required: 'Describe lo observado.',
                        minLength: { value: 3, message: 'Usa al menos 3 caracteres.' },
                        maxLength: { value: 4000, message: 'Usa como máximo 4000 caracteres.' },
                      })}
                    />
                    {form.formState.errors.description ? (
                      <p className="field-error">{form.formState.errors.description.message}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {step === 3 ? (
                <div className="inspection-form">
                  <div className="field">
                    <label htmlFor="finding-category">Categoría del hallazgo</label>
                    <select id="finding-category" autoFocus {...form.register('category')}>
                      {FINDING_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {FINDING_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="inspection-invariant-note">
                    La categoría organiza la operación. No constituye por sí sola una clasificación
                    legal.
                  </p>
                </div>
              ) : null}
              {step === 4 ? (
                <div className="inspection-form">
                  <QuestionScale
                    name="likelihood"
                    title="Probabilidad"
                    descriptions={likelihoodDescriptions}
                    register={form.register}
                    error={form.formState.errors.likelihood?.message}
                  />
                  <QuestionScale
                    name="consequence"
                    title="Consecuencia"
                    descriptions={consequenceDescriptions}
                    register={form.register}
                    error={form.formState.errors.consequence?.message}
                  />
                  <div className="inspection-server-calculation" role="status">
                    <strong>Valoración preparada</strong>
                    <span>
                      El resultado se calculará y guardará al continuar. La interfaz no estima el
                      nivel.
                    </span>
                  </div>
                </div>
              ) : null}
              {step === 5 ? (
                <div className="inspection-review-list">
                  <div>
                    <span>Hallazgo</span>
                    <strong>{values.title}</strong>
                  </div>
                  <div>
                    <span>Descripción</span>
                    <strong>{values.description}</strong>
                  </div>
                  <div>
                    <span>Categoría</span>
                    <strong>{FINDING_CATEGORY_LABELS[values.category]}</strong>
                  </div>
                  <div>
                    <span>Probabilidad</span>
                    <strong>{values.likelihood} de 5</strong>
                  </div>
                  <div>
                    <span>Consecuencia</span>
                    <strong>{values.consequence} de 5</strong>
                  </div>
                  <p className="inspection-invariant-note">
                    Guardar registra el hallazgo. No completa la inspección.
                  </p>
                </div>
              ) : null}
              {mutation.isError ? (
                <InlineRequestState>
                  No pudimos guardar el hallazgo. Todas tus respuestas se conservaron; vuelve a
                  intentarlo.
                </InlineRequestState>
              ) : null}
              <div className="inspection-sticky-actions">
                {step === 1 ? (
                  <Link className="button secondary" href={`/app/inspections/${inspectionId}`}>
                    Cancelar
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setStep((current) => Math.max(1, current - 1))}
                  >
                    Atrás
                  </button>
                )}
                {step < 5 ? (
                  <button
                    key="continue-finding"
                    type="button"
                    className="button"
                    onClick={(event) => {
                      event.preventDefault();
                      void continueStep();
                    }}
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    key="save-finding"
                    type="submit"
                    className="button"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? 'Guardando…' : 'Guardar hallazgo'}
                  </button>
                )}
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </AccessGate>
  );
}

type ActionForm = {
  title: string;
  description: string;
  assignedToUserId: string;
  priority: string;
  dueAt: string;
};
type EvidenceForm = { type: 'NOTE' | 'EXTERNAL_LINK'; note: string; externalUrl: string };
type VerifyForm = {
  likelihood: number | undefined;
  consequence: number | undefined;
  basis: '' | 'RECORDED_EVIDENCE' | 'FIELD_OBSERVATION' | 'OTHER_JUSTIFIED';
  note: string;
  selfVerificationAcknowledged: boolean;
};

export function FindingDetail({
  inspectionId,
  findingId,
}: {
  inspectionId: string;
  findingId: string;
}) {
  const api = useInspectionApi();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const [showAction, setShowAction] = useState(false);
  const [evidenceActionId, setEvidenceActionId] = useState<string | null>(null);
  const [showVerify, setShowVerify] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const finding = useQuery({
    queryKey: queryKeys.organization.finding(organizationId ?? 'inactive', findingId),
    queryFn: ({ signal }) =>
      api.request<Finding>(`/inspections/${inspectionId}/findings/${findingId}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const context = useInspectionContext(api);
  const actionForm = useForm<ActionForm>({
    mode: 'onBlur',
    defaultValues: {
      title: '',
      description: '',
      assignedToUserId: '',
      priority: 'MEDIUM',
      dueAt: '',
    },
  });
  const evidenceForm = useForm<EvidenceForm>({
    mode: 'onBlur',
    defaultValues: { type: 'NOTE', note: '', externalUrl: '' },
  });
  const verifyForm = useForm<VerifyForm>({
    mode: 'onBlur',
    defaultValues: {
      likelihood: undefined,
      consequence: undefined,
      basis: '',
      note: '',
      selfVerificationAcknowledged: false,
    },
  });
  const evidenceType = evidenceForm.watch('type');
  const verificationBasis = verifyForm.watch('basis');

  async function refreshFinding() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.finding(organizationId!, findingId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspection(organizationId!, inspectionId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspections(organizationId!),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionAnalytics(organizationId!),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionAlerts(organizationId!),
      }),
    ]);
  }

  const createAction = useMutation({
    mutationFn: (input: ActionForm) =>
      api.request(`/inspections/${inspectionId}/findings/${findingId}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          assignedToUserId: input.assignedToUserId || undefined,
          dueAt: input.dueAt || undefined,
          description: input.description || undefined,
        }),
      }),
    onSuccess: async () => {
      actionForm.reset();
      setShowAction(false);
      setNotice('Acción correctiva guardada como abierta.');
      await refreshFinding();
    },
  });
  const updateAction = useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: 'IN_PROGRESS' }) =>
      api.request(`/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      setNotice('Acción iniciada.');
      await refreshFinding();
    },
  });
  const completeAction = useMutation({
    mutationFn: (actionId: string) =>
      api.request(
        `/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/complete`,
        { method: 'POST' },
      ),
    onSuccess: async () => {
      setNotice(
        'Ejecución registrada. La acción queda pendiente de verificación del riesgo residual.',
      );
      await refreshFinding();
    },
  });
  const addEvidence = useMutation({
    mutationFn: ({ actionId, input }: { actionId: string; input: EvidenceForm }) =>
      api.request(
        `/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/evidence`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: input.type,
            note: input.type === 'NOTE' ? input.note : undefined,
            externalUrl: input.type === 'EXTERNAL_LINK' ? input.externalUrl : undefined,
          }),
        },
      ),
    onSuccess: async () => {
      evidenceForm.reset();
      setEvidenceActionId(null);
      setNotice('Evidencia guardada.');
      await refreshFinding();
    },
  });
  const verify = useMutation({
    mutationFn: (input: VerifyForm) =>
      api.request(`/inspections/${inspectionId}/findings/${findingId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          likelihood: Number(input.likelihood),
          consequence: Number(input.consequence),
          basis: input.basis,
          note: input.note || undefined,
          selfVerificationAcknowledged: input.selfVerificationAcknowledged,
        }),
      }),
    onSuccess: async () => {
      verifyForm.reset();
      setShowVerify(false);
      setNotice('Riesgo residual verificado por un usuario autorizado.');
      await refreshFinding();
    },
  });

  const mutationError =
    createAction.isError ||
    updateAction.isError ||
    completeAction.isError ||
    addEvidence.isError ||
    verify.isError;
  const actionProgress = actionProgressMeta(
    finding.data?.actions.map((action) => action.status) ?? [],
  );
  const methodPresentation = presentInspectionRiskMethod(
    finding.data?.riskMethodKey ?? 'DEMO_5X5',
    finding.data?.riskMethodVersion ?? '1.0.0',
  );
  const pendingSelfVerification =
    finding.data?.actions.some(
      (action) =>
        action.status === 'PENDING_VERIFICATION' && action.assignedToUserId === api.userId,
    ) ?? false;
  const elevatedSelfVerification =
    pendingSelfVerification &&
    (finding.data?.initialRiskLevel === 'HIGH' || finding.data?.initialRiskLevel === 'CRITICAL');

  return (
    <AccessGate api={api}>
      {finding.isLoading ? (
        <InspectionSkeleton label="Cargando detalle de hallazgo" />
      ) : finding.isError ? (
        finding.error instanceof ApiClientError && finding.error.status === 404 ? (
          <InspectionState
            kind="empty"
            title="No encontramos este hallazgo"
            description={`Comprueba que el enlace corresponde a ${api.organizationName ?? 'la organización activa'}.`}
            action={
              <Link className="button secondary" href={`/app/inspections/${inspectionId}`}>
                Volver a la inspección
              </Link>
            }
          />
        ) : (
          <PageQueryError retry={() => void finding.refetch()} />
        )
      ) : finding.data ? (
        <div className="inspection-workspace stack">
          <InspectionPageHeader
            eyebrow={`Hallazgo · ${FINDING_CATEGORY_LABELS[finding.data.category]}`}
            title={finding.data.title}
            description={finding.data.description}
            context={
              <ContextLine>
                {api.organizationName} · {finding.data.workCenter?.name}
                {finding.data.workArea ? ` · ${finding.data.workArea.name}` : ''}
              </ContextLine>
            }
            actions={
              canWriteInspections(api.role) && finding.data.status !== 'CLOSED' ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => setShowAction((current) => !current)}
                >
                  {showAction ? 'Cerrar formulario' : 'Crear acción correctiva'}
                </button>
              ) : undefined
            }
          />
          <div className="inspection-object-strip">
            <InspectionRiskBadge
              level={finding.data.initialRiskLevel}
              score={finding.data.initialScore}
            />
            <DomainStatusBadge domain="finding" status={finding.data.status} />
            {finding.data.inspection?.isDemo ? <DemoChip /> : null}
            <span>Metodología utilizada: {methodPresentation.displayName}</span>
            <TechnicalDetails summary="Ver metodología y detalles">
              <dl className="inspection-action-meta">
                <div>
                  <dt>Versión</dt>
                  <dd>{methodPresentation.version}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{methodPresentation.statusLabel}</dd>
                </div>
                <div>
                  <dt>Identificador</dt>
                  <dd>
                    <code>{methodPresentation.technicalKey}</code>
                  </dd>
                </div>
              </dl>
            </TechnicalDetails>
          </div>
          <InspectionDemoNotice compact />
          {notice ? (
            <p className="inspection-success" role="status">
              {notice}
            </p>
          ) : null}
          {mutationError ? (
            <InlineRequestState>
              No pudimos completar la operación. Tus datos se conservaron; revisa el estado actual y
              vuelve a intentarlo.
            </InlineRequestState>
          ) : null}

          <div className="inspection-finding-layout">
            <div className="stack">
              <section aria-labelledby="risk-pair-title">
                <div className="inspection-section-heading">
                  <div>
                    <p className="eyebrow">Valoración</p>
                    <h2 id="risk-pair-title">Riesgo inicial y residual</h2>
                  </div>
                </div>
                <div className="inspection-risk-pair">
                  <Card>
                    <span>Riesgo inicial</span>
                    <strong>{finding.data.initialScore}</strong>
                    <p>
                      Probabilidad {finding.data.initialLikelihood} × consecuencia{' '}
                      {finding.data.initialConsequence}
                    </p>
                    <InspectionRiskBadge
                      level={finding.data.initialRiskLevel}
                      score={finding.data.initialScore}
                    />
                  </Card>
                  <Card className={!finding.data.residualScore ? 'pending' : ''}>
                    <span>Riesgo residual</span>
                    {finding.data.residualScore ? (
                      <>
                        <strong>{finding.data.residualScore}</strong>
                        <p>
                          Probabilidad {finding.data.residualLikelihood} × consecuencia{' '}
                          {finding.data.residualConsequence}
                        </p>
                        <InspectionRiskBadge
                          level={finding.data.residualRiskLevel}
                          score={finding.data.residualScore}
                        />
                      </>
                    ) : (
                      <>
                        <strong aria-label="Sin valor">—</strong>
                        <p>
                          Pendiente de verificación. La ejecución registrada aún requiere verificar
                          el riesgo residual.
                        </p>
                        <InspectionRiskBadge pending />
                      </>
                    )}
                  </Card>
                </div>
              </section>

              {finding.data.recurrenceStatus !== 'NONE' ? (
                <div className="inspection-recurrence" role="note">
                  <strong>{labelRecurrence(finding.data.recurrenceStatus)}</strong>
                  <p>
                    {finding.data.recurrence?.previousCount} antecedentes en{' '}
                    {finding.data.recurrence?.windowDays} días, en {finding.data.workCenter?.name} y
                    categoría {FINDING_CATEGORY_LABELS[finding.data.category]}.
                  </p>
                  <p>Este aviso indica recurrencia, no confirma una causa raíz.</p>
                  {finding.data.recurrence?.previous.length ? (
                    <div className="inspection-related-links">
                      {finding.data.recurrence.previous.map((item) => (
                        <Link
                          key={item.id}
                          href={`/app/inspections/${item.inspectionId}/findings/${item.id}`}
                        >
                          {item.title} <span aria-hidden="true">→</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <InspectionDialog
                open={showAction}
                title="Crear acción correctiva"
                description="Define el control, la persona responsable y el plazo. Crear la acción no verifica el riesgo residual."
                onClose={() => {
                  if (!createAction.isPending) setShowAction(false);
                }}
              >
                <form
                  className="inspection-form"
                  noValidate
                  onSubmit={actionForm.handleSubmit((input) => createAction.mutate(input))}
                >
                  <div className="inspection-form-intro">
                    <p className="eyebrow">Acción correctiva</p>
                    <h2>Define el siguiente control</h2>
                  </div>
                  <div className="field">
                    <label htmlFor="action-title">Acción</label>
                    <input
                      id="action-title"
                      aria-invalid={Boolean(actionForm.formState.errors.title)}
                      {...actionForm.register('title', {
                        required: 'Describe la acción correctiva.',
                        minLength: { value: 3, message: 'Usa al menos 3 caracteres.' },
                        maxLength: { value: 160, message: 'Usa como máximo 160 caracteres.' },
                      })}
                    />
                    {actionForm.formState.errors.title ? (
                      <p className="field-error">{actionForm.formState.errors.title.message}</p>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor="action-description">Descripción (opcional)</label>
                    <textarea
                      id="action-description"
                      rows={4}
                      {...actionForm.register('description')}
                    />
                  </div>
                  <div className="inspection-form-grid">
                    <div className="field">
                      <label htmlFor="assignee">Responsable</label>
                      <select id="assignee" {...actionForm.register('assignedToUserId')}>
                        <option value="">Sin asignar</option>
                        {context.data?.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.displayName} · {humanRoleLabel(member.role)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="priority">Prioridad</label>
                      <select id="priority" {...actionForm.register('priority')}>
                        <option value="LOW">Baja</option>
                        <option value="MEDIUM">Media</option>
                        <option value="HIGH">Alta</option>
                        <option value="URGENT">Urgente</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="due">Fecha límite (opcional)</label>
                    <input id="due" type="datetime-local" {...actionForm.register('dueAt')} />
                  </div>
                  <div className="inspection-dialog-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setShowAction(false)}
                    >
                      Cancelar
                    </button>
                    <button className="button" disabled={createAction.isPending}>
                      {createAction.isPending ? 'Guardando…' : 'Guardar acción'}
                    </button>
                  </div>
                </form>
              </InspectionDialog>

              <section aria-labelledby="corrective-actions-title">
                <div className="inspection-section-heading">
                  <div>
                    <p className="eyebrow">Seguimiento</p>
                    <h2 id="corrective-actions-title">
                      Acciones correctivas <span>{finding.data.actions.length}</span>
                    </h2>
                  </div>
                </div>
                {finding.data.actions.length === 0 ? (
                  <InspectionState
                    kind="empty"
                    title="No hay acciones todavía"
                    description="Crea una acción para asignar el control, iniciar el trabajo y enviarlo a verificación."
                  />
                ) : (
                  <div className="inspection-action-list">
                    {finding.data.actions.map((action) => {
                      const nextStep = actionPrimaryStep(action.status);
                      const canComplete = canCompleteCorrectiveAction({
                        role: api.role,
                        userId: api.userId,
                        assignedToUserId: action.assignedToUserId ?? action.assignedTo?.id,
                      });
                      return (
                        <Card className="inspection-action-card" key={action.id}>
                          <div className="inspection-action-topline">
                            <DomainStatusBadge domain="action" status={action.status} />
                            {action.overdue ? <span className="overdue-chip">Vencida</span> : null}
                            <span>Prioridad {labelPriority(action.priority)}</span>
                          </div>
                          <h3>{action.title}</h3>
                          {action.description ? <p>{action.description}</p> : null}
                          <dl className="inspection-action-meta">
                            <div>
                              <dt>Responsable</dt>
                              <dd>{action.assignedTo?.displayName ?? 'Sin asignar'}</dd>
                            </div>
                            <div>
                              <dt>Vencimiento</dt>
                              <dd>{formatDate(action.dueAt)}</dd>
                            </div>
                            {action.verifiedBy ? (
                              <div>
                                <dt>Verificada por</dt>
                                <dd>
                                  {action.verifiedBy.displayName} · {formatDate(action.verifiedAt)}
                                </dd>
                              </div>
                            ) : null}
                            {action.verificationBasis ? (
                              <div>
                                <dt>Base de verificación</dt>
                                <dd>{verificationBasisLabel(action.verificationBasis)}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {action.verificationNote ? <p>{action.verificationNote}</p> : null}
                          {action.selfVerification ? (
                            <p className="inspection-invariant-note">
                              Autoverificación registrada para auditoría.
                            </p>
                          ) : null}
                          {action.evidence.length ? (
                            <div className="inspection-evidence-list">
                              <strong>Evidencia registrada</strong>
                              {action.evidence.map((evidence) => (
                                <div key={evidence.id}>
                                  <span aria-hidden="true">
                                    {evidence.type === 'NOTE' ? '≡' : '↗'}
                                  </span>
                                  {evidence.type === 'NOTE' ? (
                                    <span>{evidence.note}</span>
                                  ) : (
                                    <a
                                      href={evidence.externalUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Abrir enlace externo
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="inspection-row-muted">Sin evidencia registrada.</p>
                          )}
                          {evidenceActionId === action.id ? (
                            <form
                              className="inspection-evidence-form"
                              noValidate
                              onSubmit={evidenceForm.handleSubmit((input) =>
                                addEvidence.mutate({ actionId: action.id, input }),
                              )}
                            >
                              <div className="field">
                                <label htmlFor={`evidence-type-${action.id}`}>
                                  Tipo de evidencia
                                </label>
                                <select
                                  id={`evidence-type-${action.id}`}
                                  {...evidenceForm.register('type')}
                                >
                                  <option value="NOTE">Nota</option>
                                  <option value="EXTERNAL_LINK">Enlace externo HTTPS</option>
                                </select>
                              </div>
                              {evidenceType === 'NOTE' ? (
                                <div className="field">
                                  <label htmlFor={`evidence-note-${action.id}`}>Nota</label>
                                  <textarea
                                    id={`evidence-note-${action.id}`}
                                    rows={3}
                                    {...evidenceForm.register('note', {
                                      required: 'Escribe la nota que respalda la acción.',
                                      maxLength: {
                                        value: 2000,
                                        message: 'Usa como máximo 2000 caracteres.',
                                      },
                                    })}
                                  />
                                  {evidenceForm.formState.errors.note ? (
                                    <p className="field-error">
                                      {evidenceForm.formState.errors.note.message}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="field">
                                  <label htmlFor={`evidence-url-${action.id}`}>Enlace HTTPS</label>
                                  <input
                                    id={`evidence-url-${action.id}`}
                                    type="url"
                                    inputMode="url"
                                    placeholder="https://"
                                    {...evidenceForm.register('externalUrl', {
                                      required: 'Escribe un enlace HTTPS.',
                                      pattern: {
                                        value: /^https:\/\/.+/,
                                        message:
                                          'Usa un enlace completo que comience con https://.',
                                      },
                                    })}
                                  />
                                  {evidenceForm.formState.errors.externalUrl ? (
                                    <p className="field-error">
                                      {evidenceForm.formState.errors.externalUrl.message}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                              <p className="inspection-invariant-note">
                                V1 admite notas y enlaces externos. No existe carga de archivos.
                              </p>
                              <div className="inspection-dialog-actions">
                                <button
                                  className="button secondary"
                                  type="button"
                                  onClick={() => setEvidenceActionId(null)}
                                >
                                  Cancelar
                                </button>
                                <button className="button" disabled={addEvidence.isPending}>
                                  {addEvidence.isPending ? 'Guardando…' : 'Guardar evidencia'}
                                </button>
                              </div>
                            </form>
                          ) : null}
                          <div className="inspection-action-controls">
                            {canWriteInspections(api.role) && finding.data.status !== 'CLOSED' ? (
                              <button
                                className="button secondary"
                                type="button"
                                onClick={() => {
                                  evidenceForm.reset();
                                  setEvidenceActionId(action.id);
                                }}
                              >
                                Añadir evidencia
                              </button>
                            ) : null}
                            {nextStep === 'start' && canWriteInspections(api.role) ? (
                              <button
                                className="button"
                                type="button"
                                disabled={updateAction.isPending}
                                onClick={() =>
                                  updateAction.mutate({
                                    actionId: action.id,
                                    status: 'IN_PROGRESS',
                                  })
                                }
                              >
                                {actionPrimaryLabel(action.status)}
                              </button>
                            ) : null}
                            {nextStep === 'complete' && canComplete ? (
                              <button
                                className="button"
                                type="button"
                                disabled={completeAction.isPending}
                                onClick={() => completeAction.mutate(action.id)}
                              >
                                {actionPrimaryLabel(action.status)}
                              </button>
                            ) : null}
                          </div>
                          {nextStep === 'complete' && !canComplete ? (
                            <p className="inspection-permission-inline">
                              {api.role === 'SST_TECHNICIAN'
                                ? 'Como Técnico SST, solo puedes enviar a verificación las acciones que tienes asignadas.'
                                : `Tu rol (${humanRoleLabel(api.role)}) no puede enviar esta acción a verificación.`}
                            </p>
                          ) : null}
                          {action.status === 'PENDING_VERIFICATION' ? (
                            <p className="inspection-invariant-note">
                              El envío de la ejecución no verifica el riesgo residual.
                            </p>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              {finding.data.actions.some((action) => action.status === 'PENDING_VERIFICATION') ? (
                canVerifyFindings(api.role) ? (
                  <Card className="inspection-verification-callout">
                    <div>
                      <p className="eyebrow">Paso actual</p>
                      <h2>Verificar riesgo residual</h2>
                      <p>
                        Registra la valoración observada después de la acción. El resultado se
                        calcula y el hallazgo se cierra solo si se cumplen sus condiciones actuales.
                      </p>
                    </div>
                    <button className="button" type="button" onClick={() => setShowVerify(true)}>
                      Verificar riesgo residual
                    </button>
                  </Card>
                ) : (
                  <PermissionState
                    role={api.role}
                    capability="verificar el riesgo residual"
                    authorizedRoles={VERIFY_ROLE_COPY}
                  />
                )
              ) : null}
            </div>

            <aside className="inspection-context-rail focus-dim" aria-label="Contexto del hallazgo">
              <Card>
                <h2>Progreso del hallazgo</h2>
                <ol className="inspection-workflow-steps">
                  <li className="done">Hallazgo registrado</li>
                  <li className={finding.data.actions.length ? 'done' : 'current'}>
                    Acción correctiva creada
                  </li>
                  <li className={actionProgress.state}>{actionProgress.label}</li>
                  <li className={finding.data.residualScore ? 'done' : 'current'}>
                    Riesgo residual verificado
                  </li>
                  <li className={finding.data.status === 'CLOSED' ? 'done' : ''}>
                    Hallazgo cerrado por la regla vigente
                  </li>
                </ol>
              </Card>
              <Card>
                <h2>Prerrequisitos actuales</h2>
                <ul className="inspection-prerequisites">
                  <li data-complete={finding.data.actions.length > 0}>
                    Al menos una acción correctiva
                  </li>
                  <li
                    data-complete={
                      finding.data.actions.some((action) => action.status !== 'CANCELED') &&
                      finding.data.actions
                        .filter((action) => action.status !== 'CANCELED')
                        .every((action) => action.status === 'COMPLETED')
                    }
                  >
                    Acciones no canceladas verificadas
                  </li>
                  <li data-complete={Boolean(finding.data.residualScore)}>
                    Riesgo residual registrado
                  </li>
                </ul>
                <p className="inspection-invariant-note">
                  La regla vigente cierra automáticamente cuando la verificación completa los
                  prerrequisitos.
                </p>
              </Card>
              {finding.data.alerts?.length ? (
                <Card>
                  <h2>Alertas relacionadas</h2>
                  {finding.data.alerts.map((alert) => (
                    <div className="inspection-rail-alert" key={alert.id}>
                      <DomainStatusBadge domain="alert" status={alert.status} />
                      <strong>{alertTypeLabel(alert.type)}</strong>
                      <p>{alert.message}</p>
                      {alert.acknowledgedAt ? (
                        <p className="muted">
                          Revisada por {alert.acknowledgedBy?.displayName ?? 'usuario autorizado'} ·{' '}
                          {formatDate(alert.acknowledgedAt)}. La señal histórica permanece.
                        </p>
                      ) : null}
                      {alert.systemicReview ? (
                        <Link href="/app/inspections/alerts">Ver revisión sistémica</Link>
                      ) : null}
                    </div>
                  ))}
                </Card>
              ) : null}
            </aside>
          </div>

          <InspectionDialog
            open={showVerify}
            title="Verificar riesgo residual"
            description="Valora el riesgo después de aplicar el control. La verificación queda asociada a tu usuario y debe indicar su base profesional."
            onClose={() => {
              if (!verify.isPending) setShowVerify(false);
            }}
          >
            <form
              className="inspection-form"
              noValidate
              onSubmit={verifyForm.handleSubmit((input) => verify.mutate(input))}
            >
              <QuestionScale
                name="likelihood"
                title="Probabilidad residual"
                descriptions={likelihoodDescriptions}
                register={verifyForm.register}
                error={verifyForm.formState.errors.likelihood?.message}
              />
              <QuestionScale
                name="consequence"
                title="Consecuencia residual"
                descriptions={consequenceDescriptions}
                register={verifyForm.register}
                error={verifyForm.formState.errors.consequence?.message}
              />
              <div className="field">
                <label htmlFor="verification-basis">Base de verificación</label>
                <select
                  id="verification-basis"
                  aria-invalid={Boolean(verifyForm.formState.errors.basis)}
                  {...verifyForm.register('basis', {
                    required: 'Selecciona la base utilizada para verificar.',
                  })}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="RECORDED_EVIDENCE">Evidencia registrada</option>
                  <option value="FIELD_OBSERVATION">Observación en campo</option>
                  <option value="OTHER_JUSTIFIED">Otra justificación profesional</option>
                </select>
                {verifyForm.formState.errors.basis ? (
                  <p className="field-error">{verifyForm.formState.errors.basis.message}</p>
                ) : null}
              </div>
              {verificationBasis === 'FIELD_OBSERVATION' ||
              verificationBasis === 'OTHER_JUSTIFIED' ? (
                <div className="field">
                  <label htmlFor="verification-note">Descripción de la verificación</label>
                  <textarea
                    id="verification-note"
                    rows={4}
                    maxLength={1000}
                    {...verifyForm.register('note', {
                      validate: (value) =>
                        !['FIELD_OBSERVATION', 'OTHER_JUSTIFIED'].includes(verificationBasis) ||
                        value.trim().length >= 10 ||
                        'Describe la verificación en al menos 10 caracteres.',
                    })}
                  />
                  {verifyForm.formState.errors.note ? (
                    <p className="field-error">{verifyForm.formState.errors.note.message}</p>
                  ) : null}
                </div>
              ) : null}
              {pendingSelfVerification ? (
                <div className="inspection-invariant-note" role="note">
                  <strong>Estás verificando una acción que tenías asignada.</strong>
                  {elevatedSelfVerification ? (
                    <label>
                      <input
                        type="checkbox"
                        {...verifyForm.register('selfVerificationAcknowledged', {
                          validate: (value) =>
                            !elevatedSelfVerification ||
                            value ||
                            'Confirma la autoverificación para continuar.',
                        })}
                      />
                      Confirmo esta autoverificación y su trazabilidad.
                    </label>
                  ) : null}
                  {verifyForm.formState.errors.selfVerificationAcknowledged ? (
                    <p className="field-error">
                      {verifyForm.formState.errors.selfVerificationAcknowledged.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="inspection-server-calculation" role="note">
                <strong>Resultado automático</strong>
                <span>
                  Calcularemos automáticamente el resultado según la metodología utilizada. La
                  verificación puede cerrar el hallazgo y generar una señal si el riesgo residual
                  permanece alto o crítico.
                </span>
              </div>
              {verify.isError ? (
                <InlineRequestState>
                  No pudimos registrar la verificación. Las selecciones permanecen disponibles.
                </InlineRequestState>
              ) : null}
              <div className="inspection-dialog-actions">
                <button
                  className="button secondary"
                  type="button"
                  disabled={verify.isPending}
                  onClick={() => setShowVerify(false)}
                >
                  Cancelar
                </button>
                <button className="button" disabled={verify.isPending}>
                  {verify.isPending ? 'Verificando…' : 'Verificar riesgo residual'}
                </button>
              </div>
            </form>
          </InspectionDialog>
        </div>
      ) : null}
    </AccessGate>
  );
}

function SystemicReviewPanel({
  api,
  reviewId,
}: {
  api: ReturnType<typeof useInspectionApi>;
  reviewId: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [
      ...queryKeys.organization.inspectionAlerts(api.organizationId ?? 'inactive'),
      'systemic-review',
      reviewId,
    ],
    queryFn: ({ signal }) =>
      api.request<SystemicReview>(`/inspections/systemic-reviews/${reviewId}`, { signal }),
    enabled: Boolean(api.organizationId),
    retry: shouldRetryGet,
  });
  type SystemicReviewForm = {
    actionsSufficient: '' | 'YES' | 'NO' | 'NEEDS_MORE_INFORMATION';
    broaderReviewRecommended: '' | 'YES' | 'NO';
    notes: string;
    suspectedFactors: string;
  };
  const form = useForm<SystemicReviewForm>({
    defaultValues: {
      actionsSufficient: '',
      broaderReviewRecommended: '',
      notes: '',
      suspectedFactors: '',
    },
  });
  const complete = useMutation({
    mutationFn: (input: SystemicReviewForm) =>
      api.request<SystemicReview>(`/inspections/systemic-reviews/${reviewId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          actionsSufficient: input.actionsSufficient,
          broaderReviewRecommended: input.broaderReviewRecommended === 'YES',
          notes: input.notes || undefined,
          suspectedFactors: input.suspectedFactors || undefined,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspectionAlerts(api.organizationId!),
        }),
      ]);
    },
  });
  if (query.isLoading) return <p role="status">Cargando revisión sistémica…</p>;
  if (query.isError || !query.data)
    return <InlineRequestState>No pudimos cargar la revisión sistémica.</InlineRequestState>;
  const review = query.data;
  return (
    <section className="inspection-form-card" aria-labelledby={`systemic-review-${review.id}`}>
      <div className="inspection-section-heading">
        <div>
          <p className="eyebrow">Seguimiento profesional</p>
          <h4 id={`systemic-review-${review.id}`}>Revisión sistémica</h4>
        </div>
        <DomainStatusBadge domain="systemic-review" status={review.status} />
      </div>
      <p>
        {review.workCenterName} · {FINDING_CATEGORY_LABELS[review.category]} · ventana de{' '}
        {review.recurrenceWindowDays} días
      </p>
      <div className="inspection-related-links">
        {review.relatedFindingsSnapshot.map((item) => {
          const method = presentInspectionRiskMethod(item.riskMethodKey, item.riskMethodVersion);
          return (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <p>
                Riesgo inicial: {item.initialScore} · {riskLevelLabel(item.initialRiskLevel)}
              </p>
              <p>
                Riesgo residual:{' '}
                {item.residualScore
                  ? `${item.residualScore} · ${riskLevelLabel(item.residualRiskLevel)}`
                  : 'Pendiente'}
              </p>
              <p>
                Metodología utilizada: {method.displayName} · versión {method.version}
              </p>
            </article>
          );
        })}
      </div>
      <p className="inspection-invariant-note">
        Los valores se muestran dentro de su propia metodología; no se comparan escalas de métodos
        diferentes. Esta revisión no declara una causa raíz.
      </p>
      {review.status === 'COMPLETED' ? (
        <dl className="inspection-action-meta">
          <div>
            <dt>Acciones puntuales suficientes</dt>
            <dd>{systemicSufficiencyLabel(review.actionsSufficient)}</dd>
          </div>
          <div>
            <dt>Revisión más amplia</dt>
            <dd>{review.broaderReviewRecommended ? 'Recomendada' : 'No recomendada'}</dd>
          </div>
          {review.suspectedFactors ? (
            <div>
              <dt>Factores sospechados</dt>
              <dd>{review.suspectedFactors}</dd>
            </div>
          ) : null}
          {review.notes ? (
            <div>
              <dt>Notas</dt>
              <dd>{review.notes}</dd>
            </div>
          ) : null}
          <div>
            <dt>Completada por</dt>
            <dd>
              {review.completedBy?.displayName ?? 'Profesional autorizado'} ·{' '}
              {formatDate(review.completedAt)}
            </dd>
          </div>
        </dl>
      ) : (
        <form
          className="inspection-form"
          onSubmit={form.handleSubmit((input) => complete.mutate(input))}
        >
          <div className="field">
            <label htmlFor={`sufficiency-${review.id}`}>
              ¿Las acciones puntuales parecen suficientes?
            </label>
            <select
              id={`sufficiency-${review.id}`}
              {...form.register('actionsSufficient', { required: true })}
            >
              <option value="">Selecciona una respuesta</option>
              <option value="YES">Sí</option>
              <option value="NO">No</option>
              <option value="NEEDS_MORE_INFORMATION">Se necesita más información</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`broader-${review.id}`}>¿Se recomienda una revisión más amplia?</label>
            <select
              id={`broader-${review.id}`}
              {...form.register('broaderReviewRecommended', { required: true })}
            >
              <option value="">Selecciona una respuesta</option>
              <option value="YES">Sí</option>
              <option value="NO">No</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`factors-${review.id}`}>Factores sospechados · opcional</label>
            <textarea
              id={`factors-${review.id}`}
              rows={3}
              maxLength={2000}
              {...form.register('suspectedFactors')}
            />
            <p className="muted">
              Registra observaciones profesionales; no se convierten en una causa automática.
            </p>
          </div>
          <div className="field">
            <label htmlFor={`notes-${review.id}`}>Notas · opcional</label>
            <textarea
              id={`notes-${review.id}`}
              rows={3}
              maxLength={2000}
              {...form.register('notes')}
            />
          </div>
          {complete.isError ? (
            <InlineRequestState>No pudimos completar la revisión sistémica.</InlineRequestState>
          ) : null}
          <button className="button" disabled={complete.isPending}>
            {complete.isPending ? 'Guardando…' : 'Completar revisión sistémica'}
          </button>
        </form>
      )}
    </section>
  );
}

function systemicSufficiencyLabel(value?: string): string {
  return (
    {
      YES: 'Sí',
      NO: 'No',
      NEEDS_MORE_INFORMATION: 'Se necesita más información',
    }[value ?? ''] ?? 'Sin respuesta'
  );
}

export function InspectionAlerts({ filters = {} }: { filters?: InspectionAlertFilters }) {
  const api = useInspectionApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const filterKey = apiQuery(filters);
  const alerts = useQuery({
    queryKey: queryKeys.organization.inspectionAlertList(organizationId ?? 'inactive', filterKey),
    queryFn: ({ signal }) => api.request<AlertList>(`/inspections/alerts?${filterKey}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      api.request(`/inspections/alerts/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspectionAlerts(organizationId!),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.dashboard(organizationId!),
        }),
      ]);
    },
  });
  const createSystemicReview = useMutation({
    mutationFn: (alertId: string) =>
      api.request<SystemicReview>(`/inspections/alerts/${alertId}/systemic-review`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionAlerts(organizationId!),
      });
    },
  });
  const activeFilters = filters.status
    ? [{ key: 'status', label: statusMeta('alert', filters.status).label }]
    : [];

  return (
    <AccessGate api={api}>
      <div className="inspection-workspace stack">
        <InspectionPageHeader
          eyebrow="Operación · Alertas"
          title="Alertas de inspecciones"
          description="Revisa señales de recurrencia y riesgo residual alto o crítico sin convertirlas en diagnósticos de causa."
          context={<ContextLine>{api.organizationName ?? 'Organización activa'}</ContextLine>}
          actions={
            <Link className="button secondary" href="/app/inspections">
              Volver a inspecciones
            </Link>
          }
        />
        <div className="inspection-filter-panel focus-dim">
          <div className="inspection-filter-grid one">
            <label>
              <span>Estado de la alerta</span>
              <select
                aria-label="Filtrar alertas por estado"
                value={filters.status ?? ''}
                onChange={(event) =>
                  replaceFilters('/app/inspections/alerts', { status: event.target.value }, router)
                }
              >
                <option value="">Todos los estados</option>
                <option value="OPEN">Abiertas</option>
                <option value="ACKNOWLEDGED">Reconocidas</option>
                <option value="RESOLVED">Resueltas</option>
              </select>
            </label>
          </div>
          <ActiveFilters
            filters={activeFilters}
            onRemove={() => replaceFilters('/app/inspections/alerts', {}, router)}
            onClear={() => replaceFilters('/app/inspections/alerts', {}, router)}
          />
        </div>
        {alerts.isLoading ? (
          <InspectionSkeleton label="Cargando alertas" />
        ) : alerts.isError ? (
          <PageQueryError retry={() => void alerts.refetch()} />
        ) : alerts.data?.items.length ? (
          <section aria-labelledby="alerts-list-title">
            <div className="inspection-section-heading">
              <div>
                <p className="eyebrow">Atención operativa</p>
                <h2 id="alerts-list-title">Señales registradas</h2>
              </div>
              <span aria-live="polite">{resultCountLabel(alerts.data.total)}</span>
            </div>
            <div className="inspection-alert-list" data-density="compact">
              {alerts.data.items.map((alert) => (
                <Card className="inspection-alert-card" key={alert.id}>
                  <div className="inspection-alert-topline">
                    <DomainStatusBadge domain="alert" status={alert.status} />
                    <span>{alertTypeLabel(alert.type)}</span>
                    <span>{formatDate(alert.createdAt)}</span>
                  </div>
                  <h3>{alert.finding.title}</h3>
                  <p>
                    {alert.finding.workCenter.name}
                    {alert.finding.category
                      ? ` · ${FINDING_CATEGORY_LABELS[alert.finding.category]}`
                      : ''}
                  </p>
                  <p>{alert.message}</p>
                  {alert.type === 'RECURRENCE' ? (
                    <p className="inspection-invariant-note">
                      Este aviso indica recurrencia, no confirma una causa raíz.
                    </p>
                  ) : null}
                  <div className="inspection-action-controls">
                    <Link
                      className="button secondary"
                      href={`/app/inspections/${alert.finding.inspection.id}/findings/${alert.finding.id}`}
                    >
                      Ver hallazgo
                    </Link>
                    {alert.status === 'OPEN' && canAcknowledgeInspectionAlerts(api.role) ? (
                      <button
                        className="button"
                        type="button"
                        disabled={acknowledge.isPending}
                        onClick={() => acknowledge.mutate(alert.id)}
                      >
                        Marcar como revisada
                      </button>
                    ) : null}
                    {alert.type === 'RECURRENCE' &&
                    !alert.systemicReview &&
                    canAcknowledgeInspectionAlerts(api.role) ? (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={createSystemicReview.isPending}
                        onClick={() => createSystemicReview.mutate(alert.id)}
                      >
                        Iniciar revisión sistémica
                      </button>
                    ) : null}
                  </div>
                  {alert.acknowledgedAt ? (
                    <p className="inspection-invariant-note">
                      Revisada por {alert.acknowledgedBy?.displayName ?? 'usuario autorizado'} ·{' '}
                      {formatDate(alert.acknowledgedAt)}. Esto no elimina la recurrencia.
                    </p>
                  ) : null}
                  {alert.systemicReview ? (
                    <SystemicReviewPanel api={api} reviewId={alert.systemicReview.id} />
                  ) : null}
                  {alert.status === 'OPEN' && !canAcknowledgeInspectionAlerts(api.role) ? (
                    <p className="inspection-permission-inline">
                      Tu rol ({humanRoleLabel(api.role)}) puede analizar esta señal, pero solo{' '}
                      {VERIFY_ROLE_COPY} pueden marcarla como revisada. Los permisos se validan en
                      cada operación.
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <InspectionState
            kind="empty"
            title={
              activeFilters.length ? 'No hay alertas con este estado' : 'No hay alertas abiertas'
            }
            description="Las recurrencias y los riesgos residuales altos o críticos aparecerán aquí cuando se registren."
            action={
              activeFilters.length ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => replaceFilters('/app/inspections/alerts', {}, router)}
                >
                  Quitar filtros
                </button>
              ) : undefined
            }
          />
        )}
        {acknowledge.isError ? (
          <InlineRequestState>
            No pudimos reconocer la alerta. El registro permanece abierto; vuelve a intentarlo.
          </InlineRequestState>
        ) : null}
        {createSystemicReview.isError ? (
          <InlineRequestState>No pudimos iniciar la revisión sistémica.</InlineRequestState>
        ) : null}
      </div>
    </AccessGate>
  );
}

export function InspectionAnalytics({ filters = {} }: { filters?: InspectionAnalyticsFilters }) {
  const api = useInspectionApi();
  const router = useRouter();
  const organizationId = api.organizationId;
  const context = useInspectionContext(api);
  const filterKey = apiQuery(filters);
  const query = useQuery({
    queryKey: queryKeys.organization.inspectionAnalyticsSummary(
      organizationId ?? 'inactive',
      filterKey,
    ),
    queryFn: ({ signal }) =>
      api.request<Analytics>(`/inspections/analytics/summary?${filterKey}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const activeCenter = context.data?.workCenters.find(({ id }) => id === filters.workCenterId);
  const activeArea = activeCenter?.workAreas.find(({ id }) => id === filters.workAreaId);
  const activeFilters = [
    filters.workCenterId && {
      key: 'workCenterId',
      label: activeCenter?.name ?? 'Centro seleccionado',
    },
    filters.workAreaId && { key: 'workAreaId', label: activeArea?.name ?? 'Área seleccionada' },
    filters.category && {
      key: 'category',
      label: FINDING_CATEGORY_LABELS[filters.category as FindingCategory],
    },
  ].filter(Boolean) as Array<{ key: string; label: string }>;
  const totalFindings =
    query.data?.findingsByCategory.reduce((total, item) => total + item.count, 0) ?? 0;
  const closedFindings = Math.max(0, totalFindings - (query.data?.openFindings ?? 0));

  function updateFilter(key: keyof InspectionAnalyticsFilters, value: string) {
    const next = { ...filters, [key]: value || undefined };
    if (key === 'workCenterId') next.workAreaId = undefined;
    replaceFilters('/app/inspections/analytics', next, router);
  }

  return (
    <AccessGate api={api}>
      <div className="inspection-workspace stack">
        <InspectionPageHeader
          eyebrow="Análisis · Tendencias y recurrencias"
          title="Tendencias de inspecciones"
          description="Lee la operación con métricas calculadas exclusivamente a partir de registros almacenados."
          context={<ContextLine>{api.organizationName ?? 'Organización activa'}</ContextLine>}
          actions={
            <Link className="button secondary" href="/app/inspections">
              Volver a inspecciones
            </Link>
          }
        />
        <InspectionDemoNotice compact />
        <div className="inspection-filter-panel focus-dim">
          <div className="inspection-filter-grid">
            <label>
              <span>Centro</span>
              <select
                aria-label="Filtrar tendencias por centro"
                value={filters.workCenterId ?? ''}
                onChange={(event) => updateFilter('workCenterId', event.target.value)}
              >
                <option value="">Todos los centros</option>
                {context.data?.workCenters.map((center) => (
                  <option value={center.id} key={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Área</span>
              <select
                aria-label="Filtrar tendencias por área"
                value={filters.workAreaId ?? ''}
                disabled={!activeCenter}
                title={!activeCenter ? 'Selecciona primero un centro.' : undefined}
                onChange={(event) => updateFilter('workAreaId', event.target.value)}
              >
                <option value="">Todas las áreas</option>
                {activeCenter?.workAreas.map((area) => (
                  <option value={area.id} key={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Categoría</span>
              <select
                aria-label="Filtrar tendencias por categoría"
                value={filters.category ?? ''}
                onChange={(event) => updateFilter('category', event.target.value)}
              >
                <option value="">Todas las categorías</option>
                {FINDING_CATEGORIES.map((category) => (
                  <option value={category} key={category}>
                    {FINDING_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ActiveFilters
            filters={activeFilters}
            onRemove={(key) => updateFilter(key as keyof InspectionAnalyticsFilters, '')}
            onClear={() => replaceFilters('/app/inspections/analytics', {}, router)}
          />
        </div>
        {query.isLoading || context.isLoading ? (
          <InspectionSkeleton label="Cargando tendencias" />
        ) : query.isError || context.isError ? (
          <PageQueryError retry={() => void Promise.all([query.refetch(), context.refetch()])} />
        ) : query.data ? (
          query.data.totalInspections === 0 && activeFilters.length === 0 ? (
            <InspectionState
              kind="empty"
              title="Aún no hay datos de inspecciones"
              description="Las tendencias aparecerán cuando existan inspecciones y hallazgos almacenados."
              action={
                canWriteInspections(api.role) ? (
                  <Link className="button" href="/app/inspections/new">
                    Nueva inspección
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              <section aria-labelledby="analytics-summary-title">
                <div className="inspection-section-heading">
                  <div>
                    <p className="eyebrow">Resumen</p>
                    <h2 id="analytics-summary-title">Indicadores del contexto</h2>
                  </div>
                </div>
                <div className="inspection-metric-grid analytics">
                  <div className="inspection-metric static">
                    <strong>{query.data.totalInspections}</strong>
                    <span>Inspecciones</span>
                  </div>
                  <div className="inspection-metric static">
                    <strong>{query.data.openFindings}</strong>
                    <span>Hallazgos abiertos</span>
                  </div>
                  <div className="inspection-metric static">
                    <strong>{query.data.averageDaysOpen}</strong>
                    <span>Días abiertos en promedio · hallazgos abiertos del contexto</span>
                  </div>
                  <div className="inspection-metric static">
                    <strong>
                      {closedFindings} de {totalFindings}
                    </strong>
                    <span>Hallazgos cerrados · {query.data.percentageClosed}%</span>
                  </div>
                  <div className="inspection-metric static">
                    <strong>{query.data.overdueActions}</strong>
                    <span>Acciones vencidas</span>
                  </div>
                </div>
              </section>
              <div className="inspection-analytics-grid">
                <Card>
                  <h2>Hallazgos por categoría</h2>
                  {query.data.findingsByCategory.length ? (
                    query.data.findingsByCategory.map((item) => (
                      <div className="inspection-data-row" key={item.category}>
                        <span>{FINDING_CATEGORY_LABELS[item.category]}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Sin hallazgos para este contexto.</p>
                  )}
                </Card>
                <Card>
                  <h2>Hallazgos por centro</h2>
                  {query.data.findingsByWorkCenter.length ? (
                    query.data.findingsByWorkCenter.map((item) => (
                      <div className="inspection-data-row" key={item.workCenterId}>
                        <span>{item.name}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Sin hallazgos para este contexto.</p>
                  )}
                </Card>
                <Card id="risk-summary">
                  <h2>Riesgo inicial</h2>
                  <p className="inspection-caption">
                    Nivel y conteo calculados a partir del resultado registrado.
                  </p>
                  {query.data.findingsByRiskLevel.length ? (
                    query.data.findingsByRiskLevel.map((item) => (
                      <div className="inspection-data-row" key={item.riskLevel}>
                        <InspectionRiskBadge level={item.riskLevel} />
                        <strong>{item.count}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Sin valoraciones para este contexto.</p>
                  )}
                </Card>
                <Card>
                  <h2>Riesgo residual verificado</h2>
                  {query.data.initialVsResidual.residual.length ? (
                    query.data.initialVsResidual.residual.map((item) => (
                      <div className="inspection-data-row" key={item.riskLevel ?? 'pending'}>
                        <InspectionRiskBadge level={item.riskLevel} pending={!item.riskLevel} />
                        <strong>{item.count}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Todavía no hay verificaciones residuales.</p>
                  )}
                </Card>
              </div>
              <p className="inspection-invariant-note">
                Una recurrencia es una señal operacional. No confirma una causa raíz.
              </p>
            </>
          )
        ) : null}
      </div>
    </AccessGate>
  );
}
