'use client';

import { ApiClientError } from '@sst/api-client';
import type { TechnicalMethodSchema, TechnicalQuestion } from '@sst/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  canReviewTechnicalRisk,
  canWriteTechnicalRisk,
  isTechnicalAnswerValid,
  methodSnapshotProvenance,
  technicalMutationError,
  technicalReviewState,
  technicalRiskLabel,
  TECHNICAL_RISK_REVIEW_COPY,
} from '@/lib/technical-risk-experience';
import { queryKeys } from '@/lib/query-keys';
import {
  gtc45ConsequenceOptions,
  gtc45DeficiencyOptions,
  gtc45ExposureOptions,
  guidedHumanSeverityCriteria,
  guidedProbabilityCriteria,
} from '@/lib/risk-method-input-options';
import { AUTHORIZED_TECHNICAL_REVIEWER_LABELS, humanRoleLabel } from '@/lib/human-lexicon';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  AnswerSummary,
  MethodVersionSummary,
  ReviewHistory,
  TechnicalAssessmentStatus,
  TechnicalInlineMessage,
  TechnicalProgress,
  TechnicalQuestionField,
  TechnicalReviewDialog,
  TechnicalRiskBadge,
  TechnicalRiskDemoNotice,
  TechnicalRiskEntitlementState,
  TechnicalRiskPageHeader,
  TechnicalRiskPermissionState,
  TechnicalRiskSkeleton,
  TechnicalRiskState,
  type TechnicalAnswerValues,
} from './technical-risk-experience-ui';
import { useDashboardData } from './use-app-data';
import { WorkspaceInspector } from './workspace';

type Method = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  version: string;
  regulatory: boolean;
  isDemo: boolean;
  disclaimer: string | null;
  schema: TechnicalMethodSchema;
};

type WorkCenter = {
  id: string;
  name: string;
  city?: string;
  workAreas: Array<{ id: string; name: string }>;
};

type RiskMethodOption = {
  id: string;
  methodKey: 'GUIDED_5X5' | 'GTC45_2010' | 'DEMO_5X5';
  semanticVersion: string;
  displayName: string;
  disclaimer: string;
  publicationStatus: string;
};

type RiskMethodPolicy = {
  defaultRiskMethodVersionId: string;
  allowedMethods: Array<{ riskMethodVersionId: string }>;
};

type TechnicalResponse = {
  id: string;
  questionKey: string;
  value: unknown;
  updatedAt: string;
};

type TechnicalResult = {
  score: number | null;
  level: string | null;
  result?: Record<string, unknown>;
  calculatedAt: string;
  methodKey: string;
  methodVersion: string;
};

type TechnicalReview = {
  id: string;
  decision: string;
  comment?: string;
  createdAt: string;
  reviewer: { displayName: string };
  isSelfReview?: boolean;
  selfReviewAcknowledged?: boolean;
};

type Assessment = {
  id: string;
  title: string;
  description?: string;
  status: string;
  methodVersionId: string;
  methodKey: string;
  methodVersion: string;
  calculationKey: string;
  methodSnapshot: {
    methodName: string;
    regulatory: boolean;
    isDemo: boolean;
    disclaimer: string | null;
    schema: TechnicalMethodSchema;
  };
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  reviewedAt?: string;
  workCenter: { id: string; name: string; city?: string };
  workArea?: { id: string; name: string };
  createdBy: { id: string; displayName: string; email: string };
  reviewedBy?: { id: string; displayName: string };
  responses?: TechnicalResponse[];
  result?: TechnicalResult;
  evidence?: Array<{
    id: string;
    type: string;
    questionKey?: string;
    note?: string;
    externalUrl?: string;
    createdAt?: string;
    createdBy: { displayName: string };
  }>;
  reviews?: TechnicalReview[];
  riskValuation?: {
    riskMethodVersionId: string;
    riskInput: Record<string, unknown>;
    riskResult: Record<string, unknown>;
    calculatedAt: string;
    methodSnapshot: {
      methodKey: string;
      semanticVersion: string;
      displayName: string;
    };
    riskMethodVersion: {
      disclaimer: string;
      methodDefinition: { methodKey: string };
      sourceLinks: Array<{
        methodologySourceVersion: { title: string; issuer: string; edition: string };
      }>;
    };
  };
  regulatoryLinks?: Array<{
    id: string;
    provenance: string;
    rationale: string;
    unit?: {
      id: string;
      identifier: string;
      locator: string;
      sourceVersion: { source: { sourceKey: string; canonicalTitle: string } };
    };
    requirement?: { title: string };
  }>;
  revisedFrom?: {
    id: string;
    title: string;
    status: string;
    methodVersionId: string;
    methodKey: string;
    methodVersion: string;
    reviews: Array<{ decision: string; comment?: string; createdAt: string }>;
  };
  revision?: { id: string; title: string; status: string; createdAt: string };
};

function RiskValuationSummary({ assessment }: { assessment: Assessment }) {
  const valuation = assessment.riskValuation;
  if (!valuation) return null;
  const result = valuation.riskResult;
  const score =
    typeof result.score === 'number'
      ? result.score
      : typeof result.riskValue === 'number'
        ? result.riskValue
        : null;
  const level = String(result.level ?? result.riskLevel ?? 'Resultado registrado');
  return (
    <section
      className="technical-method-summary"
      aria-labelledby={`risk-valuation-${assessment.id}`}
    >
      <div>
        <p className="technical-risk-kicker">Metodología de valoración</p>
        <h2 id={`risk-valuation-${assessment.id}`}>{valuation.methodSnapshot.displayName}</h2>
        <p>
          Resultado determinístico:{' '}
          <strong>
            {technicalRiskLabel(level)}
            {score === null ? '' : ` · ${score}`}
          </strong>
        </p>
        <small>
          Versión exacta {valuation.methodSnapshot.semanticVersion} · calculada{' '}
          {formatDateTime(valuation.calculatedAt)}
        </small>
      </div>
      <div>
        <p>{valuation.riskMethodVersion.disclaimer}</p>
        {valuation.riskMethodVersion.sourceLinks.length ? (
          <p>
            <strong>Fuente metodológica:</strong>{' '}
            {valuation.riskMethodVersion.sourceLinks
              .map(
                ({ methodologySourceVersion }) =>
                  `${methodologySourceVersion.title} · ${methodologySourceVersion.issuer}`,
              )
              .join('; ')}
          </p>
        ) : (
          <p>Fuente metodológica candidata sin texto técnico reproducido.</p>
        )}
        <p className="technical-invariant-note">
          La metodología técnica y el fundamento normativo son procedencias diferentes.
        </p>
      </div>
    </section>
  );
}

function RegulatoryReferenceSummary({ assessment }: { assessment: Assessment }) {
  if (!assessment.regulatoryLinks?.length) return null;
  return (
    <section
      className="technical-method-summary"
      aria-labelledby={`regulatory-reference-${assessment.id}`}
    >
      <div>
        <p className="technical-risk-kicker">Fundamento normativo</p>
        <h2 id={`regulatory-reference-${assessment.id}`}>Artículos relacionados</h2>
        <p>
          Estas referencias documentan procedencia. No prueban por sí solas cumplimiento o
          incumplimiento.
        </p>
      </div>
      <div className="stack-sm">
        {assessment.regulatoryLinks.map((link) => (
          <div key={link.id}>
            <strong>{link.requirement?.title ?? 'Referencia regulatoria'}</strong>
            {link.unit ? (
              <p>
                {link.unit.sourceVersion.source.canonicalTitle} · {link.unit.identifier} ·{' '}
                {link.unit.locator}
              </p>
            ) : null}
            <p>{link.rationale}</p>
            {link.unit ? (
              <Link
                href={`/app/applicability/sources/${link.unit.sourceVersion.source.sourceKey}/units/${link.unit.id}`}
              >
                Ver fundamento normativo
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

type Analytics = {
  total: number;
  draft: number;
  completed: number;
  reviewed: number;
  highCritical: number;
  byMethod: Array<{ methodKey: string; count: number }>;
  byCenter: Array<{ workCenterId?: string; name: string; count: number }>;
  byRiskLevel: Array<{ level: string | null; count: number }>;
};

type ListResponse = { items: Assessment[]; analytics: Analytics };

const REVIEW_ROLE_COPY = AUTHORIZED_TECHNICAL_REVIEWER_LABELS;

function allQuestions(schema: TechnicalMethodSchema): TechnicalQuestion[] {
  return schema.sections.flatMap((section) => section.questions);
}

function formatDate(value?: string): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value?: string): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function shouldRetryGet(failureCount: number, error: Error): boolean {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 1;
}

function useTechnicalRiskApi() {
  const auth = useAuth();
  const organization = useOrganization();
  const dashboard = useDashboardData();
  const activeOrganization = organization.organizations.find(
    (candidate) => candidate.id === organization.activeId,
  );
  return {
    userId: auth.user?.id,
    organizationId: organization.activeId,
    organizationName: activeOrganization?.name,
    role: activeOrganization?.memberships[0]?.role,
    planName: dashboard.data?.entitlements.plan.name,
    moduleEnabled: dashboard.data?.entitlements.features['module.technical_risk'] === true,
    accessLoading: organization.loading || dashboard.isLoading,
    accessError: dashboard.isError,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function TechnicalRiskAccessGate({
  api,
  children,
}: {
  api: ReturnType<typeof useTechnicalRiskApi>;
  children: React.ReactNode;
}) {
  if (api.accessLoading)
    return <TechnicalRiskSkeleton label="Comprobando acceso a Riesgo técnico" />;
  if (!api.organizationId) {
    return (
      <TechnicalRiskState
        kind="info"
        title="Selecciona una organización"
        description="El contexto de organización es necesario antes de consultar evaluaciones técnicas."
      />
    );
  }
  if (api.accessError) {
    return (
      <TechnicalRiskState
        kind="error"
        title="No pudimos comprobar el acceso"
        description="Revisa tu conexión y vuelve a intentarlo. La navegación permanece disponible."
      />
    );
  }
  if (!api.moduleEnabled) return <TechnicalRiskEntitlementState planName={api.planName} />;
  return children;
}

function PageQueryError({ retry, object = 'esta vista' }: { retry(): void; object?: string }) {
  return (
    <TechnicalRiskState
      kind="error"
      title={`No pudimos cargar ${object}`}
      description="Revisa tu conexión. No se modificó ningún registro."
      action={
        <button className="button secondary" type="button" onClick={retry}>
          Reintentar
        </button>
      }
    />
  );
}

type WorkspaceFilter = 'ALL' | 'CONTINUE' | 'COMPLETED' | 'REVIEWED' | 'HIGH_CRITICAL';

function filterAssessments(items: Assessment[], filter: WorkspaceFilter): Assessment[] {
  if (filter === 'ALL') return items;
  if (filter === 'CONTINUE') {
    return items.filter(({ status }) => status === 'DRAFT' || status === 'IN_PROGRESS');
  }
  if (filter === 'HIGH_CRITICAL') {
    return items.filter(({ result }) => result?.level === 'HIGH' || result?.level === 'CRITICAL');
  }
  return items.filter(({ status }) => status === filter);
}

function workspaceActionLabel(status: string): string {
  if (status === 'DRAFT') return 'Iniciar evaluación';
  if (status === 'IN_PROGRESS') return 'Continuar evaluación';
  if (status === 'COMPLETED') return 'Ver resultado y revisión';
  return 'Ver evaluación';
}

export function TechnicalRiskDashboard() {
  const api = useTechnicalRiskApi();
  const organizationId = api.organizationId;
  const [filter, setFilter] = useState<WorkspaceFilter>('ALL');
  const assessments = useQuery({
    queryKey: queryKeys.organization.technicalRiskAssessments(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<ListResponse>('/technical-risk/assessments', { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const methods = useQuery({
    queryKey: queryKeys.organization.technicalRiskMethods(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<Method[]>('/technical-risk/methods', { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
    staleTime: 5 * 60_000,
  });

  return (
    <TechnicalRiskAccessGate api={api}>
      {assessments.isLoading || methods.isLoading ? (
        <TechnicalRiskSkeleton label="Cargando workspace de Riesgo técnico" />
      ) : assessments.isError || methods.isError ? (
        <PageQueryError
          retry={() => void Promise.all([assessments.refetch(), methods.refetch()])}
        />
      ) : (
        <TechnicalRiskWorkspace
          api={api}
          data={assessments.data!}
          methods={methods.data!}
          filter={filter}
          onFilterChange={setFilter}
        />
      )}
    </TechnicalRiskAccessGate>
  );
}

function TechnicalRiskWorkspace({
  api,
  data,
  methods,
  filter,
  onFilterChange,
}: {
  api: ReturnType<typeof useTechnicalRiskApi>;
  data: ListResponse;
  methods: Method[];
  filter: WorkspaceFilter;
  onFilterChange(filter: WorkspaceFilter): void;
}) {
  const { items, analytics } = data;
  const filtered = filterAssessments(items, filter);
  const continueCount = items.filter(
    ({ status }) => status === 'DRAFT' || status === 'IN_PROGRESS',
  ).length;
  const metrics: Array<{ key: WorkspaceFilter; label: string; value: number }> = [
    { key: 'ALL', label: 'Evaluaciones', value: analytics.total },
    { key: 'CONTINUE', label: 'Por continuar', value: continueCount },
    { key: 'COMPLETED', label: 'Revisión pendiente', value: analytics.completed },
    { key: 'REVIEWED', label: 'Revisadas', value: analytics.reviewed },
    { key: 'HIGH_CRITICAL', label: 'Alto o crítico', value: analytics.highCritical },
  ];
  const activeLabel = metrics.find(({ key }) => key === filter)?.label ?? 'Evaluaciones';
  return (
    <div className="technical-risk-workspace stack-lg" data-density="compact">
      <TechnicalRiskPageHeader
        eyebrow="Evaluaciones · Riesgo técnico"
        title="Riesgo técnico"
        description="Ejecuta métodos versionados, consulta resultados determinísticos y separa claramente la revisión profesional."
        context={
          <p className="technical-risk-context">
            {api.organizationName ?? 'Organización activa'} · {humanRoleLabel(api.role)}
          </p>
        }
        actions={
          canWriteTechnicalRisk(api.role) && methods.length > 0 ? (
            <Link className="button" href="/app/technical-risk/new">
              Nueva evaluación técnica
            </Link>
          ) : undefined
        }
      />

      <section className="technical-workspace-section" aria-labelledby="technical-methods-title">
        <div className="technical-section-heading">
          <div>
            <p className="technical-risk-kicker">Catálogo activo</p>
            <h2 id="technical-methods-title">Métodos disponibles</h2>
          </div>
          <span>
            {methods.length} {methods.length === 1 ? 'versión activa' : 'versiones activas'}
          </span>
        </div>
        {methods.length === 0 ? (
          <TechnicalRiskState
            kind="empty"
            title="No hay métodos activos"
            description="No es posible crear una evaluación hasta que exista una versión activa para esta organización."
          />
        ) : (
          <div className="technical-method-catalog">
            {methods.map((method) => (
              <article className="technical-method-card" key={method.id}>
                <div>
                  <span className="demo-chip">
                    {method.isDemo ? 'Demostración' : 'Método activo'}
                  </span>
                  <h3>{method.name}</h3>
                  <p>{method.description}</p>
                </div>
                <dl>
                  <div>
                    <dt>Código</dt>
                    <dd>
                      <code>{method.key}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Versión</dt>
                    <dd className="mono">{method.version}</dd>
                  </div>
                </dl>
                {method.isDemo ? <TechnicalRiskDemoNotice disclaimer={method.disclaimer} /> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {!canWriteTechnicalRisk(api.role) ? (
        <TechnicalRiskPermissionState role={api.role} capability="crear o completar evaluaciones" />
      ) : null}

      <section
        className="technical-workspace-section"
        aria-labelledby="technical-assessments-title"
      >
        <div className="technical-section-heading">
          <div>
            <p className="technical-risk-kicker">Workspace operativo</p>
            <h2 id="technical-assessments-title">Evaluaciones</h2>
          </div>
          <span aria-live="polite">{filtered.length} resultados</span>
        </div>
        <div className="technical-metric-grid" aria-label="Filtros por estado real">
          {metrics.map((metric) => (
            <button
              type="button"
              className="technical-metric"
              aria-pressed={filter === metric.key}
              onClick={() => onFilterChange(metric.key)}
              key={metric.key}
            >
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <small>{filter === metric.key ? 'Filtro activo' : 'Filtrar lista'}</small>
            </button>
          ))}
        </div>
        {filter !== 'ALL' ? (
          <div className="technical-active-filter" role="status">
            <span>Filtro aplicado: {activeLabel}</span>
            <button type="button" onClick={() => onFilterChange('ALL')}>
              Quitar filtro
            </button>
          </div>
        ) : null}
        {items.length === 0 ? (
          <TechnicalRiskState
            kind="empty"
            title="Aún no existen evaluaciones"
            description="Crea la primera evaluación con un método activo. Su versión quedará fijada al crearla."
            action={
              canWriteTechnicalRisk(api.role) && methods.length > 0 ? (
                <Link className="button" href="/app/technical-risk/new">
                  Crear la primera evaluación
                </Link>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <TechnicalRiskState
            kind="empty"
            title="No hay evaluaciones con este filtro"
            description="Los demás estados permanecen disponibles al quitar el filtro."
            action={
              <button
                className="button secondary"
                type="button"
                onClick={() => onFilterChange('ALL')}
              >
                Ver todas
              </button>
            }
          />
        ) : (
          <div className="technical-assessment-list" role="list">
            {filtered.map((assessment) => (
              <article className="technical-assessment-row" role="listitem" key={assessment.id}>
                <div className="technical-assessment-primary">
                  <div className="technical-assessment-badges">
                    <TechnicalAssessmentStatus status={assessment.status} />
                    {assessment.result ? (
                      <TechnicalRiskBadge
                        level={assessment.result.level}
                        score={assessment.result.score}
                      />
                    ) : null}
                    {assessment.isDemo ? <span className="demo-chip">Demostración</span> : null}
                  </div>
                  <h3>{assessment.title}</h3>
                  <p>
                    {assessment.workCenter.name}
                    {assessment.workArea ? ` · ${assessment.workArea.name}` : ''}
                  </p>
                </div>
                <dl className="technical-assessment-meta">
                  <div>
                    <dt>Método</dt>
                    <dd>
                      <code>{assessment.methodKey}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Versión</dt>
                    <dd className="mono">{assessment.methodVersion}</dd>
                  </div>
                  <div>
                    <dt>Actualizada</dt>
                    <dd>{formatDate(assessment.updatedAt ?? assessment.createdAt)}</dd>
                  </div>
                </dl>
                <Link
                  className="technical-row-action"
                  href={`/app/technical-risk/${assessment.id}`}
                  aria-label={`${workspaceActionLabel(assessment.status)}: ${assessment.title}`}
                >
                  {workspaceActionLabel(assessment.status)} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {analytics.byMethod.length || analytics.byCenter.length ? (
        <details className="technical-analytics focus-dim">
          <summary>Ver distribución operativa</summary>
          <div>
            <section>
              <h3>Por método</h3>
              {analytics.byMethod.map((item) => (
                <p key={item.methodKey}>
                  <code>{item.methodKey}</code>
                  <strong>{item.count}</strong>
                </p>
              ))}
            </section>
            <section>
              <h3>Por centro</h3>
              {analytics.byCenter.map((item) => (
                <p key={item.workCenterId ?? item.name}>
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </p>
              ))}
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
}

type CreateAssessmentForm = {
  methodVersionId: string;
  riskMethodVersionId: string;
  workCenterId: string;
  workAreaId: string;
  title: string;
  description: string;
  guidedProbability?: number;
  guidedSeverity?: number;
  gtcDeficiency: '' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  gtcExposure?: number;
  gtcConsequence?: number;
  riskRationale: string;
};

function technicalRiskMethodInput(methodKey: string | undefined, values: CreateAssessmentForm) {
  if (methodKey === 'GUIDED_5X5')
    return {
      probability: Number(values.guidedProbability),
      severity: Number(values.guidedSeverity),
      severityDimension: 'HUMAN',
      checkedProbabilityCueKeys: [],
      checkedSeverityCueKeys: [],
      selectionRationale: values.riskRationale,
    };
  return {
    deficiency: values.gtcDeficiency,
    exposure: Number(values.gtcExposure),
    consequence: Number(values.gtcConsequence),
    professionalRationale: values.riskRationale,
  };
}

export function NewTechnicalAssessment() {
  const api = useTechnicalRiskApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const [step, setStep] = useState(1);
  const [requestError, setRequestError] = useState<string | null>(null);
  const form = useForm<CreateAssessmentForm>({
    defaultValues: {
      methodVersionId: '',
      riskMethodVersionId: '',
      workCenterId: '',
      workAreaId: '',
      title: '',
      description: '',
      gtcDeficiency: '',
      riskRationale: '',
    },
  });
  const methods = useQuery({
    queryKey: queryKeys.organization.technicalRiskMethods(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<Method[]>('/technical-risk/methods', { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
    staleTime: 5 * 60_000,
  });
  const context = useQuery({
    queryKey: queryKeys.organization.technicalRiskContext(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<{ workCenters: WorkCenter[] }>(`/organizations/${organizationId}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const riskMethods = useQuery({
    queryKey: queryKeys.organization.riskMethods(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<RiskMethodOption[]>('/technical-risk/risk-methods', { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
    staleTime: 5 * 60_000,
  });
  const riskPolicy = useQuery({
    queryKey: [...queryKeys.organization.riskMethods(organizationId ?? 'inactive'), 'policy'],
    queryFn: ({ signal }) =>
      api.request<RiskMethodPolicy>('/technical-risk/risk-method-policy', { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const allowedRiskMethods = (riskMethods.data ?? []).filter(
    (method) =>
      method.methodKey !== 'DEMO_5X5' &&
      riskPolicy.data?.allowedMethods.some(
        ({ riskMethodVersionId }) => riskMethodVersionId === method.id,
      ),
  );
  useEffect(() => {
    if (!form.getValues('riskMethodVersionId') && riskPolicy.data?.defaultRiskMethodVersionId)
      form.setValue('riskMethodVersionId', riskPolicy.data.defaultRiskMethodVersionId);
  }, [form, riskPolicy.data?.defaultRiskMethodVersionId]);
  const selectedMethod = methods.data?.find(({ id }) => id === form.watch('methodVersionId'));
  const selectedRiskMethod = riskMethods.data?.find(
    ({ id }) => id === form.watch('riskMethodVersionId'),
  );
  const selectedCenter = context.data?.workCenters.find(
    ({ id }) => id === form.watch('workCenterId'),
  );
  const create = useMutation({
    mutationFn: (values: CreateAssessmentForm) =>
      api.request<Assessment>('/technical-risk/assessments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          methodVersionId: values.methodVersionId,
          riskMethodVersionId: values.riskMethodVersionId,
          riskInput: technicalRiskMethodInput(selectedRiskMethod?.methodKey, values),
          workCenterId: values.workCenterId,
          workAreaId: values.workAreaId || undefined,
          title: values.title,
          description: values.description || undefined,
        }),
      }),
    onSuccess: async (assessment) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.technicalRiskAssessments(organizationId!),
      });
      router.push(`/app/technical-risk/${assessment.id}`);
    },
    onError: (error) => setRequestError(technicalMutationError(error).message),
  });

  async function continueCreation() {
    setRequestError(null);
    const valid =
      step === 1
        ? await form.trigger(['methodVersionId', 'riskMethodVersionId'], { shouldFocus: true })
        : await form.trigger(
            [
              'workCenterId',
              'title',
              'riskRationale',
              ...(selectedRiskMethod?.methodKey === 'GUIDED_5X5'
                ? (['guidedProbability', 'guidedSeverity'] as const)
                : (['gtcDeficiency', 'gtcExposure', 'gtcConsequence'] as const)),
            ],
            { shouldFocus: true },
          );
    if (valid) setStep((current) => Math.min(3, current + 1));
  }

  return (
    <TechnicalRiskAccessGate api={api}>
      {!canWriteTechnicalRisk(api.role) ? (
        <TechnicalRiskPermissionState role={api.role} capability="crear o completar evaluaciones" />
      ) : methods.isPending ||
        context.isPending ||
        riskMethods.isPending ||
        riskPolicy.isPending ? (
        <TechnicalRiskSkeleton label="Preparando nueva evaluación técnica" />
      ) : methods.isError || context.isError || riskMethods.isError || riskPolicy.isError ? (
        <PageQueryError
          object="la creación de la evaluación"
          retry={() =>
            void Promise.all([
              methods.refetch(),
              context.refetch(),
              riskMethods.refetch(),
              riskPolicy.refetch(),
            ])
          }
        />
      ) : methods.data!.length === 0 ? (
        <TechnicalRiskState
          kind="empty"
          title="No hay métodos activos"
          description="No se puede crear una evaluación sin una versión activa en el catálogo."
          action={
            <Link className="button secondary" href="/app/technical-risk">
              Volver al workspace
            </Link>
          }
        />
      ) : (
        <div className="technical-assessment-create stack-lg">
          <TechnicalRiskPageHeader
            eyebrow={`Riesgo técnico · paso ${step} de 3`}
            title="Nueva evaluación técnica"
            description="Define qué se evaluará y fija una versión real del método. Las respuestas se registran después de crear el borrador."
            context={
              <p className="technical-risk-context">
                {api.organizationName} · {humanRoleLabel(api.role)}
              </p>
            }
          />
          <TechnicalProgress
            current={step}
            total={3}
            label={`Paso ${step} de 3 · ${['Método', 'Contexto', 'Confirmación'][step - 1]}`}
          />
          <form onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate>
            {step === 1 ? (
              <section className="technical-form-panel" aria-labelledby="create-method-title">
                <p className="technical-risk-kicker">Paso 1 de 3</p>
                <h2 id="create-method-title">Selecciona el método</h2>
                <div className="technical-field">
                  <label htmlFor="technical-method">Método técnico</label>
                  <select
                    id="technical-method"
                    aria-invalid={Boolean(form.formState.errors.methodVersionId)}
                    aria-describedby={
                      form.formState.errors.methodVersionId ? 'technical-method-error' : undefined
                    }
                    {...form.register('methodVersionId', {
                      required: 'Selecciona una versión activa del método.',
                    })}
                  >
                    <option value="">Selecciona un método</option>
                    {methods.data!.map((method) => (
                      <option value={method.id} key={method.id}>
                        {method.name} · v{method.version}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.methodVersionId ? (
                    <p className="field-error" id="technical-method-error">
                      {form.formState.errors.methodVersionId.message}
                    </p>
                  ) : null}
                </div>
                {selectedMethod ? (
                  <MethodVersionSummary
                    name={selectedMethod.name}
                    code={selectedMethod.key}
                    version={selectedMethod.version}
                    isDemo={selectedMethod.isDemo}
                    disclaimer={selectedMethod.disclaimer}
                  />
                ) : null}
                <div className="technical-field">
                  <label htmlFor="technical-risk-method">
                    Metodología de valoración del riesgo
                  </label>
                  <select
                    id="technical-risk-method"
                    {...form.register('riskMethodVersionId', {
                      required: 'Selecciona una metodología de valoración permitida.',
                    })}
                  >
                    <option value="">Selecciona una metodología</option>
                    {allowedRiskMethods.map((method) => (
                      <option value={method.id} key={method.id}>
                        {method.displayName} · v{method.semanticVersion}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.riskMethodVersionId ? (
                    <p className="field-error">
                      {form.formState.errors.riskMethodVersionId.message}
                    </p>
                  ) : null}
                  {selectedRiskMethod ? (
                    <p className="technical-field-help">{selectedRiskMethod.disclaimer}</p>
                  ) : null}
                </div>
              </section>
            ) : null}
            {step === 2 ? (
              <section className="technical-form-panel" aria-labelledby="create-context-title">
                <p className="technical-risk-kicker">Paso 2 de 3</p>
                <h2 id="create-context-title">Contexto de la evaluación</h2>
                <div className="technical-form-grid">
                  <div className="technical-field">
                    <label htmlFor="technical-center">Centro de trabajo</label>
                    <select
                      id="technical-center"
                      aria-invalid={Boolean(form.formState.errors.workCenterId)}
                      aria-describedby={
                        form.formState.errors.workCenterId ? 'technical-center-error' : undefined
                      }
                      {...form.register('workCenterId', {
                        required: 'Selecciona un centro de trabajo.',
                      })}
                    >
                      <option value="">Selecciona un centro</option>
                      {context.data!.workCenters.map((center) => (
                        <option value={center.id} key={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.workCenterId ? (
                      <p className="field-error" id="technical-center-error">
                        {form.formState.errors.workCenterId.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="technical-field">
                    <label htmlFor="technical-area">Área</label>
                    <select id="technical-area" {...form.register('workAreaId')}>
                      <option value="">Sin área específica</option>
                      {selectedCenter?.workAreas.map((area) => (
                        <option value={area.id} key={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="technical-field">
                  <label htmlFor="technical-title">Título</label>
                  <input
                    id="technical-title"
                    maxLength={160}
                    aria-invalid={Boolean(form.formState.errors.title)}
                    aria-describedby={
                      form.formState.errors.title ? 'technical-title-error' : 'technical-title-help'
                    }
                    {...form.register('title', {
                      required: 'Escribe un título para identificar la evaluación.',
                      minLength: {
                        value: 3,
                        message: 'El título debe tener al menos 3 caracteres.',
                      },
                    })}
                  />
                  <p className="technical-field-help" id="technical-title-help">
                    Describe claramente qué actividad o contexto se evaluará.
                  </p>
                  {form.formState.errors.title ? (
                    <p className="field-error" id="technical-title-error">
                      {form.formState.errors.title.message}
                    </p>
                  ) : null}
                </div>
                <fieldset className="risk-method-options">
                  <legend>Valoración inicial · {selectedRiskMethod?.displayName}</legend>
                  {selectedRiskMethod?.methodKey === 'GUIDED_5X5' ? (
                    <div className="inspection-form-grid">
                      <label>
                        Probabilidad
                        <select
                          {...form.register('guidedProbability', {
                            required: 'Selecciona probabilidad.',
                            valueAsNumber: true,
                          })}
                        >
                          <option value="">Selecciona</option>
                          {guidedProbabilityCriteria.map((criterion) => (
                            <option key={criterion.value} value={criterion.value}>
                              {criterion.label} · {criterion.value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Severidad humana
                        <select
                          {...form.register('guidedSeverity', {
                            required: 'Selecciona severidad.',
                            valueAsNumber: true,
                          })}
                        >
                          <option value="">Selecciona</option>
                          {guidedHumanSeverityCriteria.map((criterion) => (
                            <option key={criterion.value} value={criterion.value}>
                              {criterion.label} · {criterion.value}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="inspection-form-grid">
                      <label>
                        Nivel de deficiencia
                        <select
                          {...form.register('gtcDeficiency', {
                            required: 'Selecciona deficiencia.',
                          })}
                        >
                          <option value="">Selecciona</option>
                          {gtc45DeficiencyOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Nivel de exposición
                        <select
                          {...form.register('gtcExposure', {
                            required: 'Selecciona exposición.',
                            valueAsNumber: true,
                          })}
                        >
                          <option value="">Selecciona</option>
                          {gtc45ExposureOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label} · {option.value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Nivel de consecuencia
                        <select
                          {...form.register('gtcConsequence', {
                            required: 'Selecciona consecuencia.',
                            valueAsNumber: true,
                          })}
                        >
                          <option value="">Selecciona</option>
                          {gtc45ConsequenceOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label} · {option.value}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <label className="technical-field">
                    Justificación profesional
                    <textarea
                      rows={4}
                      maxLength={1000}
                      {...form.register('riskRationale', {
                        required: 'Explica la selección profesional.',
                      })}
                    />
                  </label>
                  <p className="inspection-invariant-note">
                    La API valida y calcula el resultado. La revisión profesional permanece como un
                    paso separado.
                  </p>
                </fieldset>
                <div className="technical-field">
                  <label htmlFor="technical-description">Descripción · opcional</label>
                  <textarea
                    id="technical-description"
                    rows={4}
                    maxLength={2000}
                    {...form.register('description')}
                  />
                </div>
              </section>
            ) : null}
            {step === 3 ? (
              <section className="technical-form-panel" aria-labelledby="create-confirm-title">
                <p className="technical-risk-kicker">Paso 3 de 3</p>
                <h2 id="create-confirm-title">Confirma el borrador</h2>
                <dl className="technical-description-list">
                  <div>
                    <dt>Evaluación</dt>
                    <dd>{form.getValues('title')}</dd>
                  </div>
                  <div>
                    <dt>Centro</dt>
                    <dd>{selectedCenter?.name}</dd>
                  </div>
                  <div>
                    <dt>Área</dt>
                    <dd>
                      {selectedCenter?.workAreas.find(
                        ({ id }) => id === form.getValues('workAreaId'),
                      )?.name ?? 'Sin área específica'}
                    </dd>
                  </div>
                  <div>
                    <dt>Método</dt>
                    <dd>{selectedMethod?.name}</dd>
                  </div>
                  <div>
                    <dt>Versión fijada</dt>
                    <dd className="mono">{selectedMethod?.version}</dd>
                  </div>
                </dl>
                {selectedMethod?.isDemo ? (
                  <TechnicalRiskDemoNotice disclaimer={selectedMethod.disclaimer} />
                ) : null}
                <p className="technical-server-note">
                  Esta versión quedará fijada en el borrador. Iniciar y completar serán acciones
                  posteriores y separadas.
                </p>
              </section>
            ) : null}
            {requestError ? <TechnicalInlineMessage>{requestError}</TechnicalInlineMessage> : null}
            <div className="technical-wizard-actions">
              <button
                className="button secondary"
                type="button"
                disabled={step === 1 || create.isPending}
                onClick={() => setStep((current) => Math.max(1, current - 1))}
              >
                Atrás
              </button>
              <Link className="button secondary focus-dim" href="/app/technical-risk">
                Cancelar
              </Link>
              {step < 3 ? (
                <button
                  key="continue-creation"
                  className="button"
                  type="button"
                  onClick={() => void continueCreation()}
                >
                  Continuar
                </button>
              ) : (
                <button
                  key="submit-creation"
                  className="button"
                  type="submit"
                  disabled={create.isPending}
                >
                  {create.isPending ? 'Creando borrador…' : 'Crear borrador'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </TechnicalRiskAccessGate>
  );
}

export function TechnicalAssessmentDetail({ assessmentId }: { assessmentId: string }) {
  const api = useTechnicalRiskApi();
  const organizationId = api.organizationId;
  const query = useQuery({
    queryKey: queryKeys.organization.technicalRiskAssessment(
      organizationId ?? 'inactive',
      assessmentId,
    ),
    queryFn: ({ signal }) =>
      api.request<Assessment>(`/technical-risk/assessments/${assessmentId}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  return (
    <TechnicalRiskAccessGate api={api}>
      {query.isLoading ? (
        <TechnicalRiskSkeleton label="Cargando evaluación técnica" />
      ) : query.isError || !query.data ? (
        <PageQueryError object="la evaluación" retry={() => void query.refetch()} />
      ) : query.data.status === 'DRAFT' || query.data.status === 'IN_PROGRESS' ? (
        <TechnicalAssessmentExecution
          api={api}
          assessment={query.data}
          refetch={() => query.refetch()}
        />
      ) : (
        <TechnicalAssessmentResult api={api} assessment={query.data} />
      )}
    </TechnicalRiskAccessGate>
  );
}

function TechnicalAssessmentExecution({
  api,
  assessment,
  refetch,
}: {
  api: ReturnType<typeof useTechnicalRiskApi>;
  assessment: Assessment;
  refetch(): Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const questions = allQuestions(assessment.methodSnapshot.schema);
  const initialAnswers = Object.fromEntries(
    assessment.responses?.map(({ questionKey, value }) => [questionKey, value]) ?? [],
  );
  const answerForm = useForm<TechnicalAnswerValues>({ defaultValues: { answers: initialAnswers } });
  const evidenceForm = useForm<{
    type: 'NOTE' | 'EXTERNAL_LINK';
    note: string;
    externalUrl: string;
  }>({
    defaultValues: { type: 'NOTE', note: '', externalUrl: '' },
  });
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [requestMessage, setRequestMessage] = useState<{
    tone: 'error' | 'success' | 'info';
    text: string;
  } | null>(null);
  const answers = answerForm.watch('answers');
  const answeredCount = questions.filter(({ key }) => {
    const value = answers[key];
    return value !== undefined && value !== null && value !== '';
  }).length;

  async function refreshAffectedQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.technicalRiskAssessment(
          api.organizationId!,
          assessment.id,
        ),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.technicalRiskAssessments(api.organizationId!),
      }),
    ]);
  }

  const start = useMutation({
    mutationFn: () =>
      api.request(`/technical-risk/assessments/${assessment.id}/start`, { method: 'POST' }),
    onSuccess: async () => {
      setRequestMessage({
        tone: 'success',
        text: 'Evaluación iniciada. El estado vigente es En curso.',
      });
      await refreshAffectedQueries();
    },
    onError: async (error) => {
      const normalized = technicalMutationError(error);
      setRequestMessage({ tone: 'error', text: normalized.message });
      if (normalized.kind === 'stale') await refetch();
    },
  });

  function validateAnswers(requireAll: boolean): boolean {
    const errors: Record<string, string> = {};
    for (const question of questions) {
      const value = answers[question.key];
      const empty = value === undefined || value === null || value === '';
      if (empty) {
        if (requireAll && question.required)
          errors[question.key] = technicalQuestionRequiredCopy(question);
        continue;
      }
      if (!isTechnicalAnswerValid(question, value)) {
        errors[question.key] = technicalQuestionInvalidCopy(question);
      }
    }
    setAnswerErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[name="answers.${firstKey}"]`)?.focus();
      });
    }
    return Object.keys(errors).length === 0;
  }

  const save = useMutation({
    mutationFn: async ({ complete }: { complete: boolean }) => {
      const entries = questions
        .map((question) => [question.key, answers[question.key]] as const)
        .filter(([, value]) => value !== undefined && value !== null && value !== '');
      for (const [questionKey, value] of entries) {
        await api.request(`/technical-risk/assessments/${assessment.id}/responses/${questionKey}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value }),
        });
      }
      if (complete) {
        await api.request(`/technical-risk/assessments/${assessment.id}/complete`, {
          method: 'POST',
        });
      }
      return complete;
    },
    onSuccess: async (completed) => {
      setRequestMessage({
        tone: 'success',
        text: completed
          ? 'Evaluación completada. El resultado determinístico fue calculado automáticamente.'
          : 'Respuestas guardadas. La evaluación permanece En curso.',
      });
      await refreshAffectedQueries();
    },
    onError: async (error) => {
      const normalized = technicalMutationError(error);
      setRequestMessage({ tone: 'error', text: normalized.message });
      if (normalized.kind === 'stale') await refetch();
    },
  });

  const evidence = useMutation({
    mutationFn: (values: { type: 'NOTE' | 'EXTERNAL_LINK'; note: string; externalUrl: string }) =>
      api.request(`/technical-risk/assessments/${assessment.id}/evidence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: values.type,
          note: values.type === 'NOTE' ? values.note : undefined,
          externalUrl: values.type === 'EXTERNAL_LINK' ? values.externalUrl : undefined,
        }),
      }),
    onSuccess: async () => {
      evidenceForm.reset();
      setRequestMessage({
        tone: 'success',
        text: 'Evidencia guardada. La evaluación permanece En curso.',
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.technicalRiskAssessment(
          api.organizationId!,
          assessment.id,
        ),
      });
    },
    onError: (error) =>
      setRequestMessage({ tone: 'error', text: technicalMutationError(error).message }),
  });

  const provenance = methodSnapshotProvenance(assessment);
  const canWrite = canWriteTechnicalRisk(api.role);
  return (
    <div className="technical-assessment-execution stack-lg">
      <TechnicalRiskPageHeader
        eyebrow="Riesgo técnico · ejecución"
        title={assessment.title}
        description={
          assessment.status === 'DRAFT'
            ? 'El borrador aún no está en ejecución.'
            : 'La evaluación está en curso. Guardar respuestas no completa la evaluación.'
        }
        context={
          <p className="technical-risk-context">
            {api.organizationName} · {assessment.workCenter.name}
            {assessment.workArea ? ` · ${assessment.workArea.name}` : ' · sin área específica'}
          </p>
        }
        actions={<TechnicalAssessmentStatus status={assessment.status} />}
      />
      <MethodVersionSummary
        name={provenance.name}
        code={assessment.methodKey}
        version={provenance.version}
        isDemo={provenance.isDemo}
        disclaimer={provenance.disclaimer}
      />
      <RiskValuationSummary assessment={assessment} />
      <RegulatoryReferenceSummary assessment={assessment} />
      {assessment.revisedFrom?.reviews[0]?.decision === 'NEEDS_REVISION' ? (
        <section
          className="technical-start-panel focus-task"
          aria-labelledby="requested-changes-title"
        >
          <div>
            <p className="technical-risk-kicker">Corrección de una evaluación anterior</p>
            <h2 id="requested-changes-title">Cambios solicitados</h2>
            <p>
              {assessment.revisedFrom.reviews[0].comment ??
                'Revisa los ajustes solicitados antes de completar esta corrección.'}
            </p>
            <p className="muted">
              Las respuestas anteriores se copiaron como punto de partida editable. La evidencia
              histórica no se duplicó.
            </p>
          </div>
          <Link
            className="button secondary"
            href={`/app/technical-risk/${assessment.revisedFrom.id}`}
          >
            Ver evaluación anterior
          </Link>
        </section>
      ) : null}
      {assessment.status === 'DRAFT' ? (
        <section
          className="technical-start-panel focus-task"
          aria-labelledby="technical-start-title"
        >
          <div>
            <p className="technical-risk-kicker">Estado actual · Borrador</p>
            <h2 id="technical-start-title">Inicia la ejecución cuando el contexto esté listo</h2>
            <p>
              Iniciar cambia el estado a En curso. No calcula el resultado ni registra una revisión
              profesional.
            </p>
          </div>
          {canWrite ? (
            <button
              className="button"
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate()}
            >
              {start.isPending ? 'Iniciando…' : 'Iniciar evaluación'}
            </button>
          ) : (
            <TechnicalRiskPermissionState
              role={api.role}
              capability="crear o completar evaluaciones"
            />
          )}
        </section>
      ) : canWrite ? (
        <>
          <TechnicalProgress
            current={answeredCount}
            total={questions.length}
            label={`${answeredCount} de ${questions.length} preguntas respondidas`}
          />
          <form
            className="technical-questionnaire"
            onSubmit={(event) => event.preventDefault()}
            noValidate
          >
            {assessment.methodSnapshot.schema.sections.map((section, sectionIndex) => (
              <section
                className="technical-question-section focus-task"
                aria-labelledby={`technical-section-${section.key}`}
                key={section.key}
              >
                <header>
                  <p className="technical-risk-kicker">
                    Sección {sectionIndex + 1} de {assessment.methodSnapshot.schema.sections.length}
                  </p>
                  <h2 id={`technical-section-${section.key}`}>{section.title}</h2>
                </header>
                {section.questions.map((question) => (
                  <TechnicalQuestionField
                    question={question}
                    control={answerForm.control}
                    error={answerErrors[question.key]}
                    key={question.key}
                  />
                ))}
              </section>
            ))}
          </form>
          <section
            className="technical-evidence-panel focus-dim"
            aria-labelledby="technical-evidence-title"
          >
            <div className="technical-section-heading">
              <div>
                <p className="technical-risk-kicker">Opcional</p>
                <h2 id="technical-evidence-title">Evidencia estructurada</h2>
              </div>
              <span>{assessment.evidence?.length ?? 0} elementos</span>
            </div>
            {assessment.evidence?.map((item) => (
              <p className="technical-evidence-item" key={item.id}>
                <span>
                  {item.type === 'NOTE' ? (
                    item.note
                  ) : (
                    <a href={item.externalUrl} target="_blank" rel="noreferrer">
                      Abrir enlace externo
                    </a>
                  )}
                </span>
                <small>{item.createdBy.displayName}</small>
              </p>
            ))}
            <form
              className="technical-evidence-form"
              onSubmit={evidenceForm.handleSubmit((values) => evidence.mutate(values))}
            >
              <div className="technical-field">
                <label htmlFor="technical-evidence-type">Tipo de evidencia</label>
                <select id="technical-evidence-type" {...evidenceForm.register('type')}>
                  <option value="NOTE">Nota</option>
                  <option value="EXTERNAL_LINK">Enlace externo HTTPS</option>
                </select>
              </div>
              {evidenceForm.watch('type') === 'NOTE' ? (
                <div className="technical-field">
                  <label htmlFor="technical-evidence-note">Nota</label>
                  <textarea
                    id="technical-evidence-note"
                    rows={3}
                    {...evidenceForm.register('note', { required: true, minLength: 1 })}
                  />
                </div>
              ) : (
                <div className="technical-field">
                  <label htmlFor="technical-evidence-url">Enlace externo HTTPS</label>
                  <input
                    id="technical-evidence-url"
                    type="url"
                    {...evidenceForm.register('externalUrl', { required: true })}
                  />
                </div>
              )}
              <button className="button secondary" type="submit" disabled={evidence.isPending}>
                {evidence.isPending ? 'Guardando…' : 'Guardar evidencia'}
              </button>
            </form>
          </section>
          <section
            className="technical-completion-panel"
            aria-labelledby="technical-completion-title"
          >
            <div>
              <p className="technical-risk-kicker">Cálculo determinístico</p>
              <h2 id="technical-completion-title">Revisa antes de completar</h2>
              <p>
                El resultado se calcula con el método y la versión fijados. Esta interfaz no estima
                la puntuación, el nivel ni la recomendación.
              </p>
            </div>
            <AnswerSummary questions={questions} answers={answers} />
          </section>
          {requestMessage ? (
            <TechnicalInlineMessage tone={requestMessage.tone}>
              {requestMessage.text}
            </TechnicalInlineMessage>
          ) : null}
          <div className="technical-sticky-actions">
            <div>
              <strong>Guardar ≠ completar</strong>
              <span>El resultado solo existe después de completar.</span>
            </div>
            <div>
              <button
                className="button secondary"
                type="button"
                disabled={save.isPending}
                onClick={() => {
                  if (validateAnswers(false)) save.mutate({ complete: false });
                }}
              >
                {save.isPending ? 'Guardando…' : 'Guardar respuestas'}
              </button>
              <button
                className="button"
                type="button"
                disabled={save.isPending}
                onClick={() => {
                  if (validateAnswers(true)) save.mutate({ complete: true });
                }}
              >
                {save.isPending ? 'Procesando…' : 'Completar evaluación'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <TechnicalRiskPermissionState role={api.role} capability="crear o completar evaluaciones" />
      )}
      {requestMessage && assessment.status === 'DRAFT' ? (
        <TechnicalInlineMessage tone={requestMessage.tone}>
          {requestMessage.text}
        </TechnicalInlineMessage>
      ) : null}
    </div>
  );
}

function technicalQuestionRequiredCopy(question: TechnicalQuestion): string {
  if (question.type === 'LIKELIHOOD' || question.type === 'CONSEQUENCE') {
    return `Selecciona un valor de ${question.min} a ${question.max} para ${question.label.toLocaleLowerCase('es')}.`;
  }
  return `Completa ${question.label.toLocaleLowerCase('es')}.`;
}

function technicalQuestionInvalidCopy(question: TechnicalQuestion): string {
  if (question.type === 'INTEGER') return 'Ingresa un número entero dentro del rango permitido.';
  if (question.type === 'DECIMAL') return 'Ingresa un número dentro del rango permitido.';
  if (question.type === 'TEXT')
    return `El texto debe tener como máximo ${question.maxLength} caracteres.`;
  return `Selecciona una respuesta válida para ${question.label.toLocaleLowerCase('es')}.`;
}

function TechnicalAssessmentResult({
  api,
  assessment,
}: {
  api: ReturnType<typeof useTechnicalRiskApi>;
  assessment: Assessment;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [revisionError, setRevisionError] = useState('');
  const provenance = methodSnapshotProvenance(assessment);
  const questions = allQuestions(assessment.methodSnapshot.schema);
  const answers = Object.fromEntries(
    assessment.responses?.map(({ questionKey, value }) => [questionKey, value]) ?? [],
  );
  const reviewState = technicalReviewState(assessment.status, assessment.reviews);
  const canReview = canReviewTechnicalRisk(api.role);
  const latestReview = assessment.reviews?.at(-1);
  const needsRevision = latestReview?.decision === 'NEEDS_REVISION';
  const createRevision = useMutation({
    mutationFn: () =>
      api.request<Assessment>(`/technical-risk/assessments/${assessment.id}/revisions`, {
        method: 'POST',
      }),
    onSuccess: async (revision) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.technicalRiskAssessment(
            api.organizationId!,
            assessment.id,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.technicalRiskAssessments(api.organizationId!),
        }),
      ]);
      router.push(`/app/technical-risk/${revision.id}`);
    },
    onError: (error) => setRevisionError(technicalMutationError(error).message),
  });
  return (
    <div className="technical-assessment-result stack-lg">
      <TechnicalRiskPageHeader
        eyebrow="Riesgo técnico · resultado"
        title={assessment.title}
        description="Resultado determinístico e histórico de la versión fijada del método. Completar no equivale a revisión profesional."
        context={
          <p className="technical-risk-context">
            {api.organizationName} · {assessment.workCenter.name}
            {assessment.workArea ? ` · ${assessment.workArea.name}` : ' · sin área específica'}
          </p>
        }
        actions={
          needsRevision ? (
            assessment.revision ? (
              <Link className="button" href={`/app/technical-risk/${assessment.revision.id}`}>
                Abrir corrección
              </Link>
            ) : canWriteTechnicalRisk(api.role) ? (
              <button
                className="button"
                type="button"
                disabled={createRevision.isPending}
                onClick={() => createRevision.mutate()}
              >
                {createRevision.isPending ? 'Creando corrección…' : 'Atender ajustes'}
              </button>
            ) : null
          ) : (
            <Link
              className={
                canReview && assessment.status === 'COMPLETED' ? 'button' : 'button secondary'
              }
              href={`/app/technical-risk/${assessment.id}/review`}
            >
              {assessment.status === 'REVIEWED'
                ? 'Ver revisión registrada'
                : canReview
                  ? 'Abrir revisión profesional'
                  : 'Ver contexto de revisión'}
            </Link>
          )
        }
      />
      {revisionError ? <TechnicalInlineMessage>{revisionError}</TechnicalInlineMessage> : null}
      {needsRevision ? (
        <section
          className="technical-start-panel focus-task"
          aria-labelledby="technical-adjustments-title"
        >
          <div>
            <p className="technical-risk-kicker">Revisión profesional</p>
            <h2 id="technical-adjustments-title">Requiere ajustes</h2>
            <p>{latestReview?.comment ?? 'La revisión solicitó cambios.'}</p>
            <p className="muted">
              El resultado original permanece intacto. Los cambios se atienden en una nueva
              evaluación vinculada.
            </p>
          </div>
        </section>
      ) : null}
      {assessment.isDemo ? <TechnicalRiskDemoNotice disclaimer={provenance.disclaimer} /> : null}
      <section className="technical-result-hero" aria-labelledby="technical-result-title">
        <div>
          <p className="technical-risk-kicker">
            Resultado calculado automáticamente según el método seleccionado
          </p>
          <h2 id="technical-result-title">Resultado técnico</h2>
          <p>
            La puntuación y el nivel quedan registrados sin ser reinterpretados por esta interfaz.
          </p>
        </div>
        <TechnicalRiskBadge level={assessment.result?.level} score={assessment.result?.score} />
        <dl>
          <div>
            <dt>Puntuación</dt>
            <dd>{assessment.result?.score ?? 'Sin resultado'}</dd>
          </div>
          <div>
            <dt>Nivel</dt>
            <dd>{technicalRiskLabel(assessment.result?.level)}</dd>
          </div>
          <div>
            <dt>Calculado</dt>
            <dd>{formatDateTime(assessment.result?.calculatedAt)}</dd>
          </div>
        </dl>
      </section>
      <div className="technical-result-layout">
        <div className="technical-result-main">
          <section className="technical-result-section" aria-labelledby="technical-answers-title">
            <div className="technical-section-heading">
              <div>
                <p className="technical-risk-kicker">Entradas registradas</p>
                <h2 id="technical-answers-title">Respuestas enviadas</h2>
              </div>
              <span>{questions.length} preguntas</span>
            </div>
            <AnswerSummary questions={questions} answers={answers} />
          </section>
          <section
            className="technical-result-section"
            aria-labelledby="technical-result-evidence-title"
          >
            <div className="technical-section-heading">
              <div>
                <p className="technical-risk-kicker">Soporte</p>
                <h2 id="technical-result-evidence-title">Evidencia estructurada</h2>
              </div>
              <span>{assessment.evidence?.length ?? 0} elementos</span>
            </div>
            {assessment.evidence?.length ? (
              assessment.evidence.map((item) => (
                <div className="technical-evidence-item" key={item.id}>
                  <span>
                    {item.type === 'NOTE' ? (
                      item.note
                    ) : (
                      <a href={item.externalUrl} target="_blank" rel="noreferrer">
                        Abrir enlace externo
                      </a>
                    )}
                  </span>
                  <small>
                    {item.createdBy.displayName}
                    {item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ''}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">Sin evidencia registrada.</p>
            )}
          </section>
        </div>
        <WorkspaceInspector className="technical-result-rail" label="Proveniencia y revisión">
          <MethodVersionSummary
            name={provenance.name}
            code={assessment.methodKey}
            version={provenance.version}
            isDemo={provenance.isDemo}
            disclaimer={provenance.disclaimer}
          />
          <RiskValuationSummary assessment={assessment} />
          <RegulatoryReferenceSummary assessment={assessment} />
          <section className="technical-review-summary">
            <p className="technical-risk-kicker">Fase separada</p>
            <h2>Revisión profesional</h2>
            <span className={`technical-status technical-status-${reviewState.tone}`}>
              {reviewState.label}
            </span>
            <p>{reviewState.description}</p>
            <p className="technical-invariant-note">{TECHNICAL_RISK_REVIEW_COPY}</p>
            {!canReview && assessment.status === 'COMPLETED' ? (
              <TechnicalRiskPermissionState
                role={api.role}
                capability="registrar una revisión profesional"
              />
            ) : null}
          </section>
          <section className="technical-audit-summary">
            <p className="technical-risk-kicker">Trazabilidad disponible</p>
            <h2>Registro</h2>
            <dl className="technical-description-list">
              <div>
                <dt>Creada por</dt>
                <dd>{assessment.createdBy.displayName}</dd>
              </div>
              <div>
                <dt>Creada</dt>
                <dd>{formatDateTime(assessment.createdAt)}</dd>
              </div>
              <div>
                <dt>Completada</dt>
                <dd>{formatDateTime(assessment.completedAt)}</dd>
              </div>
              {assessment.reviewedBy ? (
                <div>
                  <dt>Revisada por</dt>
                  <dd>{assessment.reviewedBy.displayName}</dd>
                </div>
              ) : null}
            </dl>
            <ReviewHistory reviews={assessment.reviews} />
          </section>
        </WorkspaceInspector>
      </div>
    </div>
  );
}

type ReviewForm = {
  decision: '' | 'APPROVED' | 'NEEDS_REVISION';
  comment: string;
  selfReviewAcknowledged: boolean;
};

export function TechnicalAssessmentReview({ assessmentId }: { assessmentId: string }) {
  const api = useTechnicalRiskApi();
  const organizationId = api.organizationId;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState<{
    tone: 'error' | 'success' | 'info';
    text: string;
  } | null>(null);
  const form = useForm<ReviewForm>({
    defaultValues: { decision: '', comment: '', selfReviewAcknowledged: false },
  });
  const query = useQuery({
    queryKey: queryKeys.organization.technicalRiskAssessment(
      organizationId ?? 'inactive',
      assessmentId,
    ),
    queryFn: ({ signal }) =>
      api.request<Assessment>(`/technical-risk/assessments/${assessmentId}`, { signal }),
    enabled: Boolean(organizationId && api.moduleEnabled),
    retry: shouldRetryGet,
  });
  const mutation = useMutation({
    mutationFn: (values: ReviewForm) =>
      api.request<TechnicalReview>(`/technical-risk/assessments/${assessmentId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: values.decision,
          comment: values.comment || undefined,
          selfReviewAcknowledged: values.selfReviewAcknowledged,
        }),
      }),
    onSuccess: async (review) => {
      setDialogOpen(false);
      setRequestMessage({
        tone: 'success',
        text:
          review.decision === 'APPROVED'
            ? 'Revisión aprobada. La evaluación ahora está Revisada y el resultado técnico no cambió.'
            : 'Revisión registrada: requiere ajustes. La evaluación permanece Completada.',
      });
      form.reset({ decision: '', comment: '', selfReviewAcknowledged: false });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.technicalRiskAssessment(organizationId!, assessmentId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.technicalRiskAssessments(organizationId!),
        }),
      ]);
    },
    onError: async (error) => {
      setDialogOpen(false);
      const normalized = technicalMutationError(error);
      setRequestMessage({ tone: 'error', text: normalized.message });
      if (normalized.kind === 'stale') await query.refetch();
    },
  });
  const assessment = query.data;
  const decision = form.watch('decision');
  const canReview = canReviewTechnicalRisk(api.role);
  const latestReview = assessment?.reviews?.at(-1);
  const selfReview = assessment?.createdBy.id === api.userId;
  const elevatedSelfApproval =
    selfReview &&
    decision === 'APPROVED' &&
    (assessment?.result?.level === 'HIGH' || assessment?.result?.level === 'CRITICAL');

  async function openConfirmation() {
    setRequestMessage(null);
    const valid = await form.trigger(['decision', 'comment', 'selfReviewAcknowledged'], {
      shouldFocus: true,
    });
    if (valid) setDialogOpen(true);
  }

  return (
    <TechnicalRiskAccessGate api={api}>
      {query.isLoading ? (
        <TechnicalRiskSkeleton label="Cargando revisión profesional" />
      ) : query.isError || !assessment ? (
        <PageQueryError object="la revisión profesional" retry={() => void query.refetch()} />
      ) : !['COMPLETED', 'REVIEWED'].includes(assessment.status) ? (
        <TechnicalRiskState
          kind="info"
          title="La evaluación todavía no está completada"
          description="La revisión profesional ocurre después de que el resultado queda calculado."
          action={
            <Link className="button secondary" href={`/app/technical-risk/${assessment.id}`}>
              Volver a la evaluación
            </Link>
          }
        />
      ) : (
        <div className="technical-professional-review stack-lg">
          <TechnicalRiskPageHeader
            eyebrow="Riesgo técnico · revisión profesional"
            title="Revisión profesional"
            description="Revisa método, versión, contexto, respuestas, evidencia, autor y resultado antes de registrar una decisión explícita."
            context={
              <p className="technical-risk-context">
                {api.organizationName} · {assessment.workCenter.name}
                {assessment.workArea ? ` · ${assessment.workArea.name}` : ' · sin área específica'}
              </p>
            }
            actions={
              <Link className="button secondary" href={`/app/technical-risk/${assessment.id}`}>
                Volver al resultado
              </Link>
            }
          />
          {assessment.isDemo ? (
            <TechnicalRiskDemoNotice disclaimer={assessment.methodSnapshot.disclaimer} />
          ) : null}
          <div className="technical-review-layout">
            <div className="technical-review-evidence">
              <section
                className="technical-review-context"
                aria-labelledby="technical-review-context-title"
              >
                <div className="technical-section-heading">
                  <div>
                    <p className="technical-risk-kicker">Registro inmutable</p>
                    <h2 id="technical-review-context-title">Contexto de la evaluación</h2>
                  </div>
                  <TechnicalAssessmentStatus status={assessment.status} />
                </div>
                <dl className="technical-description-list two-columns">
                  <div>
                    <dt>Evaluación</dt>
                    <dd>{assessment.title}</dd>
                  </div>
                  <div>
                    <dt>Autor</dt>
                    <dd>{assessment.createdBy.displayName}</dd>
                  </div>
                  <div>
                    <dt>Método</dt>
                    <dd>{assessment.methodSnapshot.methodName}</dd>
                  </div>
                  <div>
                    <dt>Versión fijada</dt>
                    <dd className="mono">{assessment.methodVersion}</dd>
                  </div>
                  <div>
                    <dt>Resultado</dt>
                    <dd>
                      {assessment.result?.score ?? 'Sin resultado'} ·{' '}
                      {technicalRiskLabel(assessment.result?.level)}
                    </dd>
                  </div>
                  <div>
                    <dt>Calculado</dt>
                    <dd>{formatDateTime(assessment.result?.calculatedAt)}</dd>
                  </div>
                </dl>
              </section>
              <section
                className="technical-review-context"
                aria-labelledby="technical-review-answers-title"
              >
                <div className="technical-section-heading">
                  <div>
                    <p className="technical-risk-kicker">Entradas del método</p>
                    <h2 id="technical-review-answers-title">Respuestas</h2>
                  </div>
                  <TechnicalRiskBadge
                    level={assessment.result?.level}
                    score={assessment.result?.score}
                  />
                </div>
                <AnswerSummary
                  questions={allQuestions(assessment.methodSnapshot.schema)}
                  answers={Object.fromEntries(
                    assessment.responses?.map(({ questionKey, value }) => [questionKey, value]) ??
                      [],
                  )}
                />
              </section>
              <section
                className="technical-review-context"
                aria-labelledby="technical-review-evidence-title"
              >
                <div className="technical-section-heading">
                  <div>
                    <p className="technical-risk-kicker">Soporte disponible</p>
                    <h2 id="technical-review-evidence-title">Evidencia</h2>
                  </div>
                  <span>{assessment.evidence?.length ?? 0} elementos</span>
                </div>
                {assessment.evidence?.length ? (
                  assessment.evidence.map((item) => (
                    <div className="technical-evidence-item" key={item.id}>
                      <span>
                        {item.type === 'NOTE' ? (
                          item.note
                        ) : (
                          <a href={item.externalUrl} target="_blank" rel="noreferrer">
                            Abrir enlace externo
                          </a>
                        )}
                      </span>
                      <small>{item.createdBy.displayName}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">Sin evidencia registrada.</p>
                )}
              </section>
              <section
                className="technical-review-context"
                aria-labelledby="technical-review-history-title"
              >
                <div className="technical-section-heading">
                  <div>
                    <p className="technical-risk-kicker">Decisiones anteriores</p>
                    <h2 id="technical-review-history-title">Historial de revisión</h2>
                  </div>
                </div>
                <ReviewHistory reviews={assessment.reviews} />
              </section>
            </div>
            <aside
              className="technical-review-decision focus-task"
              aria-label="Decisión profesional"
            >
              <p className="technical-risk-kicker">Decisión autorizada</p>
              <h2>
                {assessment.status === 'REVIEWED' ? 'Revisión registrada' : 'Registrar decisión'}
              </h2>
              <p>{TECHNICAL_RISK_REVIEW_COPY}</p>
              <p className="technical-review-role-limit">
                Aprobar o solicitar cambios: solo {REVIEW_ROLE_COPY}.
              </p>
              {requestMessage ? (
                <TechnicalInlineMessage tone={requestMessage.tone}>
                  {requestMessage.text}
                </TechnicalInlineMessage>
              ) : null}
              {assessment.status === 'REVIEWED' || latestReview?.decision === 'NEEDS_REVISION' ? (
                <ReviewHistory reviews={assessment.reviews?.slice(-1)} />
              ) : !canReview ? (
                <TechnicalRiskPermissionState
                  role={api.role}
                  capability="registrar una revisión profesional"
                />
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void openConfirmation();
                  }}
                  noValidate
                >
                  <fieldset
                    className="technical-review-options"
                    aria-describedby={
                      form.formState.errors.decision ? 'technical-review-decision-error' : undefined
                    }
                  >
                    <legend>Decisión</legend>
                    <label>
                      <input
                        type="radio"
                        value="APPROVED"
                        {...form.register('decision', {
                          required: 'Selecciona una decisión profesional.',
                        })}
                      />
                      <span>
                        <strong>Aprobar revisión</strong>
                        <small>
                          Confirma profesionalmente el resultado medido. No cambia el nivel de
                          riesgo.
                        </small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="NEEDS_REVISION"
                        {...form.register('decision', {
                          required: 'Selecciona una decisión profesional.',
                        })}
                      />
                      <span>
                        <strong>Solicitar cambios</strong>
                        <small>
                          Registra que requiere ajustes. El estado permanece Completada.
                        </small>
                      </span>
                    </label>
                  </fieldset>
                  {form.formState.errors.decision ? (
                    <p className="field-error" id="technical-review-decision-error">
                      {form.formState.errors.decision.message}
                    </p>
                  ) : null}
                  <div className="technical-field">
                    <label htmlFor="review-comment">
                      Comentario {decision === 'NEEDS_REVISION' ? '' : '· opcional'}
                    </label>
                    <textarea
                      id="review-comment"
                      rows={5}
                      maxLength={2000}
                      aria-invalid={Boolean(form.formState.errors.comment)}
                      aria-describedby={
                        form.formState.errors.comment
                          ? 'technical-review-comment-error'
                          : 'technical-review-comment-help'
                      }
                      {...form.register('comment', {
                        validate: (value) => {
                          if (decision === 'NEEDS_REVISION' && value.trim().length === 0)
                            return 'Explica qué ajustes se requieren.';
                          if (elevatedSelfApproval && value.trim().length < 10)
                            return 'Explica la autorrevisión en al menos 10 caracteres.';
                          return true;
                        },
                      })}
                    />
                    <p className="technical-field-help" id="technical-review-comment-help">
                      El comentario se conserva si la solicitud falla.
                    </p>
                    {form.formState.errors.comment ? (
                      <p className="field-error" id="technical-review-comment-error">
                        {form.formState.errors.comment.message}
                      </p>
                    ) : null}
                  </div>
                  {selfReview ? (
                    <div className="technical-inline-message technical-inline-info" role="note">
                      <strong>Estás revisando una evaluación que tú mismo registraste.</strong>
                      {elevatedSelfApproval ? (
                        <label>
                          <input
                            type="checkbox"
                            {...form.register('selfReviewAcknowledged', {
                              validate: (value) =>
                                !elevatedSelfApproval || value || 'Confirma la autorrevisión.',
                            })}
                          />
                          Confirmo esta autorrevisión y su trazabilidad.
                        </label>
                      ) : null}
                      {form.formState.errors.selfReviewAcknowledged ? (
                        <p className="field-error">
                          {form.formState.errors.selfReviewAcknowledged.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <button className="button" type="submit" disabled={mutation.isPending}>
                    Registrar decisión
                  </button>
                  <p className="technical-api-authority">
                    La visibilidad del panel no otorga permisos; cada operación valida rol,
                    organización y estado.
                  </p>
                </form>
              )}
            </aside>
          </div>
          <TechnicalReviewDialog
            open={dialogOpen}
            title={
              decision === 'APPROVED'
                ? 'Confirmar aprobación profesional'
                : 'Confirmar solicitud de cambios'
            }
            description={
              decision === 'APPROVED'
                ? 'La evaluación pasará a Revisada. La puntuación y el nivel técnico no cambiarán.'
                : 'La decisión se registrará como Requiere ajustes. La evaluación permanecerá Completada.'
            }
            pending={mutation.isPending}
            onClose={() => setDialogOpen(false)}
            onConfirm={() => mutation.mutate(form.getValues())}
          />
        </div>
      )}
    </TechnicalRiskAccessGate>
  );
}
