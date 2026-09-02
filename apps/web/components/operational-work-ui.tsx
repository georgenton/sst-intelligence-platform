'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { humanOperationalPriorityLabel, humanRiskLevelLabel } from '@/lib/human-lexicon';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextSummary,
  TechnicalDetailsDisclosure,
  WorkspaceHeader,
  WorkspaceInspector,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type QueueItem = {
  type: string;
  sourceId: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  dueAt: string | null;
  overdue: boolean;
  module: string;
  deepLink: string;
  origin: string;
  workCenter: { id: string; name: string } | null;
  assignee: { id: string; displayName: string } | null;
  regulatoryContext: { label: string; candidate: boolean } | null;
  riskContext: { method: string; level: string | null } | null;
};

type QueueResponse = { items: QueueItem[]; page: number; pageSize: number; total: number };
type WorkCenter = { id: string; name: string; isActive: boolean };
type Member = {
  status: string;
  user: { id: string; displayName: string; email: string };
};
type Requirement = { id: string; title: string; editorialStatus: string };
type Obligation = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  originType: string;
  dueAt?: string;
  evidenceExpectation?: string;
  reviewRequired: boolean;
  reviewDecision?: string;
  reviewComment?: string;
  reviewedAt?: string;
  completedAt?: string;
  version: number;
  provenanceSnapshot: Record<string, unknown>;
  workCenter?: { id: string; name: string };
  assignedTo?: { id: string; displayName: string };
  createdBy: { id: string; displayName: string };
  reviewedBy?: { id: string; displayName: string };
  evidence: Array<{
    id: string;
    type: 'NOTE' | 'EXTERNAL_LINK';
    note?: string;
    externalUrl?: string;
    createdAt: string;
    createdBy: { displayName: string };
  }>;
  requirement?: { title: string; editorialStatus: string };
  regulatoryUnit?: { identifier: string; locator: string };
};

const statusLabels: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En curso',
  BLOCKED: 'Bloqueado',
  READY_FOR_REVIEW: 'Listo para revisión',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  CANCELED: 'Cancelado',
  NEEDS_REVISION: 'Requiere ajustes',
  NEEDS_EXPERT_REVIEW: 'Revisión experta',
  PENDING_VERIFICATION: 'Verificación pendiente',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  AUTHORIZED: 'Autorizado',
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  REPLACEMENT_DUE: 'Reemplazo requerido',
  REVIEW_REQUIRED: 'Revisión requerida',
  REPORTED: 'Reportado',
  UNDER_INVESTIGATION: 'En investigación',
  ACTIONS_IN_PROGRESS: 'Acciones en curso',
  REQUIRED: 'Requerido',
  DUE_SOON: 'Próximo a vencer',
  EXPIRED: 'Vencido',
  SCHEDULED: 'Programada',
};

const moduleLabels: Record<string, string> = {
  INSPECTIONS: 'Inspecciones',
  TECHNICAL_RISK: 'Riesgo técnico',
  REGULATORY: 'Contexto normativo',
  OPERATIONAL_EXECUTION: 'Ejecución operativa',
  WORK_PERMITS: 'Permisos de trabajo',
  INCIDENTS: 'Incidentes',
  PPE: 'EPP',
  TRAINING: 'Capacitación',
  GOVERNANCE: 'Gobernanza',
  INTELLIGENCE: 'Inteligencia operativa',
};

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 403) return 'Tu rol no permite realizar esta operación.';
    if (error.status === 409)
      return 'El registro cambió en otra sesión. Actualiza e intenta nuevamente.';
  }
  return 'No pudimos completar la operación. Revisa los datos e intenta nuevamente.';
}

type QueueFilters = {
  status: string;
  module: string;
  priority: string;
  workCenterId: string;
  assignedToUserId: string;
  dueFrom: string;
  dueTo: string;
};

export function OperationalWorkQueue({
  initialFilters = {},
}: {
  initialFilters?: Partial<QueueFilters>;
}) {
  const auth = useAuth();
  const organization = useOrganization();
  const router = useRouter();
  const organizationId = organization.activeId;
  const form = useForm<QueueFilters>({
    defaultValues: {
      status: initialFilters.status ?? '',
      module: initialFilters.module ?? '',
      priority: initialFilters.priority ?? '',
      workCenterId: initialFilters.workCenterId ?? '',
      assignedToUserId: initialFilters.assignedToUserId ?? '',
      dueFrom: initialFilters.dueFrom ?? '',
      dueTo: initialFilters.dueTo ?? '',
    },
  });
  const encoded = new URLSearchParams(
    Object.entries(form.getValues()).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();
  const queue = useQuery({
    queryKey: queryKeys.organization.workQueue(organizationId ?? 'inactive', encoded),
    queryFn: ({ signal }) =>
      auth.request<QueueResponse>(
        `/work-queue?pageSize=50${encoded ? `&${encoded}` : ''}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const [workCenters, members] = [
    useQuery({
      queryKey: queryKeys.organization.workCenters(organizationId ?? 'inactive'),
      queryFn: ({ signal }) =>
        auth.request<WorkCenter[]>(
          `/organizations/${organizationId}/work-centers`,
          { signal },
          organizationId!,
        ),
      enabled: Boolean(organizationId),
    }),
    useQuery({
      queryKey: queryKeys.organization.members(organizationId ?? 'inactive'),
      queryFn: ({ signal }) =>
        auth.request<Member[]>(
          `/organizations/${organizationId}/members`,
          { signal },
          organizationId!,
        ),
      enabled: Boolean(organizationId),
    }),
  ];

  function applyFilters(values: QueueFilters) {
    const params = new URLSearchParams(
      Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    router.push(`/app/work${params.size ? `?${params}` : ''}`);
  }

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Operación"
        title="Cola de trabajo"
        description="Una proyección ordenada del trabajo pendiente. Cada registro conserva su módulo, reglas y contexto de origen."
        actions={
          <Link className="button" href="/app/work/obligations/new">
            Nueva actividad
          </Link>
        }
      />
      <form className="queue-filters" onSubmit={form.handleSubmit(applyFilters)}>
        <label>
          Estado
          <select {...form.register('status')}>
            <option value="">Todos</option>
            <option value="OPEN">Abierto</option>
            <option value="IN_PROGRESS">En curso</option>
            <option value="BLOCKED">Bloqueado</option>
            <option value="READY_FOR_REVIEW">Listo para revisión</option>
            <option value="NEEDS_REVISION">Requiere ajustes</option>
          </select>
        </label>
        <label>
          Módulo
          <select {...form.register('module')}>
            <option value="">Todos</option>
            {Object.entries(moduleLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select {...form.register('priority')}>
            <option value="">Todas</option>
            <option value="URGENT">Urgente</option>
            <option value="HIGH">Alta</option>
            <option value="MEDIUM">Media</option>
            <option value="LOW">Baja</option>
          </select>
        </label>
        <label>
          Centro de trabajo
          <select {...form.register('workCenterId')}>
            <option value="">Todos</option>
            {workCenters.data
              ?.filter((item) => item.isActive)
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Responsable
          <select {...form.register('assignedToUserId')}>
            <option value="">Todas las personas</option>
            {members.data
              ?.filter((item) => item.status === 'ACTIVE')
              .map((item) => (
                <option value={item.user.id} key={item.user.id}>
                  {item.user.displayName}
                </option>
              ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" {...form.register('dueFrom')} />
        </label>
        <label>
          Hasta
          <input type="date" {...form.register('dueTo')} />
        </label>
        <div className="queue-filter-actions">
          <button className="button" type="submit">
            Aplicar
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              form.reset();
              router.push('/app/work');
            }}
          >
            Limpiar
          </button>
        </div>
      </form>
      {queue.isLoading ? <p role="status">Cargando cola de trabajo…</p> : null}
      {queue.isError ? (
        <Card role="alert">
          <h2>No pudimos cargar la cola</h2>
          <p>Reintenta sin perder los filtros actuales.</p>
        </Card>
      ) : null}
      {queue.data?.items.length ? (
        <div className="queue-list" role="list">
          {queue.data.items.map((item) => (
            <article className="queue-row" role="listitem" key={`${item.type}-${item.sourceId}`}>
              <div>
                <div className="command-item-meta">
                  <span>{moduleLabels[item.module] ?? 'Trabajo operativo'}</span>
                  <span>{statusLabels[item.status] ?? 'Pendiente'}</span>
                  <span>{humanOperationalPriorityLabel(item.priority)} prioridad</span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
                <small>
                  {item.workCenter?.name ?? 'Alcance de organización'}
                  {item.assignee
                    ? ` · Responsable: ${item.assignee.displayName}`
                    : ' · Sin responsable'}
                  {item.dueAt
                    ? ` · ${item.overdue ? 'Venció' : 'Fecha objetivo'} ${new Date(item.dueAt).toLocaleDateString('es-EC')}`
                    : ' · Sin fecha comprometida'}
                </small>
                {item.regulatoryContext?.candidate ? (
                  <p className="candidate-notice">
                    Referencia candidata; no equivale a una obligación aprobada.
                  </p>
                ) : null}
                {item.riskContext ? (
                  <p className="muted">
                    Método registrado: {item.riskContext.method}
                    {item.riskContext.level
                      ? ` · nivel ${humanRiskLevelLabel(item.riskContext.level)}`
                      : ''}
                  </p>
                ) : null}
              </div>
              <Link className="button secondary" href={item.deepLink}>
                Abrir
              </Link>
            </article>
          ))}
        </div>
      ) : queue.isSuccess ? (
        <Card className="command-empty-state">
          <h2>No hay elementos con estos filtros</h2>
          <p>Prueba un alcance distinto o registra una nueva actividad interna.</p>
        </Card>
      ) : null}
    </WorkspaceShell>
  );
}

type ObligationForm = {
  title: string;
  description: string;
  originType: 'APPROVED_REQUIREMENT' | 'CANDIDATE_REQUIREMENT' | 'INTERNAL_PROGRAM' | 'MANUAL';
  requirementId: string;
  internalReference: string;
  manualReference: string;
  workCenterId: string;
  assignedToUserId: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string;
  evidenceExpectation: string;
  reviewRequired: boolean;
};

export function NewObligationExecution() {
  const auth = useAuth();
  const organization = useOrganization();
  const router = useRouter();
  const organizationId = organization.activeId;
  const form = useForm<ObligationForm>({
    defaultValues: {
      title: '',
      description: '',
      originType: 'INTERNAL_PROGRAM',
      requirementId: '',
      internalReference: '',
      manualReference: '',
      workCenterId: '',
      assignedToUserId: '',
      priority: 'MEDIUM',
      dueAt: '',
      evidenceExpectation: '',
      reviewRequired: false,
    },
  });
  const originType = form.watch('originType');
  const workCenters = useQuery({
    queryKey: queryKeys.organization.workCenters(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<WorkCenter[]>(
        `/organizations/${organizationId}/work-centers`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const members = useQuery({
    queryKey: queryKeys.organization.members(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Member[]>(
        `/organizations/${organizationId}/members`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const requirements = useQuery({
    queryKey: queryKeys.organization.regulatoryRequirements(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Requirement[]>('/regulatory-requirements', { signal }, organizationId!),
    enabled: Boolean(organizationId && originType.includes('REQUIREMENT')),
  });
  const create = useMutation({
    mutationFn: (values: ObligationForm) =>
      auth.request<Obligation>(
        '/operational-execution/obligations',
        {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            requirementId: values.requirementId || undefined,
            internalReference:
              values.originType === 'INTERNAL_PROGRAM' ? values.internalReference : undefined,
            manualReference: values.originType === 'MANUAL' ? values.manualReference : undefined,
            workCenterId: values.workCenterId || undefined,
            assignedToUserId: values.assignedToUserId || undefined,
            dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
            evidenceExpectation: values.evidenceExpectation || undefined,
          }),
        },
        organizationId!,
      ),
    onSuccess: (item) => router.push(`/app/work/obligations/${item.id}`),
  });

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Ejecución operativa"
        title="Nueva actividad"
        description="Convierte una fuente aprobada, una candidata identificada o un programa interno en trabajo trazable. No se inventan fechas legales."
      />
      <form
        className="obligation-form"
        onSubmit={form.handleSubmit((values) => create.mutate(values))}
        noValidate
      >
        <label>
          Título
          <input {...form.register('title', { required: 'Escribe un título.', minLength: 3 })} />
          {form.formState.errors.title ? (
            <span className="field-error">{form.formState.errors.title.message}</span>
          ) : null}
        </label>
        <label>
          Descripción
          <textarea rows={4} {...form.register('description')} />
        </label>
        <label>
          Origen
          <select {...form.register('originType')}>
            <option value="INTERNAL_PROGRAM">Programa interno</option>
            <option value="MANUAL">Registro manual</option>
            <option value="APPROVED_REQUIREMENT">Requisito editorial aprobado</option>
            <option value="CANDIDATE_REQUIREMENT">Requisito candidato</option>
          </select>
        </label>
        {originType.includes('REQUIREMENT') ? (
          <label>
            Requisito
            <select {...form.register('requirementId', { required: 'Selecciona un requisito.' })}>
              <option value="">Seleccionar</option>
              {requirements.data
                ?.filter((item) =>
                  originType === 'APPROVED_REQUIREMENT'
                    ? item.editorialStatus === 'APPROVED_FOR_RULE_DRAFTING'
                    : !['APPROVED_FOR_RULE_DRAFTING', 'REJECTED', 'SUPERSEDED'].includes(
                        item.editorialStatus,
                      ),
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                    {originType === 'CANDIDATE_REQUIREMENT' ? ' · candidato' : ''}
                  </option>
                ))}
            </select>
          </label>
        ) : originType === 'INTERNAL_PROGRAM' ? (
          <label>
            Referencia del programa interno
            <input
              {...form.register('internalReference', {
                required: 'Documenta la referencia interna.',
              })}
            />
          </label>
        ) : (
          <label>
            Referencia manual
            <input
              {...form.register('manualReference', { required: 'Documenta la referencia manual.' })}
            />
          </label>
        )}
        <div className="obligation-form-grid">
          <label>
            Centro de trabajo
            <select {...form.register('workCenterId')}>
              <option value="">Alcance de organización</option>
              {workCenters.data
                ?.filter((item) => item.isActive)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Responsable
            <select {...form.register('assignedToUserId')}>
              <option value="">Sin asignar</option>
              {members.data
                ?.filter((item) => item.status === 'ACTIVE')
                .map((item) => (
                  <option value={item.user.id} key={item.user.id}>
                    {item.user.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Prioridad
            <select {...form.register('priority')}>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </label>
          <label>
            Fecha objetivo
            <input type="datetime-local" {...form.register('dueAt')} />
            <small>Déjala vacía si no existe una fecha operativa real.</small>
          </label>
        </div>
        <label>
          Evidencia esperada
          <textarea rows={3} {...form.register('evidenceExpectation')} />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" {...form.register('reviewRequired')} /> Requiere revisión
          profesional antes de completarse
        </label>
        {originType === 'CANDIDATE_REQUIREMENT' ? (
          <p className="candidate-notice">
            Esta actividad conservará una marca visible de candidata y no se presentará como
            obligación legal confirmada.
          </p>
        ) : null}
        {create.isError ? (
          <p role="alert" className="field-error">
            {errorMessage(create.error)}
          </p>
        ) : null}
        <div className="obligation-actions">
          <Link className="button secondary" href="/app/work">
            Cancelar
          </Link>
          <button className="button" type="submit" disabled={create.isPending}>
            {create.isPending ? 'Guardando…' : 'Crear actividad'}
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}

type EvidenceForm = { type: 'NOTE' | 'EXTERNAL_LINK'; note: string; externalUrl: string };

export function ObligationExecutionDetail({ obligationId }: { obligationId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const evidenceForm = useForm<EvidenceForm>({
    defaultValues: { type: 'NOTE', note: '', externalUrl: '' },
  });
  const item = useQuery({
    queryKey: queryKeys.organization.obligation(organizationId ?? 'inactive', obligationId),
    queryFn: ({ signal }) =>
      auth.request<Obligation>(
        `/operational-execution/obligations/${obligationId}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.obligation(organizationId!, obligationId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workQueueRoot(organizationId!),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.dashboard(organizationId!),
      }),
    ]);
  };
  const transition = useMutation({
    mutationFn: (status: string) =>
      auth.request(
        `/operational-execution/obligations/${obligationId}/transition`,
        { method: 'POST', body: JSON.stringify({ status, expectedVersion: item.data!.version }) },
        organizationId!,
      ),
    onSuccess: refresh,
  });
  const review = useMutation({
    mutationFn: (decision: 'APPROVED' | 'NEEDS_REVISION') =>
      auth.request(
        `/operational-execution/obligations/${obligationId}/review`,
        { method: 'POST', body: JSON.stringify({ decision, expectedVersion: item.data!.version }) },
        organizationId!,
      ),
    onSuccess: refresh,
  });
  const evidence = useMutation({
    mutationFn: (values: EvidenceForm) =>
      auth.request(
        `/operational-execution/obligations/${obligationId}/evidence`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: values.type,
            note: values.type === 'NOTE' ? values.note : undefined,
            externalUrl: values.type === 'EXTERNAL_LINK' ? values.externalUrl : undefined,
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      evidenceForm.reset();
      await refresh();
    },
  });

  if (item.isLoading) return <p role="status">Cargando actividad…</p>;
  if (item.isError || !item.data)
    return (
      <Card role="alert">
        <h1>No encontramos la actividad</h1>
        <p>Comprueba la organización activa o vuelve a la cola.</p>
        <Link href="/app/work">Volver</Link>
      </Card>
    );
  const data = item.data;
  const finished = ['COMPLETED', 'CANCELLED'].includes(data.status);
  const evidenceType = evidenceForm.watch('type');
  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Ejecución operativa"
        title={data.title}
        description={data.description ?? 'Actividad operativa trazable.'}
        context={
          <ContextSummary>
            <span>{data.workCenter?.name ?? 'Alcance de organización'}</span>
            <span>{statusLabels[data.status] ?? data.status}</span>
            <span>{data.assignedTo?.displayName ?? 'Sin responsable'}</span>
          </ContextSummary>
        }
        actions={
          <Link className="button secondary" href="/app/work">
            Volver a la cola
          </Link>
        }
      />
      {data.originType === 'CANDIDATE_REQUIREMENT' ? (
        <p className="candidate-notice">
          Origen candidato: este registro no representa una obligación regulatoria aprobada.
        </p>
      ) : null}
      {transition.isError || review.isError || evidence.isError ? (
        <p className="field-error" role="alert">
          {errorMessage(transition.error ?? review.error ?? evidence.error)}
        </p>
      ) : null}
      <div className="workspace-two-pane">
        <WorkspaceMain>
          <WorkspaceSection
            title="Ejecución"
            description="Los cambios de estado son explícitos y quedan auditados."
          >
            {!finished ? (
              <div className="obligation-actions">
                {data.status === 'OPEN' ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => transition.mutate('IN_PROGRESS')}
                  >
                    Iniciar
                  </button>
                ) : null}
                {data.status === 'IN_PROGRESS' ? (
                  <>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => transition.mutate('BLOCKED')}
                    >
                      Marcar bloqueo
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        transition.mutate(data.reviewRequired ? 'READY_FOR_REVIEW' : 'COMPLETED')
                      }
                    >
                      {data.reviewRequired ? 'Enviar a revisión' : 'Completar'}
                    </button>
                  </>
                ) : null}
                {data.status === 'BLOCKED' ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => transition.mutate('IN_PROGRESS')}
                  >
                    Reanudar
                  </button>
                ) : null}
                {data.status === 'READY_FOR_REVIEW' ? (
                  <>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => review.mutate('NEEDS_REVISION')}
                    >
                      Solicitar cambios
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => review.mutate('APPROVED')}
                    >
                      Aprobar revisión
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <p>Esta actividad está finalizada y permanece disponible como registro histórico.</p>
            )}
          </WorkspaceSection>
          <WorkspaceSection
            title="Evidencia de la organización"
            description="Separada de las fuentes regulatorias y de la evidencia de valoración de riesgo."
          >
            {data.evidence.length ? (
              <div className="evidence-list">
                {data.evidence.map((entry) => (
                  <article key={entry.id}>
                    <strong>{entry.createdBy.displayName}</strong>
                    <p>
                      {entry.type === 'NOTE' ? (
                        entry.note
                      ) : (
                        <a href={entry.externalUrl} target="_blank" rel="noreferrer">
                          Abrir enlace de evidencia
                        </a>
                      )}
                    </p>
                    <small>{new Date(entry.createdAt).toLocaleString('es-EC')}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Aún no hay evidencia organizacional registrada.</p>
            )}
            {!finished ? (
              <form
                className="evidence-form"
                onSubmit={evidenceForm.handleSubmit((values) => evidence.mutate(values))}
              >
                <label>
                  Tipo
                  <select {...evidenceForm.register('type')}>
                    <option value="NOTE">Nota</option>
                    <option value="EXTERNAL_LINK">Enlace externo</option>
                  </select>
                </label>
                {evidenceType === 'NOTE' ? (
                  <label>
                    Nota
                    <textarea rows={3} {...evidenceForm.register('note', { required: true })} />
                  </label>
                ) : (
                  <label>
                    Enlace HTTPS
                    <input
                      type="url"
                      {...evidenceForm.register('externalUrl', { required: true })}
                    />
                  </label>
                )}
                <button className="button secondary" type="submit">
                  Añadir evidencia
                </button>
              </form>
            ) : null}
          </WorkspaceSection>
        </WorkspaceMain>
        <WorkspaceInspector label="Contexto y trazabilidad">
          <section>
            <h2>Origen</h2>
            <p>
              {data.requirement?.title ??
                data.regulatoryUnit?.locator ??
                (data.originType === 'INTERNAL_PROGRAM' ? 'Programa interno' : 'Registro manual')}
            </p>
            {data.originType === 'CANDIDATE_REQUIREMENT' ? (
              <strong className="candidate-notice">Candidato</strong>
            ) : null}
          </section>
          <section>
            <h2>Revisión profesional</h2>
            <p>
              {data.reviewRequired
                ? data.reviewDecision === 'APPROVED'
                  ? 'Aprobada para cierre operativo'
                  : data.reviewDecision === 'NEEDS_REVISION'
                    ? 'Cambios solicitados'
                    : 'Pendiente'
                : 'No requerida'}
            </p>
            {data.reviewedBy ? (
              <small>
                {data.reviewedBy.displayName} ·{' '}
                {data.reviewedAt ? new Date(data.reviewedAt).toLocaleString('es-EC') : ''}
              </small>
            ) : null}
            <p className="muted">La revisión y el cierre no certifican cumplimiento legal.</p>
          </section>
          <TechnicalDetailsDisclosure summary="Ver instantánea de procedencia">
            <pre>{JSON.stringify(data.provenanceSnapshot, null, 2)}</pre>
          </TechnicalDetailsDisclosure>
        </WorkspaceInspector>
      </div>
    </WorkspaceShell>
  );
}
