'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { humanRiskLevelLabel } from '@/lib/human-lexicon';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import { useDashboardData } from './use-app-data';
import {
  ContextSummary,
  TechnicalDetailsDisclosure,
  WorkspaceHeader,
  WorkspaceInspector,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type Template = {
  id: string;
  version: string;
  disclaimer: string;
  permitTemplate: { name: string; description: string; isDemo: boolean };
};
type WorkCenter = { id: string; name: string; isActive: boolean };
type RiskAssessment = {
  id: string;
  title: string;
  status: string;
  workCenter: { id: string; name: string };
};
type Permit = {
  id: string;
  area: string;
  activity: string;
  plannedStartAt: string;
  plannedEndAt: string;
  status: string;
  version: number;
  hazards: string[];
  linkedRiskReferences: Array<{
    assessmentId: string;
    title: string;
    methodName: string;
    level: string | null;
  }>;
  controls: string[];
  preconditions: string[];
  evidenceReferences: string[];
  approvalComment?: string;
  approvedAt?: string;
  closureNote?: string;
  closedAt?: string;
  workCenter: { id: string; name: string };
  requester: { id: string; displayName: string };
  approver?: { id: string; displayName: string };
  closedBy?: { id: string; displayName: string };
  permitTemplateVersion: {
    version: string;
    disclaimer: string;
    permitTemplate: { name: string; isDemo: boolean };
  };
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  AUTHORIZED: 'Autorizado',
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
};

function requestError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 403) return 'Tu rol o el plan activo no permiten esta operación.';
    if (error.status === 409) return 'El permiso cambió en otra sesión. Actualiza la página.';
  }
  return 'No pudimos completar la operación.';
}

function PermitAccess({ children }: { children: React.ReactNode }) {
  const dashboard = useDashboardData();
  if (dashboard.isLoading) return <p role="status">Comprobando acceso a permisos…</p>;
  if (dashboard.data?.entitlements.features['module.work_permits'] !== true)
    return (
      <Card>
        <h1>Permisos de trabajo no está disponible</h1>
        <p>El plan de la organización activa no incluye esta superficie.</p>
        <Link href="/app/modules">Ver módulos y plan →</Link>
      </Card>
    );
  return children;
}

export function WorkPermitList() {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId;
  const permits = useQuery({
    queryKey: queryKeys.organization.workPermits(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<{ items: Permit[]; total: number }>(
        '/work-permits?pageSize=50',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  return (
    <PermitAccess>
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Operación"
          title="Permisos de trabajo"
          description="Autoriza y controla actividades internas con separación entre solicitud, aprobación, ejecución y cierre."
          actions={
            <Link className="button" href="/app/work-permits/new">
              Nuevo permiso
            </Link>
          }
        />
        {permits.isLoading ? <p role="status">Cargando permisos…</p> : null}
        {permits.isError ? (
          <Card role="alert">
            <h2>No pudimos cargar los permisos</h2>
            <p>Reintenta en unos momentos.</p>
          </Card>
        ) : null}
        {permits.data?.items.length ? (
          <div className="queue-list">
            {permits.data.items.map((permit) => (
              <article className="queue-row" key={permit.id}>
                <div>
                  <div className="command-item-meta">
                    <span>{statusLabels[permit.status]}</span>
                    <span>{permit.workCenter.name}</span>
                  </div>
                  <h2>{permit.activity}</h2>
                  <p>{permit.area}</p>
                  <small>
                    {new Date(permit.plannedStartAt).toLocaleString('es-EC')} –{' '}
                    {new Date(permit.plannedEndAt).toLocaleString('es-EC')}
                  </small>
                </div>
                <Link className="button secondary" href={`/app/work-permits/${permit.id}`}>
                  Abrir
                </Link>
              </article>
            ))}
          </div>
        ) : permits.isSuccess ? (
          <Card>
            <h2>Aún no hay permisos registrados</h2>
            <p>
              Crea un permiso interno para una actividad planificada que necesite controles
              explícitos.
            </p>
          </Card>
        ) : null}
      </WorkspaceShell>
    </PermitAccess>
  );
}

type PermitForm = {
  permitTemplateVersionId: string;
  workCenterId: string;
  area: string;
  activity: string;
  plannedStartAt: string;
  plannedEndAt: string;
  hazards: string;
  controls: string;
  preconditions: string;
  evidenceReferences: string;
  linkedRiskAssessmentIds: string[];
};
const lines = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

export function NewWorkPermit() {
  const auth = useAuth();
  const organization = useOrganization();
  const router = useRouter();
  const organizationId = organization.activeId;
  const form = useForm<PermitForm>({
    defaultValues: {
      permitTemplateVersionId: '',
      workCenterId: '',
      area: '',
      activity: '',
      plannedStartAt: '',
      plannedEndAt: '',
      hazards: '',
      controls: '',
      preconditions: '',
      evidenceReferences: '',
      linkedRiskAssessmentIds: [],
    },
  });
  const templates = useQuery({
    queryKey: queryKeys.organization.workPermitTemplates(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Template[]>('/work-permits/templates', { signal }, organizationId!),
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
  const risks = useQuery({
    queryKey: queryKeys.organization.technicalRiskAssessments(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<{ items: RiskAssessment[] }>(
        '/technical-risk/assessments',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const create = useMutation({
    mutationFn: (values: PermitForm) =>
      auth.request<Permit>(
        '/work-permits',
        {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            plannedStartAt: new Date(values.plannedStartAt).toISOString(),
            plannedEndAt: new Date(values.plannedEndAt).toISOString(),
            hazards: lines(values.hazards),
            controls: lines(values.controls),
            preconditions: lines(values.preconditions),
            evidenceReferences: lines(values.evidenceReferences),
          }),
        },
        organizationId!,
      ),
    onSuccess: (permit) => router.push(`/app/work-permits/${permit.id}`),
  });
  return (
    <PermitAccess>
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Permisos de trabajo"
          title="Nuevo permiso interno"
          description="La plantilla es demostrativa y no sustituye requisitos legales ni una evaluación profesional de seguridad."
        />
        <form
          className="obligation-form"
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          noValidate
        >
          <label>
            Plantilla
            <select {...form.register('permitTemplateVersionId', { required: true })}>
              <option value="">Seleccionar</option>
              {templates.data?.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.permitTemplate.name} · {item.version}
                </option>
              ))}
            </select>
          </label>
          {templates.data?.[0] ? (
            <p className="candidate-notice">{templates.data[0].disclaimer}</p>
          ) : null}
          <div className="obligation-form-grid">
            <label>
              Centro de trabajo
              <select {...form.register('workCenterId', { required: true })}>
                <option value="">Seleccionar</option>
                {centers.data
                  ?.filter((item) => item.isActive)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Área
              <input {...form.register('area', { required: true, minLength: 2 })} />
            </label>
          </div>
          <label>
            Actividad
            <textarea rows={3} {...form.register('activity', { required: true, minLength: 3 })} />
          </label>
          <div className="obligation-form-grid">
            <label>
              Inicio planificado
              <input
                type="datetime-local"
                {...form.register('plannedStartAt', { required: true })}
              />
            </label>
            <label>
              Fin planificado
              <input type="datetime-local" {...form.register('plannedEndAt', { required: true })} />
            </label>
          </div>
          <label>
            Peligros identificados
            <textarea
              rows={4}
              placeholder="Uno por línea"
              {...form.register('hazards', { required: true })}
            />
          </label>
          <label>
            Controles
            <textarea
              rows={4}
              placeholder="Uno por línea"
              {...form.register('controls', { required: true })}
            />
          </label>
          <label>
            Precondiciones
            <textarea
              rows={4}
              placeholder="Una por línea"
              {...form.register('preconditions', { required: true })}
            />
          </label>
          <label>
            Evaluaciones de riesgo vinculadas
            <div className="permit-risk-options">
              {risks.data?.items.map((risk) => (
                <label key={risk.id}>
                  <input
                    type="checkbox"
                    value={risk.id}
                    {...form.register('linkedRiskAssessmentIds')}
                  />{' '}
                  {risk.title} · {risk.workCenter.name}
                </label>
              )) ?? <span className="muted">No hay evaluaciones disponibles.</span>}
            </div>
          </label>
          <label>
            Referencias de evidencia
            <textarea
              rows={3}
              placeholder="Una referencia o enlace por línea"
              {...form.register('evidenceReferences')}
            />
          </label>
          {create.isError ? (
            <p className="field-error" role="alert">
              {requestError(create.error)}
            </p>
          ) : null}
          <div className="obligation-actions">
            <Link className="button secondary" href="/app/work-permits">
              Cancelar
            </Link>
            <button className="button" type="submit" disabled={create.isPending}>
              {create.isPending ? 'Guardando…' : 'Crear borrador'}
            </button>
          </div>
        </form>
      </WorkspaceShell>
    </PermitAccess>
  );
}

export function WorkPermitDetail({ permitId }: { permitId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const closureForm = useForm<{ closureNote: string }>({ defaultValues: { closureNote: '' } });
  const organizationId = organization.activeId;
  const permit = useQuery({
    queryKey: queryKeys.organization.workPermit(organizationId ?? 'inactive', permitId),
    queryFn: ({ signal }) =>
      auth.request<Permit>(`/work-permits/${permitId}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workPermit(organizationId!, permitId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workPermits(organizationId!),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workQueueRoot(organizationId!),
      }),
    ]);
  };
  const transition = useMutation({
    mutationFn: ({ status, closureNote }: { status: string; closureNote?: string }) =>
      auth.request(
        `/work-permits/${permitId}/transition`,
        {
          method: 'POST',
          body: JSON.stringify({ status, closureNote, expectedVersion: permit.data!.version }),
        },
        organizationId!,
      ),
    onSuccess: refresh,
  });
  const approve = useMutation({
    mutationFn: () =>
      auth.request(
        `/work-permits/${permitId}/approve`,
        { method: 'POST', body: JSON.stringify({ expectedVersion: permit.data!.version }) },
        organizationId!,
      ),
    onSuccess: refresh,
  });
  if (permit.isLoading) return <p role="status">Cargando permiso…</p>;
  if (permit.isError || !permit.data)
    return (
      <Card role="alert">
        <h1>No encontramos el permiso</h1>
        <Link href="/app/work-permits">Volver</Link>
      </Card>
    );
  const data = permit.data;
  const mutationError = transition.error ?? approve.error;
  return (
    <PermitAccess>
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Permiso de trabajo"
          title={data.activity}
          description={`Actividad planificada en ${data.area}.`}
          context={
            <ContextSummary>
              <span>{data.workCenter.name}</span>
              <span>{statusLabels[data.status]}</span>
              <span>Solicita: {data.requester.displayName}</span>
            </ContextSummary>
          }
          actions={
            <Link className="button secondary" href="/app/work-permits">
              Volver
            </Link>
          }
        />
        {mutationError ? (
          <p className="field-error" role="alert">
            {requestError(mutationError)}
          </p>
        ) : null}
        <div className="workspace-two-pane">
          <WorkspaceMain>
            <WorkspaceSection
              title="Control del permiso"
              description="La API valida cada transición, el rol y la versión vigente."
            >
              <div className="obligation-actions">
                {data.status === 'DRAFT' ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => transition.mutate({ status: 'PENDING_APPROVAL' })}
                  >
                    Enviar a aprobación
                  </button>
                ) : null}
                {data.status === 'PENDING_APPROVAL' && data.requester.id !== auth.user?.id ? (
                  <button className="button" type="button" onClick={() => approve.mutate()}>
                    Autorizar
                  </button>
                ) : null}
                {data.status === 'PENDING_APPROVAL' && data.requester.id === auth.user?.id ? (
                  <p className="muted">
                    La persona solicitante no puede autorizar su propio permiso.
                  </p>
                ) : null}
                {data.status === 'AUTHORIZED' ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => transition.mutate({ status: 'ACTIVE' })}
                  >
                    Iniciar actividad
                  </button>
                ) : null}
                {data.status === 'ACTIVE' ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => transition.mutate({ status: 'SUSPENDED' })}
                  >
                    Suspender
                  </button>
                ) : null}
                {data.status === 'SUSPENDED' ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => transition.mutate({ status: 'ACTIVE' })}
                  >
                    Reanudar
                  </button>
                ) : null}
              </div>
              {['ACTIVE', 'SUSPENDED'].includes(data.status) ? (
                <form
                  className="evidence-form"
                  onSubmit={closureForm.handleSubmit(({ closureNote }) =>
                    transition.mutate({ status: 'CLOSED', closureNote }),
                  )}
                >
                  <label>
                    Nota de cierre
                    <textarea
                      rows={3}
                      {...closureForm.register('closureNote', {
                        required: 'Documenta el cierre.',
                        minLength: 3,
                      })}
                    />
                  </label>
                  {closureForm.formState.errors.closureNote ? (
                    <span className="field-error">
                      {closureForm.formState.errors.closureNote.message}
                    </span>
                  ) : null}
                  <button className="button secondary" type="submit">
                    Cerrar permiso
                  </button>
                </form>
              ) : null}
            </WorkspaceSection>
            <WorkspaceSection title="Peligros y controles">
              <div className="permit-columns">
                <section>
                  <h3>Peligros</h3>
                  <ul>
                    {data.hazards.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Controles</h3>
                  <ul>
                    {data.controls.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Precondiciones</h3>
                  <ul>
                    {data.preconditions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </WorkspaceSection>
            <WorkspaceSection title="Riesgos vinculados">
              {data.linkedRiskReferences.length ? (
                data.linkedRiskReferences.map((risk) => (
                  <Card key={risk.assessmentId}>
                    <h3>{risk.title}</h3>
                    <p>
                      {risk.methodName}
                      {risk.level ? ` · nivel ${humanRiskLevelLabel(risk.level)}` : ''}
                    </p>
                    <Link href={`/app/technical-risk/${risk.assessmentId}`}>
                      Abrir evaluación →
                    </Link>
                  </Card>
                ))
              ) : (
                <p className="muted">Sin evaluaciones de riesgo vinculadas.</p>
              )}
            </WorkspaceSection>
          </WorkspaceMain>
          <WorkspaceInspector label="Aprobación y trazabilidad">
            <section>
              <h2>Planificación</h2>
              <p>
                {new Date(data.plannedStartAt).toLocaleString('es-EC')} –{' '}
                {new Date(data.plannedEndAt).toLocaleString('es-EC')}
              </p>
            </section>
            <section>
              <h2>Aprobación</h2>
              <p>
                {data.approver
                  ? `${data.approver.displayName} · ${data.approvedAt ? new Date(data.approvedAt).toLocaleString('es-EC') : ''}`
                  : 'Pendiente'}
              </p>
            </section>
            <section>
              <h2>Cierre</h2>
              <p>{data.closureNote ?? 'Pendiente'}</p>
            </section>
            <TechnicalDetailsDisclosure summary="Ver plantilla">
              <p>
                {data.permitTemplateVersion.permitTemplate.name} · versión{' '}
                {data.permitTemplateVersion.version}
              </p>
              <p>{data.permitTemplateVersion.disclaimer}</p>
            </TechnicalDetailsDisclosure>
          </WorkspaceInspector>
        </div>
      </WorkspaceShell>
    </PermitAccess>
  );
}
