'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { humanRoleLabel } from '@/lib/human-lexicon';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import type { Worker } from './workforce-safety-ui';
import {
  ContextSummary,
  WorkspaceHeader,
  WorkspaceInspector,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type IncidentStatus =
  'DRAFT' | 'REPORTED' | 'UNDER_INVESTIGATION' | 'ACTIONS_IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'COMPLETED' | 'CANCELLED';
type Evidence = {
  id: string;
  type: 'NOTE' | 'EXTERNAL_LINK';
  note?: string | null;
  externalUrl?: string | null;
  createdAt: string;
  createdBy: { id: string; displayName: string };
};
type IncidentAction = {
  id: string;
  title: string;
  description?: string | null;
  status: ActionStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt?: string | null;
  version: number;
  owner?: { id: string; displayName: string } | null;
  evidence: Evidence[];
};
type Incident = {
  id: string;
  title: string;
  description: string;
  activityContext?: string | null;
  eventType: 'INCIDENT' | 'NEAR_MISS';
  status: IncidentStatus;
  occurredAt: string;
  reportedAt?: string | null;
  version: number;
  workCenter: { id: string; name: string };
  reportedBy?: { id: string; displayName: string };
  linkedInspection?: { id: string; title: string } | null;
  linkedFinding?: { id: string; title: string } | null;
  linkedAssessment?: { id: string; title: string } | null;
  involvedWorkers: Array<{
    id: string;
    involvement?: string | null;
    worker: Pick<Worker, 'id' | 'displayName' | 'status' | 'jobTitle' | 'workCenter'>;
  }>;
  investigation?: {
    id: string;
    status: 'IN_PROGRESS' | 'COMPLETED';
    summary?: string | null;
    startedAt: string;
    completedAt?: string | null;
    version: number;
    startedBy: { id: string; displayName: string };
    completedBy?: { id: string; displayName: string } | null;
  } | null;
  contributingFactors: Array<{
    id: string;
    category: string;
    description: string;
    rationale?: string | null;
    recordedAt: string;
    recordedBy: { id: string; displayName: string };
  }>;
  actions: IncidentAction[];
  evidence: Evidence[];
};
type IncidentList = {
  items: Array<
    Pick<Incident, 'id' | 'title' | 'eventType' | 'status' | 'occurredAt' | 'version'> & {
      description: string;
      workCenter: { id: string; name: string };
      involvedWorkers: Array<{ worker: { id: string; displayName: string } }>;
      _count: { actions: number; contributingFactors: number };
    }
  >;
  total: number;
};
type IncidentAnalytics = {
  total: number;
  nearMisses: number;
  byWorkCenter: Array<{ workCenterId: string; workCenterName: string; count: number }>;
  byEventType: Array<{ eventType: 'INCIDENT' | 'NEAR_MISS'; count: number }>;
};
type WorkCenter = { id: string; name: string; isActive: boolean };
type WorkerList = { items: Worker[]; total: number };
type OrganizationMember = {
  id: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  user: { id: string; displayName: string; email: string };
};
type IncidentForm = {
  workCenterId: string;
  occurredAt: string;
  title: string;
  description: string;
  eventType: 'INCIDENT' | 'NEAR_MISS';
  activityContext: string;
};
type FactorForm = { category: string; description: string; rationale: string };
type ActionForm = {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  ownerUserId: string;
  dueAt: string;
};
type Operation = { path: string; body: Record<string, unknown> };

const WRITE_ROLES = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
const REVIEW_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);
const STATUS_LABELS: Record<IncidentStatus, string> = {
  DRAFT: 'Borrador',
  REPORTED: 'Reportado',
  UNDER_INVESTIGATION: 'En investigación',
  ACTIONS_IN_PROGRESS: 'Acciones en curso',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
};
const ACTION_LABELS: Record<ActionStatus, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En curso',
  PENDING_VERIFICATION: 'Pendiente de verificación',
  COMPLETED: 'Verificada',
  CANCELLED: 'Cancelada',
};

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.payload.message
    : 'No pudimos completar la operación. Intenta nuevamente.';
}

function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className="status-badge" data-status={status.toLowerCase()}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function WorkerIncidentsPanel({ workerId }: { workerId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId;
  const filters = `workerId=${encodeURIComponent(workerId)}&pageSize=100`;
  const incidents = useQuery({
    queryKey: queryKeys.organization.incidents(organizationId ?? 'inactive', filters),
    queryFn: ({ signal }) =>
      auth.request<IncidentList>(`/incidents?${filters}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const activeInvestigations = (incidents.data?.items ?? []).filter(
    (incident) => incident.status === 'UNDER_INVESTIGATION',
  ).length;

  return (
    <WorkspaceSection title="Incidentes" eyebrow="Historia SST" id="incidents">
      <p>
        Eventos donde participa esta persona. La historia permanece disponible sin registrar
        diagnósticos médicos ni atribuir causas automáticamente.
      </p>
      <ContextSummary>
        <span>{incidents.data?.total ?? 0} eventos relacionados</span>
        <span>{activeInvestigations} en investigación</span>
      </ContextSummary>
      {incidents.isLoading ? <p role="status">Cargando historia de incidentes…</p> : null}
      {incidents.isError ? (
        <Card role="alert">
          <p>{errorMessage(incidents.error)}</p>
          <button
            className="button secondary"
            onClick={() => void incidents.refetch()}
            type="button"
          >
            Reintentar
          </button>
        </Card>
      ) : null}
      {!incidents.isLoading && incidents.data?.items.length === 0 ? (
        <Card>
          <h3>Sin incidentes vinculados</h3>
          <p>No hay eventos registrados para esta persona.</p>
        </Card>
      ) : null}
      <div className="worker-list">
        {(incidents.data?.items ?? []).map((incident) => (
          <article className="worker-row" key={incident.id}>
            <div>
              <div className="worker-row__title">
                <h3>{incident.title}</h3>
                <IncidentStatusBadge status={incident.status} />
              </div>
              <p>
                {incident.eventType === 'NEAR_MISS' ? 'Casi incidente' : 'Incidente'} ·{' '}
                {incident.workCenter.name}
              </p>
              <small>
                {new Date(incident.occurredAt).toLocaleString('es-EC')} · {incident._count.actions}{' '}
                acciones · {incident._count.contributingFactors} factores observados
              </small>
            </div>
            <Link className="button secondary" href={`/app/incidents/${incident.id}`}>
              Abrir flujo del incidente
            </Link>
          </article>
        ))}
      </div>
    </WorkspaceSection>
  );
}

export function IncidentRegistry() {
  const auth = useAuth();
  const organization = useOrganization();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [search, status]);
  const incidents = useQuery({
    queryKey: queryKeys.organization.incidents(organizationId ?? 'inactive', filters),
    queryFn: ({ signal }) =>
      auth.request<IncidentList>(`/incidents?${filters}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const analytics = useQuery({
    queryKey: queryKeys.organization.incidentAnalytics(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<IncidentAnalytics>('/incidents/analytics/summary', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const centers = useQuery({
    queryKey: queryKeys.organization.workCenters(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<WorkCenter[]>(
        `/organizations/${organizationId}/work-centers`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const form = useForm<IncidentForm>({
    defaultValues: {
      workCenterId: '',
      occurredAt: '',
      title: '',
      description: '',
      eventType: 'INCIDENT',
      activityContext: '',
    },
  });
  const create = useMutation({
    mutationFn: (values: IncidentForm) =>
      auth.request<Incident>(
        '/incidents',
        {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            occurredAt: new Date(values.occurredAt).toISOString(),
            ...(values.activityContext ? {} : { activityContext: undefined }),
          }),
        },
        organizationId!,
      ),
    onSuccess: async (incident) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
      router.push(`/app/incidents/${incident.id}`);
    },
  });

  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceHeader
        eyebrow="Operación · Incidentes"
        title="Incidentes y casi incidentes"
        description="Registra hechos, conduce la investigación profesional y da seguimiento a acciones sin convertir el sistema en un expediente médico ni legal."
      />
      <ContextSummary>
        <span>{analytics.data?.total ?? incidents.data?.total ?? 0} eventos registrados</span>
        <span>{analytics.data?.nearMisses ?? 0} casi incidentes</span>
        <span>Sin determinación automática de causa raíz</span>
      </ContextSummary>

      {canWrite ? (
        <WorkspaceSection
          eyebrow="Registro factual"
          title="Nuevo evento"
          description="Describe lo observado. No ingreses diagnósticos médicos ni conclusiones legales."
        >
          <form
            className="workforce-form"
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
          >
            <label className="field">
              <span>Tipo de evento</span>
              <select {...form.register('eventType')}>
                <option value="INCIDENT">Incidente</option>
                <option value="NEAR_MISS">Casi incidente</option>
              </select>
            </label>
            <label className="field">
              <span>Centro de trabajo</span>
              <select {...form.register('workCenterId', { required: true })}>
                <option value="">Selecciona un centro</option>
                {(centers.data ?? [])
                  .filter((center) => center.isActive)
                  .map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Fecha y hora del evento</span>
              <input type="datetime-local" {...form.register('occurredAt', { required: true })} />
            </label>
            <label className="field">
              <span>Título breve</span>
              <input {...form.register('title', { required: true, minLength: 3 })} />
            </label>
            <label className="field workforce-form__wide">
              <span>Descripción factual</span>
              <textarea
                rows={4}
                {...form.register('description', { required: true, minLength: 3 })}
              />
            </label>
            <label className="field workforce-form__wide">
              <span>Actividad o contexto (opcional)</span>
              <textarea rows={2} {...form.register('activityContext')} />
            </label>
            <div className="workforce-form__actions">
              <button className="button" disabled={create.isPending} type="submit">
                {create.isPending ? 'Guardando…' : 'Guardar borrador'}
              </button>
              {create.isError ? <p role="alert">{errorMessage(create.error)}</p> : null}
            </div>
          </form>
        </WorkspaceSection>
      ) : null}

      <WorkspaceSection eyebrow="Seguimiento" title="Eventos registrados">
        <div className="workforce-filters" role="search">
          <label className="field">
            <span>Buscar</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="field">
            <span>Estado</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {incidents.isLoading ? <p role="status">Cargando incidentes…</p> : null}
        {incidents.isError ? (
          <Card role="alert">
            <p>{errorMessage(incidents.error)}</p>
            <button
              className="button secondary"
              onClick={() => void incidents.refetch()}
              type="button"
            >
              Reintentar
            </button>
          </Card>
        ) : null}
        {!incidents.isLoading && incidents.data?.items.length === 0 ? (
          <Card>
            <h3>No hay eventos para estos filtros</h3>
            <p>Registra un evento o ajusta la búsqueda.</p>
          </Card>
        ) : null}
        <div className="worker-list">
          {(incidents.data?.items ?? []).map((incident) => (
            <article className="worker-row" key={incident.id}>
              <div>
                <div className="worker-row__title">
                  <h3>{incident.title}</h3>
                  <IncidentStatusBadge status={incident.status} />
                </div>
                <p>
                  {incident.eventType === 'NEAR_MISS' ? 'Casi incidente' : 'Incidente'} ·{' '}
                  {incident.workCenter.name}
                </p>
                <small>
                  {new Date(incident.occurredAt).toLocaleString('es-EC')} ·{' '}
                  {incident._count.actions} acciones
                </small>
              </div>
              <Link className="button secondary" href={`/app/incidents/${incident.id}`}>
                Abrir investigación
              </Link>
            </article>
          ))}
        </div>
      </WorkspaceSection>
    </WorkspaceShell>
  );
}

export function IncidentWorkspace({ incidentId }: { incidentId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const canReview = REVIEW_ROLES.has(organization.currentRole ?? '');
  const [workerId, setWorkerId] = useState('');
  const [workerInvolvement, setWorkerInvolvement] = useState('');
  const [investigationEvidence, setInvestigationEvidence] = useState('');
  const [actionEvidence, setActionEvidence] = useState<Record<string, string>>({});
  const factorForm = useForm<FactorForm>({
    defaultValues: { category: 'TASK', description: '', rationale: '' },
  });
  const actionForm = useForm<ActionForm>({
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      ownerUserId: auth.user?.id ?? '',
      dueAt: '',
    },
  });
  const incident = useQuery({
    queryKey: queryKeys.organization.incident(organizationId ?? 'inactive', incidentId),
    queryFn: ({ signal }) =>
      auth.request<Incident>(`/incidents/${incidentId}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const workers = useQuery({
    queryKey: queryKeys.organization.workers(
      organizationId ?? 'inactive',
      'status=ACTIVE&pageSize=100',
    ),
    queryFn: ({ signal }) =>
      auth.request<WorkerList>('/workers?status=ACTIVE&pageSize=100', { signal }, organizationId!),
    enabled: Boolean(organizationId && canWrite),
  });
  const members = useQuery({
    queryKey: queryKeys.organization.members(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<OrganizationMember[]>(
        `/organizations/${organizationId}/members`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite),
  });
  const operation = useMutation({
    mutationFn: ({ path, body }: Operation) =>
      auth.request<unknown>(path, { method: 'POST', body: JSON.stringify(body) }, organizationId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });
  const run = (path: string, body: Record<string, unknown>, after?: () => void) => {
    operation.mutate({ path, body }, { onSuccess: () => after?.() });
  };

  if (incident.isLoading)
    return (
      <WorkspaceShell>
        <p role="status">Cargando incidente…</p>
      </WorkspaceShell>
    );
  if (incident.isError || !incident.data) {
    return (
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Incidentes"
          title="No pudimos abrir este evento"
          description={
            incident.isError ? errorMessage(incident.error) : 'Confirma la organización activa.'
          }
          actions={<Link href="/app/incidents">Volver a incidentes</Link>}
        />
      </WorkspaceShell>
    );
  }
  const data = incident.data;
  const activeInvestigation = data.investigation?.status === 'IN_PROGRESS';
  const mutable = !['CLOSED', 'CANCELLED'].includes(data.status);

  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceHeader
        eyebrow="Incidentes · Espacio profesional"
        title={data.title}
        description={data.description}
        context={<IncidentStatusBadge status={data.status} />}
        actions={
          <Link className="button secondary" href="/app/incidents">
            Volver al registro
          </Link>
        }
      />
      <ContextSummary>
        <span>{data.eventType === 'NEAR_MISS' ? 'Casi incidente' : 'Incidente'}</span>
        <span>{data.workCenter.name}</span>
        <span>{new Date(data.occurredAt).toLocaleString('es-EC')}</span>
      </ContextSummary>
      {operation.isError ? <p role="alert">{errorMessage(operation.error)}</p> : null}
      {operation.isSuccess ? (
        <p role="status">Cambio guardado en la historia del incidente.</p>
      ) : null}

      <div className="workspace-two-pane">
        <WorkspaceMain>
          <WorkspaceSection eyebrow="Evento" title="Estado y personas involucradas">
            {data.activityContext ? (
              <p>
                <strong>Contexto:</strong> {data.activityContext}
              </p>
            ) : null}
            {canWrite && data.status === 'DRAFT' ? (
              <div className="workforce-inline-actions">
                <button
                  className="button"
                  disabled={operation.isPending}
                  onClick={() =>
                    run(`/incidents/${incidentId}/transition`, {
                      status: 'REPORTED',
                      expectedVersion: data.version,
                    })
                  }
                  type="button"
                >
                  Reportar incidente
                </button>
                <button
                  className="button secondary"
                  disabled={operation.isPending}
                  onClick={() =>
                    run(`/incidents/${incidentId}/transition`, {
                      status: 'CANCELLED',
                      expectedVersion: data.version,
                    })
                  }
                  type="button"
                >
                  Cancelar borrador
                </button>
              </div>
            ) : null}
            <div className="worker-list">
              {data.involvedWorkers.map((link) => (
                <article className="worker-row" key={link.id}>
                  <div>
                    <h3>{link.worker.displayName}</h3>
                    <p>{link.involvement ?? 'Participación sin detalle adicional.'}</p>
                  </div>
                  <Link href={`/app/workers/${link.worker.id}`}>Ver trabajador</Link>
                </article>
              ))}
            </div>
            {data.involvedWorkers.length === 0 ? <p>No se han vinculado trabajadores.</p> : null}
            {canWrite && mutable ? (
              <div className="workforce-form workforce-compact-form">
                <label className="field">
                  <span>Vincular trabajador</span>
                  <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
                    <option value="">Selecciona una persona</option>
                    {(workers.data?.items ?? []).map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Participación observada</span>
                  <input
                    value={workerInvolvement}
                    onChange={(event) => setWorkerInvolvement(event.target.value)}
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={!workerId || operation.isPending}
                  onClick={() =>
                    run(
                      `/incidents/${incidentId}/workers`,
                      {
                        workerId,
                        ...(workerInvolvement ? { involvement: workerInvolvement } : {}),
                      },
                      () => {
                        setWorkerId('');
                        setWorkerInvolvement('');
                      },
                    )
                  }
                  type="button"
                >
                  Vincular persona
                </button>
              </div>
            ) : null}
          </WorkspaceSection>

          <WorkspaceSection
            eyebrow="Investigación profesional"
            title="Factores identificados durante la investigación"
          >
            {!data.investigation && canWrite && data.status === 'REPORTED' ? (
              <button
                className="button"
                disabled={operation.isPending}
                onClick={() =>
                  run(`/incidents/${incidentId}/investigation/start`, {
                    expectedVersion: data.version,
                  })
                }
                type="button"
              >
                Iniciar investigación
              </button>
            ) : null}
            {data.investigation ? (
              <p>
                Iniciada por {data.investigation.startedBy.displayName}. Estado:{' '}
                {data.investigation.status === 'COMPLETED' ? 'completada' : 'en curso'}.
              </p>
            ) : (
              <p>La investigación se habilita cuando el evento ha sido reportado.</p>
            )}
            {data.investigation?.summary ? (
              <Card>
                <h3>Resumen profesional</h3>
                <p>{data.investigation.summary}</p>
              </Card>
            ) : null}
            <div className="worker-list">
              {data.contributingFactors.map((factor) => (
                <article className="worker-row" key={factor.id}>
                  <div>
                    <h3>{factor.category}</h3>
                    <p>{factor.description}</p>
                    {factor.rationale ? <small>{factor.rationale}</small> : null}
                  </div>
                </article>
              ))}
            </div>
            {canWrite && activeInvestigation ? (
              <form
                className="workforce-form workforce-compact-form"
                onSubmit={factorForm.handleSubmit((values) =>
                  run(
                    `/incidents/${incidentId}/factors`,
                    { ...values, ...(values.rationale ? {} : { rationale: undefined }) },
                    () => factorForm.reset(),
                  ),
                )}
              >
                <label className="field">
                  <span>Categoría neutral</span>
                  <select {...factorForm.register('category')}>
                    <option value="TASK">Tarea</option>
                    <option value="EQUIPMENT">Equipo</option>
                    <option value="ENVIRONMENT">Entorno</option>
                    <option value="ORGANIZATION">Organización</option>
                    <option value="PROCEDURE">Procedimiento</option>
                    <option value="TRAINING">Capacitación</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </label>
                <label className="field">
                  <span>Factor observado o supuesto</span>
                  <textarea
                    rows={2}
                    {...factorForm.register('description', { required: true, minLength: 3 })}
                  />
                </label>
                <label className="field">
                  <span>Evidencia o razonamiento (opcional)</span>
                  <textarea rows={2} {...factorForm.register('rationale')} />
                </label>
                <button className="button secondary" disabled={operation.isPending} type="submit">
                  Registrar factor
                </button>
              </form>
            ) : null}
            {canReview && activeInvestigation ? (
              <form
                className="workforce-form workforce-compact-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const summary = new FormData(event.currentTarget).get('summary');
                  if (typeof summary === 'string')
                    run(`/incidents/${incidentId}/investigation/complete`, {
                      summary,
                      expectedVersion: data.investigation!.version,
                    });
                }}
              >
                <label className="field">
                  <span>Resumen de investigación</span>
                  <textarea name="summary" rows={3} required minLength={3} />
                </label>
                <button className="button" disabled={operation.isPending} type="submit">
                  Completar investigación
                </button>
              </form>
            ) : null}
            {canWrite && activeInvestigation ? (
              <div className="workforce-form workforce-compact-form">
                <label className="field">
                  <span>Evidencia narrativa de investigación</span>
                  <textarea
                    rows={2}
                    value={investigationEvidence}
                    onChange={(event) => setInvestigationEvidence(event.target.value)}
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={!investigationEvidence.trim() || operation.isPending}
                  onClick={() =>
                    run(
                      `/incidents/${incidentId}/evidence`,
                      { scope: 'INVESTIGATION', type: 'NOTE', note: investigationEvidence },
                      () => setInvestigationEvidence(''),
                    )
                  }
                  type="button"
                >
                  Añadir evidencia
                </button>
              </div>
            ) : null}
          </WorkspaceSection>

          <WorkspaceSection eyebrow="Seguimiento" title="Acciones del incidente">
            <div className="worker-list">
              {data.actions.map((action) => (
                <article
                  className="incident-action-card"
                  id={`action-${action.id}`}
                  key={action.id}
                >
                  <div className="worker-row__title">
                    <h3>{action.title}</h3>
                    <span className="status-badge" data-status={action.status.toLowerCase()}>
                      {ACTION_LABELS[action.status]}
                    </span>
                  </div>
                  <p>{action.description ?? 'Sin descripción adicional.'}</p>
                  <small>
                    {action.priority} · {action.owner?.displayName ?? 'Sin responsable'}
                    {action.dueAt
                      ? ` · vence ${new Date(action.dueAt).toLocaleDateString('es-EC')}`
                      : ''}
                  </small>
                  {action.evidence.map((evidence) => (
                    <p key={evidence.id}>{evidence.note ?? evidence.externalUrl}</p>
                  ))}
                  {canWrite && ['OPEN', 'IN_PROGRESS'].includes(action.status) ? (
                    <div className="workforce-inline-actions">
                      {action.status === 'OPEN' ? (
                        <button
                          className="button secondary"
                          onClick={() =>
                            run(`/incidents/${incidentId}/actions/${action.id}/transition`, {
                              status: 'IN_PROGRESS',
                              expectedVersion: action.version,
                            })
                          }
                          type="button"
                        >
                          Iniciar
                        </button>
                      ) : null}
                      <button
                        className="button secondary"
                        onClick={() =>
                          run(`/incidents/${incidentId}/actions/${action.id}/transition`, {
                            status: 'PENDING_VERIFICATION',
                            expectedVersion: action.version,
                          })
                        }
                        type="button"
                      >
                        Enviar a verificación
                      </button>
                    </div>
                  ) : null}
                  {canWrite && action.status === 'PENDING_VERIFICATION' ? (
                    <div className="workforce-form workforce-compact-form">
                      <label className="field">
                        <span>Evidencia de ejecución</span>
                        <textarea
                          rows={2}
                          value={actionEvidence[action.id] ?? ''}
                          onChange={(event) =>
                            setActionEvidence((current) => ({
                              ...current,
                              [action.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        className="button secondary"
                        disabled={!actionEvidence[action.id]?.trim()}
                        onClick={() =>
                          run(
                            `/incidents/${incidentId}/evidence`,
                            {
                              scope: 'ACTION',
                              type: 'NOTE',
                              incidentActionId: action.id,
                              note: actionEvidence[action.id],
                            },
                            () => setActionEvidence((current) => ({ ...current, [action.id]: '' })),
                          )
                        }
                        type="button"
                      >
                        Añadir evidencia
                      </button>
                    </div>
                  ) : null}
                  {canReview && action.status === 'PENDING_VERIFICATION' ? (
                    <button
                      className="button"
                      disabled={operation.isPending}
                      onClick={() =>
                        run(`/incidents/${incidentId}/actions/${action.id}/verify`, {
                          expectedVersion: action.version,
                          note: 'Ejecución revisada por un rol autorizado.',
                        })
                      }
                      type="button"
                    >
                      Verificar acción
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
            {canWrite && ['UNDER_INVESTIGATION', 'ACTIONS_IN_PROGRESS'].includes(data.status) ? (
              <form
                className="workforce-form workforce-compact-form"
                onSubmit={actionForm.handleSubmit((values) =>
                  run(
                    `/incidents/${incidentId}/actions`,
                    {
                      ...values,
                      ownerUserId: values.ownerUserId,
                      ...(values.description ? {} : { description: undefined }),
                      ...(values.dueAt
                        ? { dueAt: new Date(values.dueAt).toISOString() }
                        : { dueAt: undefined }),
                    },
                    () =>
                      actionForm.reset({
                        title: '',
                        description: '',
                        priority: 'MEDIUM',
                        ownerUserId: auth.user?.id ?? '',
                        dueAt: '',
                      }),
                  ),
                )}
              >
                <label className="field">
                  <span>Acción</span>
                  <input {...actionForm.register('title', { required: true, minLength: 3 })} />
                </label>
                <label className="field">
                  <span>Descripción</span>
                  <textarea rows={2} {...actionForm.register('description')} />
                </label>
                <label className="field">
                  <span>Prioridad</span>
                  <select {...actionForm.register('priority')}>
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </label>
                <label className="field">
                  <span>Responsable</span>
                  <select {...actionForm.register('ownerUserId', { required: true })}>
                    <option value="">Selecciona una persona responsable</option>
                    {(members.data ?? [])
                      .filter((member) => member.status === 'ACTIVE')
                      .map((member) => (
                        <option key={member.id} value={member.user.id}>
                          {member.user.displayName} · {humanRoleLabel(member.role)}
                        </option>
                      ))}
                  </select>
                  <small>Solo se muestran miembros activos de la organización.</small>
                </label>
                <label className="field">
                  <span>Fecha objetivo</span>
                  <input type="datetime-local" {...actionForm.register('dueAt')} />
                </label>
                <button className="button" disabled={operation.isPending} type="submit">
                  Crear acción
                </button>
              </form>
            ) : null}
            {canReview && ['UNDER_INVESTIGATION', 'ACTIONS_IN_PROGRESS'].includes(data.status) ? (
              <button
                className="button"
                disabled={operation.isPending}
                onClick={() =>
                  run(`/incidents/${incidentId}/close`, {
                    status: 'CLOSED',
                    expectedVersion: data.version,
                  })
                }
                type="button"
              >
                Cerrar incidente
              </button>
            ) : null}
          </WorkspaceSection>
        </WorkspaceMain>

        <WorkspaceInspector label="Contexto del incidente">
          <section>
            <h2>Responsable del reporte</h2>
            <p>{data.reportedBy?.displayName ?? 'Sin detalle disponible'}</p>
          </section>
          <section>
            <h2>Evidencia de investigación</h2>
            {data.evidence.length ? (
              data.evidence.map((evidence) => (
                <p key={evidence.id}>{evidence.note ?? evidence.externalUrl}</p>
              ))
            ) : (
              <p>Sin evidencia añadida.</p>
            )}
          </section>
          <section>
            <h2>Relaciones</h2>
            <p>
              {data.linkedInspection
                ? `Inspección: ${data.linkedInspection.title}`
                : 'Sin inspección vinculada'}
            </p>
            <p>
              {data.linkedFinding
                ? `Hallazgo: ${data.linkedFinding.title}`
                : 'Sin hallazgo vinculado'}
            </p>
            <p>
              {data.linkedAssessment
                ? `Riesgo técnico: ${data.linkedAssessment.title}`
                : 'Sin evaluación técnica vinculada'}
            </p>
          </section>
          <section>
            <h2>Límite regulatorio</h2>
            <p>
              Este flujo no determina reportabilidad legal ni presenta trámites ante SUT o IESS.
            </p>
          </section>
        </WorkspaceInspector>
      </div>
    </WorkspaceShell>
  );
}
