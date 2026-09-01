'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import { WorkerPpePanel } from './ppe-ui';
import { WorkerTrainingPanel } from './training-ui';
import {
  ContextSummary,
  WorkspaceHeader,
  WorkspaceInspector,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

export type Worker = {
  id: string;
  displayName: string;
  internalCode?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  jobTitle?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  version: number;
  workCenter?: { id: string; name: string } | null;
  linkedUser?: { id: string; displayName: string; email: string } | null;
  createdBy: { id: string; displayName: string };
};

type WorkerListResponse = { items: Worker[]; total: number };
type WorkCenter = { id: string; name: string; isActive: boolean };
type Member = {
  status: string;
  user: { id: string; displayName: string; email: string };
};
type WorkerForm = {
  displayName: string;
  internalCode: string;
  workCenterId: string;
  jobTitle: string;
  linkedUserId: string;
  startDate: string;
  notes: string;
};

const ADMIN_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.payload.message
    : 'No pudimos completar la operación. Intenta nuevamente.';
}

function WorkerStatus({ status }: { status: Worker['status'] }) {
  return (
    <span className="status-badge" data-status={status.toLowerCase()}>
      {status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

export function WorkerRegistry() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canAdminister = ADMIN_ROLES.has(organization.currentRole ?? '');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [workCenterId, setWorkCenterId] = useState('');
  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (workCenterId) params.set('workCenterId', workCenterId);
    return params.toString();
  }, [search, status, workCenterId]);
  const workers = useQuery({
    queryKey: queryKeys.organization.workers(organizationId ?? 'inactive', filters),
    queryFn: ({ signal }) =>
      auth.request<WorkerListResponse>(`/workers?${filters}`, { signal }, organizationId!),
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
  const members = useQuery({
    queryKey: queryKeys.organization.members(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Member[]>(
        `/organizations/${organizationId}/members`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canAdminister),
  });
  const form = useForm<WorkerForm>({
    defaultValues: {
      displayName: '',
      internalCode: '',
      workCenterId: '',
      jobTitle: '',
      linkedUserId: '',
      startDate: '',
      notes: '',
    },
  });
  const createWorker = useMutation({
    mutationFn: (values: WorkerForm) =>
      auth.request<Worker>(
        '/workers',
        {
          method: 'POST',
          body: JSON.stringify({
            displayName: values.displayName,
            ...(values.internalCode ? { internalCode: values.internalCode } : {}),
            ...(values.workCenterId ? { workCenterId: values.workCenterId } : {}),
            ...(values.jobTitle ? { jobTitle: values.jobTitle } : {}),
            ...(values.linkedUserId ? { linkedUserId: values.linkedUserId } : {}),
            ...(values.startDate ? { startDate: values.startDate } : {}),
            ...(values.notes ? { notes: values.notes } : {}),
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });

  if (!organizationId)
    return (
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Personas"
          title="Selecciona una organización"
          description="El registro de trabajadores siempre pertenece a una organización activa."
        />
      </WorkspaceShell>
    );

  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceHeader
        eyebrow="Operación · Personas"
        title="Trabajadores"
        description="Gestiona la identidad operativa SST sin crear cuentas ni consumir asientos de acceso."
      />
      <ContextSummary>
        <span>{workers.data?.total ?? 0} trabajadores registrados</span>
        <span>Las cuentas de acceso se administran por separado en Equipo</span>
      </ContextSummary>

      {canAdminister ? (
        <WorkspaceSection
          eyebrow="Registro"
          title="Nueva persona trabajadora"
          description="Solicita solo la información necesaria para la operación SST."
        >
          <form
            className="workforce-form"
            onSubmit={form.handleSubmit((values) => createWorker.mutate(values))}
          >
            <label className="field">
              <span>Nombre para la operación</span>
              <input
                {...form.register('displayName', { required: true, minLength: 2 })}
                autoComplete="name"
              />
            </label>
            <label className="field">
              <span>Código interno (opcional)</span>
              <input {...form.register('internalCode')} />
            </label>
            <label className="field">
              <span>Centro de trabajo asignado</span>
              <select {...form.register('workCenterId')}>
                <option value="">Sin asignar</option>
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
              <span>Cargo o función</span>
              <input {...form.register('jobTitle')} />
            </label>
            <label className="field">
              <span>Cuenta vinculada (opcional)</span>
              <select {...form.register('linkedUserId')}>
                <option value="">Sin cuenta vinculada</option>
                {(members.data ?? [])
                  .filter((member) => member.status === 'ACTIVE')
                  .map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.displayName} · {member.user.email}
                    </option>
                  ))}
              </select>
              <small>Vincular una cuenta no concede permisos ni reemplaza la membresía.</small>
            </label>
            <label className="field">
              <span>Fecha de inicio</span>
              <input type="date" {...form.register('startDate')} />
            </label>
            <label className="field workforce-form__wide">
              <span>Nota operativa (opcional)</span>
              <textarea rows={3} {...form.register('notes')} />
            </label>
            <div className="workforce-form__actions">
              <button className="button" disabled={createWorker.isPending} type="submit">
                {createWorker.isPending ? 'Registrando…' : 'Registrar trabajador'}
              </button>
              {createWorker.isError ? <p role="alert">{errorMessage(createWorker.error)}</p> : null}
              {createWorker.isSuccess ? (
                <p role="status">Trabajador registrado sin crear un asiento de acceso.</p>
              ) : null}
            </div>
          </form>
        </WorkspaceSection>
      ) : null}

      <WorkspaceSection
        eyebrow="Directorio"
        title="Personas registradas"
        description="Busca por nombre, código o función y filtra por asignación actual."
      >
        <div className="workforce-filters" role="search">
          <label className="field">
            <span>Buscar</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="field">
            <span>Estado</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </label>
          <label className="field">
            <span>Filtrar por centro de trabajo</span>
            <select value={workCenterId} onChange={(event) => setWorkCenterId(event.target.value)}>
              <option value="">Todos</option>
              {(centers.data ?? []).map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {workers.isLoading ? <p role="status">Cargando trabajadores…</p> : null}
        {workers.isError ? (
          <Card role="alert">
            <p>No pudimos cargar el registro.</p>
            <button
              className="button secondary"
              onClick={() => void workers.refetch()}
              type="button"
            >
              Reintentar
            </button>
          </Card>
        ) : null}
        {!workers.isLoading && workers.data?.items.length === 0 ? (
          <Card>
            <h3>No hay trabajadores para estos filtros</h3>
            <p>Ajusta la búsqueda o registra la primera persona trabajadora.</p>
          </Card>
        ) : null}
        <div className="worker-list">
          {(workers.data?.items ?? []).map((worker) => (
            <article className="worker-row" key={worker.id}>
              <div>
                <div className="worker-row__title">
                  <h3>{worker.displayName}</h3>
                  <WorkerStatus status={worker.status} />
                </div>
                <p>{worker.jobTitle ?? 'Función no registrada'}</p>
                <small>{worker.workCenter?.name ?? 'Sin centro de trabajo asignado'}</small>
              </div>
              <Link className="button secondary" href={`/app/workers/${worker.id}`}>
                Abrir espacio de trabajo
              </Link>
            </article>
          ))}
        </div>
      </WorkspaceSection>
    </WorkspaceShell>
  );
}

export function WorkerWorkspace({ workerId }: { workerId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canAdminister = ADMIN_ROLES.has(organization.currentRole ?? '');
  const worker = useQuery({
    queryKey: queryKeys.organization.worker(organizationId ?? 'inactive', workerId),
    queryFn: ({ signal }) =>
      auth.request<Worker>(`/workers/${workerId}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const deactivate = useMutation({
    mutationFn: (version: number) =>
      auth.request<Worker>(
        `/workers/${workerId}/deactivate`,
        { method: 'POST', body: JSON.stringify({ expectedVersion: version }) },
        organizationId!,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });

  if (worker.isLoading)
    return (
      <WorkspaceShell>
        <p role="status">Cargando espacio de trabajo…</p>
      </WorkspaceShell>
    );
  if (worker.isError || !worker.data)
    return (
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Personas"
          title="No pudimos abrir este trabajador"
          description="Confirma la organización activa o vuelve al registro."
          actions={<Link href="/app/workers">Volver a trabajadores</Link>}
        />
      </WorkspaceShell>
    );

  const data = worker.data;
  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceHeader
        eyebrow="Personas · Espacio de trabajo"
        title={data.displayName}
        description="Contexto operativo SST de esta persona, independiente de sus permisos de acceso al SaaS."
        context={<WorkerStatus status={data.status} />}
        actions={
          <>
            <Link className="button secondary" href="/app/workers">
              Volver al registro
            </Link>
            {canAdminister && data.status === 'ACTIVE' ? (
              <button
                className="button secondary"
                disabled={deactivate.isPending}
                onClick={() => deactivate.mutate(data.version)}
                type="button"
              >
                {deactivate.isPending ? 'Desactivando…' : 'Desactivar trabajador'}
              </button>
            ) : null}
          </>
        }
      />
      {deactivate.isError ? <p role="alert">{errorMessage(deactivate.error)}</p> : null}
      {deactivate.isSuccess ? (
        <p role="status">Trabajador desactivado; su historia permanece.</p>
      ) : null}
      <ContextSummary>
        <span>{data.workCenter?.name ?? 'Sin centro de trabajo'}</span>
        <span>{data.jobTitle ?? 'Sin cargo registrado'}</span>
        <span>{data.linkedUser ? 'Cuenta vinculada' : 'No requiere cuenta de acceso'}</span>
      </ContextSummary>
      <div className="workspace-two-pane">
        <WorkspaceMain>
          <WorkspaceSection title="Resumen" eyebrow="Identidad operativa">
            <dl className="worker-summary">
              <div>
                <dt>Centro de trabajo</dt>
                <dd>{data.workCenter?.name ?? 'Sin asignar'}</dd>
              </div>
              <div>
                <dt>Cargo o función</dt>
                <dd>{data.jobTitle ?? 'Sin registrar'}</dd>
              </div>
              <div>
                <dt>Inicio</dt>
                <dd>
                  {data.startDate
                    ? new Date(data.startDate).toLocaleDateString('es-EC')
                    : 'Sin registrar'}
                </dd>
              </div>
              <div>
                <dt>Fin</dt>
                <dd>
                  {data.endDate ? new Date(data.endDate).toLocaleDateString('es-EC') : 'No aplica'}
                </dd>
              </div>
            </dl>
            {data.notes ? <p>{data.notes}</p> : null}
          </WorkspaceSection>
          <WorkspaceSection title="Incidentes" eyebrow="Historia SST">
            <p>
              Los eventos vinculados aparecerán aquí sin convertir este espacio en un registro
              médico.
            </p>
          </WorkspaceSection>
          <WorkerPpePanel workerId={data.id} workerStatus={data.status} />
          <WorkerTrainingPanel workerId={data.id} workerStatus={data.status} />
        </WorkspaceMain>
        <WorkspaceInspector label="Contexto del trabajador">
          <section>
            <h2>Cuenta de acceso</h2>
            <p>
              {data.linkedUser
                ? `${data.linkedUser.displayName} · vínculo informativo`
                : 'Esta persona no necesita una cuenta para participar en flujos SST.'}
            </p>
          </section>
          <section>
            <h2>Historia</h2>
            <p>Registrado por {data.createdBy.displayName}.</p>
            <p>La desactivación no elimina incidentes, EPP ni capacitación.</p>
          </section>
        </WorkspaceInspector>
      </div>
    </WorkspaceShell>
  );
}
