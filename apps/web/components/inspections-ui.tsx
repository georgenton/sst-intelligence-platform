'use client';

import { Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';

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
type FindingCategory =
  | 'ELECTRICAL'
  | 'FIRE'
  | 'MECHANICAL'
  | 'CHEMICAL'
  | 'ERGONOMIC'
  | 'PHYSICAL'
  | 'BIOLOGICAL'
  | 'PSYCHOSOCIAL'
  | 'HOUSEKEEPING'
  | 'OTHER';
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
const FINDING_CATEGORIES = Object.keys(FINDING_CATEGORY_LABELS) as FindingCategory[];
type Inspection = {
  id: string;
  title: string;
  description?: string;
  status: string;
  scheduledFor?: string;
  isDemo: boolean;
  workCenter: { id: string; name: string };
  workArea?: { id: string; name: string };
  findings?: Finding[];
  overdueActions?: number;
};
type Action = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueAt?: string;
  overdue: boolean;
  assignedTo?: { id: string; displayName: string };
  evidence: Array<{ id: string; type: string; note?: string; externalUrl?: string }>;
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
  residualScore?: number;
  residualRiskLevel?: string;
  recurrenceCount: number;
  recurrenceStatus: string;
  workCenter?: { id: string; name: string };
  workArea?: { id: string; name: string };
  inspection?: { id: string; title: string; status: string; isDemo: boolean };
  actions: Action[];
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

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELED: 'Cancelada',
  OPEN: 'Abierto',
  ACTION_IN_PROGRESS: 'Acción en progreso',
  PENDING_VERIFICATION: 'Pendiente de verificación',
  CLOSED: 'Cerrado',
  LOW: 'Bajo',
  MODERATE: 'Moderado',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
  NONE: 'Sin recurrencia',
  REPEATED: 'Hallazgo recurrente',
  SYSTEMIC_REVIEW_RECOMMENDED: 'Revisión sistémica recomendada',
  ACKNOWLEDGED: 'Reconocida',
};
const label = (value: string) => statusLabels[value] ?? value.replaceAll('_', ' ');

function useApi() {
  const auth = useAuth();
  const organization = useOrganization();
  return {
    organizationId: organization.activeId,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="inspection-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {actions && <div className="form-actions compact">{actions}</div>}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  return <span className={`risk-badge risk-${level.toLowerCase()}`}>Riesgo {label(level)}</span>;
}

function DemoNotice() {
  return (
    <div className="method-notice" role="note">
      <strong>Matriz demostrativa 5×5</strong>
      <span>Metodología demostrativa 5×5. No constituye una metodología regulatoria validada.</span>
    </div>
  );
}

export function InspectionsDashboard() {
  const api = useApi();
  const organizationId = api.organizationId;
  const analytics = useQuery({
    queryKey: queryKeys.organization.inspectionAnalytics(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<Analytics>('/inspections/analytics/summary', { signal }),
    enabled: Boolean(organizationId),
  });
  const inspections = useQuery({
    queryKey: queryKeys.organization.inspections(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<{ items: Inspection[]; total: number }>('/inspections?pageSize=20', { signal }),
    enabled: Boolean(organizationId),
  });
  if (!api.organizationId) return <Card>Selecciona una organización.</Card>;
  if (analytics.isLoading || inspections.isLoading) return <p>Cargando inspecciones…</p>;
  if (analytics.isError || inspections.isError)
    return (
      <p className="field-error" role="alert">
        No pudimos cargar el módulo. Verifica que la organización tenga acceso.
      </p>
    );
  const summary = analytics.data!;
  return (
    <div className="stack">
      <PageIntro
        eyebrow="Inspecciones inteligentes"
        title="Operación en campo"
        description="Registra hallazgos, acciones, verificaciones y recurrencias con decisiones determinísticas."
        actions={
          <>
            <Link className="button secondary" href="/app/inspections/alerts">
              Alertas
            </Link>
            <Link className="button secondary" href="/app/inspections/analytics">
              Analítica
            </Link>
            <Link className="button" href="/app/inspections/new">
              Nueva inspección
            </Link>
          </>
        }
      />
      <DemoNotice />
      <div className="metric-grid">
        <Card>
          <span>Inspecciones</span>
          <strong>{summary.totalInspections}</strong>
        </Card>
        <Card>
          <span>Hallazgos abiertos</span>
          <strong>{summary.openFindings}</strong>
        </Card>
        <Card>
          <span>Altos o críticos</span>
          <strong>{summary.highCriticalFindings}</strong>
        </Card>
        <Card>
          <span>Acciones vencidas</span>
          <strong>{summary.overdueActions}</strong>
        </Card>
        <Card>
          <span>Recurrencias</span>
          <strong>{summary.recurrenceAlerts}</strong>
        </Card>
      </div>
      <section className="stack">
        <h3>Inspecciones recientes</h3>
        {inspections.data!.items.length === 0 ? (
          <Card>
            <p>No existen inspecciones todavía.</p>
            <Link href="/app/inspections/new">Crear la primera →</Link>
          </Card>
        ) : (
          <div className="adaptive-list">
            {inspections.data!.items.map((inspection) => (
              <Link
                href={`/app/inspections/${inspection.id}`}
                key={inspection.id}
                className="inspection-card"
              >
                <div>
                  <StatusBadge>{label(inspection.status)}</StatusBadge>
                  {inspection.isDemo && <span className="demo-chip">Datos de demostración</span>}
                  <h3>{inspection.title}</h3>
                  <p>
                    {inspection.workCenter.name}
                    {inspection.workArea ? ` · ${inspection.workArea.name}` : ''}
                  </p>
                </div>
                <span>Ver detalle →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
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
  const api = useApi();
  const router = useRouter();
  const organizationId = api.organizationId;
  const context = useQuery({
    queryKey: queryKeys.organization.inspectionContext(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<ContextData>('/inspections/context', { signal }),
    enabled: Boolean(organizationId),
  });
  const form = useForm<InspectionForm>({
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
    onSuccess: (created) => router.push(`/app/inspections/${created.id}`),
  });
  return (
    <div className="stack narrow">
      <PageIntro
        eyebrow="Nueva inspección"
        title="Planifica el recorrido"
        description="La inspección comienza como borrador y podrá iniciarse cuando estés en campo."
      />
      <Card>
        <form
          className="stack"
          onSubmit={form.handleSubmit((values) => {
            if (!mutation.isPending) mutation.mutate(values);
          })}
        >
          <div className="field">
            <label htmlFor="center">Centro de trabajo</label>
            <select id="center" {...form.register('workCenterId', { required: true })}>
              <option value="">Selecciona</option>
              {context.data?.workCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="area">Área (opcional)</label>
            <select id="area" {...form.register('workAreaId')}>
              <option value="">Sin área específica</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inspection-title">Título</label>
            <input
              id="inspection-title"
              {...form.register('title', { required: true, minLength: 3 })}
            />
          </div>
          <div className="field">
            <label htmlFor="inspection-description">Descripción</label>
            <textarea id="inspection-description" rows={4} {...form.register('description')} />
          </div>
          <div className="field">
            <label htmlFor="scheduled">Fecha programada</label>
            <input id="scheduled" type="datetime-local" {...form.register('scheduledFor')} />
          </div>
          {mutation.isError && (
            <p className="field-error" role="alert">
              No pudimos crear la inspección.
            </p>
          )}
          <div className="form-actions">
            <Link className="button secondary" href="/app/inspections">
              Cancelar
            </Link>
            <button className="button" disabled={mutation.isPending}>
              Crear inspección
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function InspectionDetail({ inspectionId }: { inspectionId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const query = useQuery({
    queryKey: queryKeys.organization.inspection(organizationId ?? 'inactive', inspectionId),
    queryFn: ({ signal }) => api.request<Inspection>(`/inspections/${inspectionId}`, { signal }),
    enabled: Boolean(organizationId),
  });
  const transition = useMutation({
    mutationFn: (action: 'start' | 'complete') =>
      api.request(`/inspections/${inspectionId}/${action}`, { method: 'POST' }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspection(organizationId!, inspectionId),
      }),
  });
  if (query.isLoading) return <p>Cargando inspección…</p>;
  if (!query.data) return <p className="field-error">Inspección no encontrada.</p>;
  const inspection = query.data;
  return (
    <div className="stack">
      <PageIntro
        eyebrow="Detalle de inspección"
        title={inspection.title}
        description={`${inspection.workCenter.name}${inspection.workArea ? ` · ${inspection.workArea.name}` : ''}`}
        actions={
          <>
            {inspection.status === 'DRAFT' && (
              <button className="button" onClick={() => transition.mutate('start')}>
                Iniciar inspección
              </button>
            )}
            {inspection.status === 'IN_PROGRESS' && (
              <button
                className="button secondary"
                onClick={() =>
                  confirm('¿Completar esta inspección?') && transition.mutate('complete')
                }
              >
                Completar inspección
              </button>
            )}
            <Link className="button" href={`/app/inspections/${inspection.id}/findings/new`}>
              Registrar hallazgo
            </Link>
          </>
        }
      />
      <div className="detail-strip">
        <StatusBadge>{label(inspection.status)}</StatusBadge>
        {inspection.isDemo && <span className="demo-chip">Datos de demostración</span>}
      </div>
      <section className="stack">
        <h3>Hallazgos</h3>
        {inspection.findings?.length ? (
          <div className="adaptive-list">
            {inspection.findings.map((finding) => (
              <Link
                className="inspection-card"
                href={`/app/inspections/${inspection.id}/findings/${finding.id}`}
                key={finding.id}
              >
                <div>
                  <RiskBadge level={finding.initialRiskLevel} />
                  <h3>{finding.title}</h3>
                  <p>
                    {FINDING_CATEGORY_LABELS[finding.category]} · {label(finding.status)}
                  </p>
                </div>
                <span>Revisar →</span>
              </Link>
            ))}
          </div>
        ) : (
          <Card>No se han registrado hallazgos.</Card>
        )}
      </section>
    </div>
  );
}

const likelihoodDescriptions = [
  'Muy improbable',
  'Improbable',
  'Posible',
  'Probable',
  'Muy probable',
];
const consequenceDescriptions = ['Menor', 'Leve', 'Moderada', 'Grave', 'Muy grave'];
type FindingForm = {
  title: string;
  description: string;
  category: FindingCategory;
  likelihood: number;
  consequence: number;
};
export function NewFinding({ inspectionId }: { inspectionId: string }) {
  const api = useApi();
  const router = useRouter();
  const organizationId = api.organizationId;
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState<CreatedFinding | null>(null);
  const riskValues = useRef({ likelihood: 1, consequence: 1 });
  const inspection = useQuery({
    queryKey: queryKeys.organization.inspection(organizationId ?? 'inactive', inspectionId),
    queryFn: ({ signal }) => api.request<Inspection>(`/inspections/${inspectionId}`, { signal }),
    enabled: Boolean(organizationId),
  });
  const form = useForm<FindingForm>({
    defaultValues: {
      title: '',
      description: '',
      category: 'ELECTRICAL',
      likelihood: 1,
      consequence: 1,
    },
  });
  const mutation = useMutation({
    mutationFn: (values: FindingForm) =>
      api.request<CreatedFinding>(`/inspections/${inspectionId}/findings`, {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          likelihood: Number(values.likelihood),
          consequence: Number(values.consequence),
        }),
      }),
    onSuccess: (result) => {
      setCreated(result);
      setStep(5);
    },
  });
  if (created)
    return (
      <div className="stack narrow">
        <PageIntro
          eyebrow="Hallazgo registrado"
          title={created.title}
          description="El sistema calculó la clasificación con la matriz demostrativa."
        />
        <Card className="stack">
          <RiskBadge level={created.initialRiskLevel} />
          <h3>
            Resultado: {created.initialScore} · {label(created.initialRiskLevel)}
          </h3>
          {created.recurrenceCount > 0 && (
            <div className="recurrence-callout">
              <strong>{label(created.recurrenceStatus)}</strong>
              <p>
                {created.recurrenceCount} antecedentes en los últimos {created.recurrenceWindowDays}{' '}
                días.
              </p>
              {created.recurrenceStatus === 'SYSTEMIC_REVIEW_RECOMMENDED' && (
                <p>Este aviso indica recurrencia, no confirma una causa raíz.</p>
              )}
            </div>
          )}
          <p>¿Quieres crear una acción ahora?</p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => router.push(`/app/inspections/${inspectionId}`)}
            >
              Después
            </button>
            <button
              className="button"
              onClick={() => router.push(`/app/inspections/${inspectionId}/findings/${created.id}`)}
            >
              Sí, crear acción
            </button>
          </div>
        </Card>
      </div>
    );
  return (
    <div className="stack narrow">
      <PageIntro
        eyebrow="Nuevo hallazgo"
        title={`Paso ${step} de 5`}
        description={
          inspection.data
            ? `${inspection.data.workCenter.name}${inspection.data.workArea ? ` · ${inspection.data.workArea.name}` : ''}`
            : 'Registro guiado'
        }
      />
      <div className="progress-track" aria-label={`Paso ${step} de 5`}>
        <div className="progress-bar" style={{ width: `${step * 20}%` }} />
      </div>
      <Card>
        <form
          className="stack"
          onSubmit={form.handleSubmit((values, event) => {
            if (mutation.isPending || !(event?.target instanceof HTMLFormElement)) return;
            const nativeValues = new FormData(event.target);
            mutation.mutate({
              ...values,
              likelihood: Number(nativeValues.get('likelihood')),
              consequence: Number(nativeValues.get('consequence')),
            });
          })}
        >
          {step === 1 && (
            <>
              <h3>¿Dónde encontraste el problema?</h3>
              <p>
                Centro: <strong>{inspection.data?.workCenter.name}</strong>
              </p>
              <p>
                Área: <strong>{inspection.data?.workArea?.name ?? 'Sin área específica'}</strong>
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h3>¿Qué observaste?</h3>
              <div className="field">
                <label htmlFor="finding-title">Título</label>
                <input
                  id="finding-title"
                  {...form.register('title', { required: true, minLength: 3 })}
                />
              </div>
              <div className="field">
                <label htmlFor="finding-description">Descripción</label>
                <textarea
                  id="finding-description"
                  rows={5}
                  {...form.register('description', { required: true, minLength: 3 })}
                />
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h3>¿Qué tipo de hallazgo es?</h3>
              <div className="field">
                <label htmlFor="category">Categoría del hallazgo</label>
                <select id="category" {...form.register('category')}>
                  {FINDING_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {FINDING_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="muted">
                Esta categoría no constituye una clasificación legal del riesgo.
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <h3>Valoración DEMO</h3>
              <DemoNotice />
              <Scale
                name="likelihood"
                title="Probabilidad"
                descriptions={likelihoodDescriptions}
                register={form.register}
                onSelect={(name, value) => {
                  riskValues.current[name] = value;
                }}
              />
              <Scale
                name="consequence"
                title="Consecuencia"
                descriptions={consequenceDescriptions}
                register={form.register}
                onSelect={(name, value) => {
                  riskValues.current[name] = value;
                }}
              />
              <div className="preview-card">
                <strong>Valoración preparada</strong>
                <span>La clasificación será calculada por el sistema.</span>
              </div>
            </>
          )}
          {mutation.isError && (
            <p className="field-error" role="alert">
              No pudimos registrar el hallazgo.
            </p>
          )}
          <div className="form-actions">
            {step > 1 ? (
              <button type="button" className="button secondary" onClick={() => setStep(step - 1)}>
                Atrás
              </button>
            ) : (
              <Link className="button secondary" href={`/app/inspections/${inspectionId}`}>
                Cancelar
              </Link>
            )}
            {step < 4 ? (
              <button type="button" className="button" onClick={() => setStep(step + 1)}>
                Continuar
              </button>
            ) : (
              <button
                type="button"
                className="button"
                onClick={() =>
                  void form.handleSubmit((values) =>
                    mutation.mutate({
                      ...values,
                      likelihood: riskValues.current.likelihood,
                      consequence: riskValues.current.consequence,
                    }),
                  )()
                }
              >
                Registrar hallazgo
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

function Scale<T extends FieldValues & { likelihood: number; consequence: number }>({
  name,
  title,
  descriptions,
  register,
  onSelect,
}: {
  name: 'likelihood' | 'consequence';
  title: string;
  descriptions: string[];
  register: UseFormRegister<T>;
  onSelect(name: 'likelihood' | 'consequence', value: number): void;
}) {
  const field = register(name as Path<T>, { valueAsNumber: true });
  return (
    <div className="field scale-field">
      <label htmlFor={`scale-${name}`}>{title}</label>
      <select
        id={`scale-${name}`}
        {...field}
        onChange={(event) => {
          void field.onChange(event);
          onSelect(name, Number(event.target.value));
        }}
      >
        {descriptions.map((description, index) => (
          <option key={description} value={index + 1}>
            {index + 1} — {description}
          </option>
        ))}
      </select>
    </div>
  );
}

type ActionForm = {
  title: string;
  description: string;
  assignedToUserId: string;
  priority: string;
  dueAt: string;
};
export function FindingDetail({
  inspectionId,
  findingId,
}: {
  inspectionId: string;
  findingId: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const finding = useQuery({
    queryKey: queryKeys.organization.finding(organizationId ?? 'inactive', findingId),
    queryFn: ({ signal }) =>
      api.request<Finding>(`/inspections/${inspectionId}/findings/${findingId}`, { signal }),
    enabled: Boolean(organizationId),
  });
  const context = useQuery({
    queryKey: queryKeys.organization.inspectionContext(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<ContextData>('/inspections/context', { signal }),
    enabled: Boolean(organizationId),
  });
  const actionForm = useForm<ActionForm>({
    defaultValues: {
      title: '',
      description: '',
      assignedToUserId: '',
      priority: 'MEDIUM',
      dueAt: '',
    },
  });
  const [showAction, setShowAction] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const residualValues = useRef({ likelihood: 1, consequence: 1 });
  const verifyForm = useForm<{ likelihood: number; consequence: number }>({
    defaultValues: { likelihood: 1, consequence: 1 },
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.organization.finding(organizationId!, findingId),
    });
  const createAction = useMutation({
    mutationFn: (values: ActionForm) =>
      api.request(`/inspections/${inspectionId}/findings/${findingId}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          assignedToUserId: values.assignedToUserId || undefined,
          dueAt: values.dueAt || undefined,
        }),
      }),
    onSuccess: () => {
      actionForm.reset();
      setShowAction(false);
      void refresh();
    },
  });
  const completeAction = useMutation({
    mutationFn: (actionId: string) =>
      api.request(
        `/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/complete`,
        { method: 'POST' },
      ),
    onSuccess: refresh,
  });
  const verify = useMutation({
    mutationFn: (values: { likelihood: number; consequence: number }) =>
      api.request(`/inspections/${inspectionId}/findings/${findingId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          likelihood: Number(values.likelihood),
          consequence: Number(values.consequence),
        }),
      }),
    onSuccess: () => {
      setShowVerify(false);
      void refresh();
    },
  });
  if (finding.isLoading) return <p>Cargando hallazgo…</p>;
  if (!finding.data) return <p className="field-error">Hallazgo no encontrado.</p>;
  const data = finding.data;
  return (
    <div className="stack">
      <PageIntro
        eyebrow="Hallazgo"
        title={data.title}
        description={`${FINDING_CATEGORY_LABELS[data.category]} · ${data.workCenter?.name ?? ''}`}
        actions={
          data.status !== 'CLOSED' ? (
            <button className="button" onClick={() => setShowAction(!showAction)}>
              Nueva acción
            </button>
          ) : null
        }
      />
      <div className="detail-strip">
        <RiskBadge level={data.initialRiskLevel} />
        <StatusBadge>{label(data.status)}</StatusBadge>
      </div>
      <DemoNotice />
      <div className="grid">
        <Card className="stack">
          <h3>Riesgo inicial</h3>
          <strong className="big-number">{data.initialScore}</strong>
          <span>
            Probabilidad {data.initialLikelihood} × consecuencia {data.initialConsequence}
          </span>
        </Card>
        <Card className="stack">
          <h3>Riesgo residual</h3>
          {data.residualScore ? (
            <>
              <strong className="big-number">{data.residualScore}</strong>
              <RiskBadge level={data.residualRiskLevel!} />
            </>
          ) : (
            <p className="muted">Pendiente de verificación.</p>
          )}
        </Card>
      </div>
      {data.recurrenceStatus !== 'NONE' && (
        <div className="recurrence-callout">
          <strong>{label(data.recurrenceStatus)}</strong>
          <p>
            {data.recurrence?.previousCount} antecedentes en {data.recurrence?.windowDays} días, en{' '}
            {data.workCenter?.name} y categoría {FINDING_CATEGORY_LABELS[data.category]}.
          </p>
          {data.recurrence?.previous.map((item) => (
            <Link key={item.id} href={`/app/inspections/${item.inspectionId}/findings/${item.id}`}>
              {item.title} →
            </Link>
          ))}
          {data.recurrenceStatus === 'SYSTEMIC_REVIEW_RECOMMENDED' && (
            <p>
              <strong>Este aviso indica recurrencia, no confirma una causa raíz.</strong>
            </p>
          )}
        </div>
      )}
      {showAction && (
        <Card>
          <form
            className="stack"
            onSubmit={actionForm.handleSubmit((values) => createAction.mutate(values))}
          >
            <h3>Crear acción correctiva</h3>
            <div className="field">
              <label htmlFor="action-title">Acción</label>
              <input
                id="action-title"
                {...actionForm.register('title', { required: true, minLength: 3 })}
              />
            </div>
            <div className="field">
              <label htmlFor="action-description">Descripción</label>
              <textarea id="action-description" {...actionForm.register('description')} />
            </div>
            <div className="field">
              <label htmlFor="assignee">Responsable</label>
              <select id="assignee" {...actionForm.register('assignedToUserId')}>
                <option value="">Sin asignar</option>
                {context.data?.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
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
            <div className="field">
              <label htmlFor="due">Fecha límite</label>
              <input id="due" type="datetime-local" {...actionForm.register('dueAt')} />
            </div>
            <button className="button">Guardar acción</button>
          </form>
        </Card>
      )}
      <section className="stack">
        <h3>Acciones correctivas</h3>
        {data.actions.length === 0 ? (
          <Card>No hay acciones todavía.</Card>
        ) : (
          data.actions.map((action) => (
            <Card className="action-card" key={action.id}>
              <div>
                <StatusBadge>{label(action.status)}</StatusBadge>
                {action.overdue && <span className="overdue-chip">Vencida</span>}
                <h3>{action.title}</h3>
                <p className="muted">
                  Prioridad {label(action.priority)}
                  {action.assignedTo ? ` · ${action.assignedTo.displayName}` : ''}
                </p>
              </div>
              {data.status !== 'CLOSED' &&
                !['PENDING_VERIFICATION', 'COMPLETED', 'CANCELED'].includes(action.status) && (
                  <button
                    className="button secondary"
                    onClick={() => completeAction.mutate(action.id)}
                  >
                    Marcar terminada
                  </button>
                )}
            </Card>
          ))
        )}
      </section>
      {data.actions.some((action) => action.status === 'PENDING_VERIFICATION') && (
        <Card className="stack">
          <h3>Verificación</h3>
          <p>La verificación recalcula el riesgo residual en el backend.</p>
          {!showVerify ? (
            <button className="button" onClick={() => setShowVerify(true)}>
              Verificar corrección
            </button>
          ) : (
            <form
              className="stack"
              onSubmit={verifyForm.handleSubmit((values, event) => {
                if (!(event?.target instanceof HTMLFormElement)) return;
                const nativeValues = new FormData(event.target);
                verify.mutate({
                  ...values,
                  likelihood: Number(nativeValues.get('likelihood')),
                  consequence: Number(nativeValues.get('consequence')),
                });
              })}
            >
              <Scale
                name="likelihood"
                title="Probabilidad residual"
                descriptions={likelihoodDescriptions}
                register={verifyForm.register}
                onSelect={(name, value) => {
                  residualValues.current[name] = value;
                }}
              />
              <Scale
                name="consequence"
                title="Consecuencia residual"
                descriptions={consequenceDescriptions}
                register={verifyForm.register}
                onSelect={(name, value) => {
                  residualValues.current[name] = value;
                }}
              />
              <button
                type="button"
                className="button"
                onClick={() =>
                  void verifyForm.handleSubmit((values) =>
                    verify.mutate({
                      ...values,
                      likelihood: residualValues.current.likelihood,
                      consequence: residualValues.current.consequence,
                    }),
                  )()
                }
              >
                Confirmar verificación
              </button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}

export function InspectionAlerts() {
  const api = useApi();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId;
  const alerts = useQuery({
    queryKey: queryKeys.organization.inspectionAlerts(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<{
        items: Array<{
          id: string;
          type: string;
          severity: string;
          status: string;
          message: string;
          finding: {
            id: string;
            title: string;
            recurrenceCount: number;
            workCenter: { name: string };
            inspection: { id: string };
          };
        }>;
      }>('/inspections/alerts', { signal }),
    enabled: Boolean(organizationId),
  });
  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      api.request(`/inspections/alerts/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionAlerts(organizationId!),
      }),
  });
  return (
    <div className="stack">
      <PageIntro
        eyebrow="Inspecciones"
        title="Alertas"
        description="Recurrencias y riesgos residuales que requieren atención."
      />
      {alerts.data?.items.length ? (
        alerts.data.items.map((alert) => (
          <Card className="stack" key={alert.id}>
            <div className="detail-strip">
              <StatusBadge>{label(alert.status)}</StatusBadge>
              <span>{label(alert.type)}</span>
            </div>
            <h3>{alert.finding.title}</h3>
            <p>{alert.message}</p>
            {alert.type === 'RECURRENCE' && (
              <p>
                <strong>Este aviso indica recurrencia, no confirma una causa raíz.</strong>
              </p>
            )}
            <div className="form-actions compact">
              <Link
                href={`/app/inspections/${alert.finding.inspection.id}/findings/${alert.finding.id}`}
              >
                Ver hallazgo →
              </Link>
              {alert.status === 'OPEN' && (
                <button className="button secondary" onClick={() => acknowledge.mutate(alert.id)}>
                  Reconocer
                </button>
              )}
            </div>
          </Card>
        ))
      ) : (
        <Card>No hay alertas abiertas.</Card>
      )}
    </div>
  );
}

export function InspectionAnalytics() {
  const api = useApi();
  const organizationId = api.organizationId;
  const query = useQuery({
    queryKey: queryKeys.organization.inspectionAnalytics(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<Analytics>('/inspections/analytics/summary', { signal }),
    enabled: Boolean(organizationId),
  });
  if (!query.data) return <p>Cargando analítica…</p>;
  const data = query.data;
  return (
    <div className="stack">
      <PageIntro
        eyebrow="Inspecciones"
        title="Analítica operacional"
        description="Métricas calculadas exclusivamente con registros almacenados."
      />
      <div className="metric-grid">
        <Card>
          <span>Total inspecciones</span>
          <strong>{data.totalInspections}</strong>
        </Card>
        <Card>
          <span>Promedio días abiertos</span>
          <strong>{data.averageDaysOpen}</strong>
        </Card>
        <Card>
          <span>Porcentaje cerrado</span>
          <strong>{data.percentageClosed}%</strong>
        </Card>
        <Card>
          <span>Acciones vencidas</span>
          <strong>{data.overdueActions}</strong>
        </Card>
      </div>
      <div className="grid">
        <Card className="stack">
          <h3>Hallazgos por categoría</h3>
          {data.findingsByCategory.map((item) => (
            <div className="data-row" key={item.category}>
              <span>{FINDING_CATEGORY_LABELS[item.category]}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </Card>
        <Card className="stack">
          <h3>Hallazgos por centro</h3>
          {data.findingsByWorkCenter.map((item) => (
            <div className="data-row" key={item.workCenterId}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </Card>
        <Card className="stack">
          <h3>Riesgo inicial</h3>
          {data.findingsByRiskLevel.map((item) => (
            <div className="data-row" key={item.riskLevel}>
              <span>{label(item.riskLevel)}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
