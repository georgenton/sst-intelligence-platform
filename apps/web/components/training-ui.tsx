'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextSummary,
  WorkspaceHeader,
  WorkspaceInspector,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type TrainingDefinition = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  validityDays?: number | null;
  isActive: boolean;
};
type DefinitionResponse = { items: TrainingDefinition[]; total: number };
type TrainingSessionStatus = 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
type TrainingMode = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
type TrainingSessionSummary = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: TrainingSessionStatus;
  mode: TrainingMode;
  instructorName?: string | null;
  location?: string | null;
  version: number;
  trainingDefinition: Pick<TrainingDefinition, 'id' | 'title' | 'validityDays'>;
  workCenter?: { id: string; name: string } | null;
  _count: { participants: number; completions: number };
};
type SessionResponse = { items: TrainingSessionSummary[]; total: number };
type Participant = {
  id: string;
  attendance?: 'PRESENT' | 'ABSENT' | 'PARTIAL' | null;
  attendanceRecordedAt?: string | null;
  attendanceEvidenceNote?: string | null;
  version: number;
  worker: {
    id: string;
    displayName: string;
    status: 'ACTIVE' | 'INACTIVE';
    internalCode?: string | null;
    jobTitle?: string | null;
    trainingRequirements: Array<{
      id: string;
      trainingDefinitionId: string;
      reason: string;
      status: 'REQUIRED' | 'FULFILLED';
    }>;
  };
  completion?: {
    id: string;
    completedAt: string;
    validUntil?: string | null;
    completionNote?: string | null;
    certificateReference?: string | null;
    renewsCompletionId?: string | null;
  } | null;
};
type TrainingSession = Omit<TrainingSessionSummary, '_count'> & {
  participants: Participant[];
  createdBy: { id: string; displayName: string };
};
type Worker = {
  id: string;
  displayName: string;
  status: 'ACTIVE' | 'INACTIVE';
  jobTitle?: string | null;
};
type WorkerResponse = { items: Worker[]; total: number };
type WorkerTrainingWorkspace = {
  worker: Pick<Worker, 'id' | 'displayName' | 'status'>;
  requirements: Array<{
    id: string;
    reason: string;
    requiredByDate?: string | null;
    renewalRequired: boolean;
    status: 'REQUIRED' | 'FULFILLED' | 'CANCELLED';
    competencyStatus: 'CURRENT' | 'DUE_SOON' | 'EXPIRED' | 'NOT_COMPLETED';
    trainingDefinition: TrainingDefinition;
    linkedAssessment?: { id: string; title: string } | null;
    regulatoryContext?: {
      id: string;
      title: string;
      editorialStatus: string;
      candidate: boolean;
    } | null;
  }>;
  completions: Array<{
    id: string;
    completedAt: string;
    validUntil?: string | null;
    completionNote?: string | null;
    certificateReference?: string | null;
    renewsCompletionId?: string | null;
    competencyStatus: 'CURRENT' | 'DUE_SOON' | 'EXPIRED' | 'HISTORICAL';
    trainingDefinition: Pick<TrainingDefinition, 'id' | 'title' | 'category'>;
    session: { id: string; scheduledStart: string; mode: TrainingMode };
  }>;
};
type WorkCenter = { id: string; name: string; isActive: boolean };
type DefinitionForm = {
  title: string;
  description: string;
  category: string;
  validityDays: string;
};
type SessionForm = {
  trainingDefinitionId: string;
  workCenterId: string;
  scheduledStart: string;
  scheduledEnd: string;
  mode: TrainingMode;
  instructorName: string;
  location: string;
};
type RequirementForm = {
  trainingDefinitionId: string;
  reason: string;
  requiredByDate: string;
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
const SESSION_LABELS: Record<TrainingSessionStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};
const MODE_LABELS: Record<TrainingMode, string> = {
  IN_PERSON: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrida',
};
const ATTENDANCE_LABELS: Record<NonNullable<Participant['attendance']>, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  PARTIAL: 'Asistencia parcial',
};
const COMPETENCY_LABELS: Record<string, string> = {
  CURRENT: 'Vigente',
  DUE_SOON: 'Próxima a vencer',
  EXPIRED: 'Vencida',
  NOT_COMPLETED: 'No completada',
  HISTORICAL: 'Histórica',
};

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.payload.message
    : 'No pudimos completar la operación. Intenta nuevamente.';
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return 'Sin fecha';
  return withTime
    ? new Date(value).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date(value).toLocaleDateString('es-EC', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      });
}

export function TrainingCatalog() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const canReview = REVIEW_ROLES.has(organization.currentRole ?? '');
  const definitions = useQuery({
    queryKey: queryKeys.organization.trainingDefinitions(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<DefinitionResponse>(
        '/training/definitions?pageSize=100',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const sessions = useQuery({
    queryKey: queryKeys.organization.trainingSessions(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<SessionResponse>('/training/sessions?pageSize=100', { signal }, organizationId!),
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
    enabled: Boolean(organizationId && canWrite),
  });
  const definitionForm = useForm<DefinitionForm>({
    defaultValues: { title: '', description: '', category: '', validityDays: '' },
  });
  const sessionForm = useForm<SessionForm>({
    defaultValues: {
      trainingDefinitionId: '',
      workCenterId: '',
      scheduledStart: '',
      scheduledEnd: '',
      mode: 'IN_PERSON',
      instructorName: '',
      location: '',
    },
  });
  const createDefinition = useMutation({
    mutationFn: (values: DefinitionForm) =>
      auth.request(
        '/training/definitions',
        {
          method: 'POST',
          body: JSON.stringify({
            title: values.title,
            description: values.description || undefined,
            category: values.category,
            validityDays: values.validityDays ? Number(values.validityDays) : undefined,
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      definitionForm.reset();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });
  const createSession = useMutation({
    mutationFn: (values: SessionForm) =>
      auth.request(
        '/training/sessions',
        {
          method: 'POST',
          body: JSON.stringify({
            trainingDefinitionId: values.trainingDefinitionId,
            workCenterId: values.workCenterId || undefined,
            scheduledStart: new Date(values.scheduledStart).toISOString(),
            scheduledEnd: new Date(values.scheduledEnd).toISOString(),
            mode: values.mode,
            instructorName: values.instructorName || undefined,
            location: values.location || undefined,
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      sessionForm.reset();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });

  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceHeader
        eyebrow="Operación · Competencia"
        title="Capacitación"
        description="Define necesidades internas, programa sesiones y conserva asistencia, completitud, vigencia y renovación sin convertir el producto en un LMS."
      />
      <ContextSummary>
        <span>{definitions.data?.total ?? 0} definiciones internas</span>
        <span>{sessions.data?.total ?? 0} sesiones registradas</span>
        <span>Sin puntajes ni certificación legal automática</span>
      </ContextSummary>

      {canReview ? (
        <WorkspaceSection eyebrow="Catálogo interno" title="Nueva definición de capacitación">
          <form
            className="workforce-form"
            onSubmit={definitionForm.handleSubmit((values) => createDefinition.mutate(values))}
          >
            <label className="field">
              <span>Título</span>
              <input {...definitionForm.register('title', { required: true, minLength: 3 })} />
            </label>
            <label className="field">
              <span>Categoría interna</span>
              <input {...definitionForm.register('category', { required: true, minLength: 2 })} />
            </label>
            <label className="field workforce-form__wide">
              <span>Descripción</span>
              <textarea rows={3} {...definitionForm.register('description')} />
            </label>
            <label className="field">
              <span>Vigencia operativa (días)</span>
              <input min="1" type="number" {...definitionForm.register('validityDays')} />
            </label>
            <div className="workforce-form__actions">
              <button className="button" disabled={createDefinition.isPending} type="submit">
                {createDefinition.isPending ? 'Guardando…' : 'Crear definición'}
              </button>
              {createDefinition.isError ? (
                <p role="alert">{errorMessage(createDefinition.error)}</p>
              ) : null}
              {createDefinition.isSuccess ? <p role="status">Definición interna creada.</p> : null}
            </div>
          </form>
        </WorkspaceSection>
      ) : null}

      {canWrite ? (
        <WorkspaceSection eyebrow="Planificación" title="Nueva sesión">
          <form
            className="workforce-form"
            onSubmit={sessionForm.handleSubmit((values) => createSession.mutate(values))}
          >
            <label className="field">
              <span>Capacitación</span>
              <select {...sessionForm.register('trainingDefinitionId', { required: true })}>
                <option value="">Selecciona una definición</option>
                {(definitions.data?.items ?? [])
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Centro de trabajo</span>
              <select {...sessionForm.register('workCenterId')}>
                <option value="">Sin centro específico</option>
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
              <span>Inicio</span>
              <input
                type="datetime-local"
                {...sessionForm.register('scheduledStart', { required: true })}
              />
            </label>
            <label className="field">
              <span>Fin</span>
              <input
                type="datetime-local"
                {...sessionForm.register('scheduledEnd', { required: true })}
              />
            </label>
            <label className="field">
              <span>Modalidad</span>
              <select {...sessionForm.register('mode')}>
                {Object.entries(MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Responsable o facilitador</span>
              <input {...sessionForm.register('instructorName')} />
            </label>
            <label className="field">
              <span>Lugar o enlace de referencia</span>
              <input {...sessionForm.register('location')} />
            </label>
            <div className="workforce-form__actions">
              <button className="button" disabled={createSession.isPending} type="submit">
                {createSession.isPending ? 'Creando…' : 'Crear sesión en borrador'}
              </button>
              {createSession.isError ? (
                <p role="alert">{errorMessage(createSession.error)}</p>
              ) : null}
              {createSession.isSuccess ? <p role="status">Sesión creada.</p> : null}
            </div>
          </form>
        </WorkspaceSection>
      ) : null}

      <WorkspaceSection eyebrow="Seguimiento" title="Sesiones registradas">
        {sessions.isLoading ? <p role="status">Cargando sesiones…</p> : null}
        {sessions.isError ? <p role="alert">{errorMessage(sessions.error)}</p> : null}
        <div className="worker-list">
          {(sessions.data?.items ?? []).map((session) => (
            <article className="worker-row" key={session.id}>
              <div>
                <div className="worker-row__title">
                  <h3>{session.trainingDefinition.title}</h3>
                  <span className="status-badge" data-status={session.status.toLowerCase()}>
                    {SESSION_LABELS[session.status]}
                  </span>
                </div>
                <p>
                  {formatDate(session.scheduledStart, true)} · {MODE_LABELS[session.mode]}
                </p>
                <small>
                  {session.workCenter?.name ?? 'Sin centro específico'} ·{' '}
                  {session._count.participants} participante(s)
                </small>
              </div>
              <Link className="button secondary" href={`/app/training/sessions/${session.id}`}>
                Abrir sesión
              </Link>
            </article>
          ))}
        </div>
        {!sessions.isLoading && !sessions.data?.items.length ? (
          <Card>
            <p>Aún no hay sesiones de capacitación.</p>
          </Card>
        ) : null}
      </WorkspaceSection>
    </WorkspaceShell>
  );
}

export function TrainingSessionWorkspace({ sessionId }: { sessionId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const canReview = REVIEW_ROLES.has(organization.currentRole ?? '');
  const [workerId, setWorkerId] = useState('');
  const [attendance, setAttendance] = useState<
    Record<string, NonNullable<Participant['attendance']>>
  >({});
  const [attendanceEvidence, setAttendanceEvidence] = useState<Record<string, string>>({});
  const session = useQuery({
    queryKey: queryKeys.organization.trainingSession(organizationId ?? 'inactive', sessionId),
    queryFn: ({ signal }) =>
      auth.request<TrainingSession>(`/training/sessions/${sessionId}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const workers = useQuery({
    queryKey: queryKeys.organization.workers(organizationId ?? 'inactive', 'status=ACTIVE'),
    queryFn: ({ signal }) =>
      auth.request<WorkerResponse>(
        '/workers?status=ACTIVE&pageSize=100',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite),
  });
  const operation = useMutation({
    mutationFn: ({ path, body }: Operation) =>
      auth.request(path, { method: 'POST', body: JSON.stringify(body) }, organizationId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });
  const run = (path: string, body: Record<string, unknown>, after?: () => void) =>
    operation.mutate({ path, body }, { onSuccess: () => after?.() });

  if (session.isLoading)
    return (
      <WorkspaceShell>
        <p role="status">Cargando sesión…</p>
      </WorkspaceShell>
    );
  if (session.isError || !session.data)
    return (
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Capacitación"
          title="No pudimos abrir la sesión"
          description="Confirma la organización activa o vuelve al registro de capacitación."
          actions={<Link href="/app/training">Volver a capacitación</Link>}
        />
      </WorkspaceShell>
    );

  const data = session.data;
  const enrolledIds = new Set(data.participants.map((participant) => participant.worker.id));
  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceHeader
        eyebrow="Capacitación · Sesión"
        title={data.trainingDefinition.title}
        description={`${formatDate(data.scheduledStart, true)} a ${formatDate(data.scheduledEnd, true)}`}
        context={
          <span className="status-badge" data-status={data.status.toLowerCase()}>
            {SESSION_LABELS[data.status]}
          </span>
        }
        actions={
          <Link className="button secondary" href="/app/training">
            Volver a capacitación
          </Link>
        }
      />
      {operation.isError ? <p role="alert">{errorMessage(operation.error)}</p> : null}
      {operation.isSuccess ? <p role="status">Cambio de capacitación guardado.</p> : null}
      <ContextSummary>
        <span>{MODE_LABELS[data.mode]}</span>
        <span>{data.workCenter?.name ?? 'Sin centro específico'}</span>
        <span>{data.participants.length} participante(s)</span>
      </ContextSummary>
      <div className="workspace-two-pane">
        <WorkspaceMain>
          {canWrite && ['DRAFT', 'SCHEDULED'].includes(data.status) ? (
            <WorkspaceSection eyebrow="Participantes" title="Inscribir trabajador">
              <div className="workforce-form workforce-compact-form">
                <label className="field">
                  <span>Persona trabajadora activa</span>
                  <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
                    <option value="">Selecciona una persona</option>
                    {(workers.data?.items ?? [])
                      .filter((worker) => !enrolledIds.has(worker.id))
                      .map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="button"
                  disabled={!workerId || operation.isPending}
                  onClick={() =>
                    run(`/training/sessions/${sessionId}/participants`, { workerId }, () =>
                      setWorkerId(''),
                    )
                  }
                  type="button"
                >
                  Inscribir trabajador
                </button>
              </div>
            </WorkspaceSection>
          ) : null}

          <WorkspaceSection eyebrow="Asistencia y completitud" title="Participantes">
            <div className="worker-list">
              {data.participants.map((participant) => {
                const matchingRequirement = participant.worker.trainingRequirements.find(
                  (requirement) => requirement.trainingDefinitionId === data.trainingDefinition.id,
                );
                return (
                  <article className="incident-action-card" key={participant.id}>
                    <div className="worker-row__title">
                      <h3>{participant.worker.displayName}</h3>
                      <span className="status-badge">
                        {participant.attendance
                          ? ATTENDANCE_LABELS[participant.attendance]
                          : 'Asistencia pendiente'}
                      </span>
                    </div>
                    <p>{participant.worker.jobTitle ?? 'Función no registrada'}</p>
                    {participant.attendanceEvidenceNote ? (
                      <small>Evidencia: {participant.attendanceEvidenceNote}</small>
                    ) : null}
                    {matchingRequirement ? (
                      <p>Requisito relacionado: {matchingRequirement.reason}</p>
                    ) : (
                      <p>Participación sin requisito previo vinculado.</p>
                    )}
                    {canWrite && data.status === 'SCHEDULED' && !participant.completion ? (
                      <div className="workforce-form workforce-compact-form">
                        <label className="field">
                          <span>{`Asistencia de ${participant.worker.displayName}`}</span>
                          <select
                            value={
                              attendance[participant.id] ?? participant.attendance ?? 'PRESENT'
                            }
                            onChange={(event) =>
                              setAttendance((current) => ({
                                ...current,
                                [participant.id]: event.target.value as NonNullable<
                                  Participant['attendance']
                                >,
                              }))
                            }
                          >
                            {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>{`Evidencia de asistencia de ${participant.worker.displayName}`}</span>
                          <textarea
                            rows={2}
                            value={attendanceEvidence[participant.id] ?? ''}
                            onChange={(event) =>
                              setAttendanceEvidence((current) => ({
                                ...current,
                                [participant.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          className="button secondary"
                          disabled={operation.isPending}
                          onClick={() =>
                            run(
                              `/training/sessions/${sessionId}/participants/${participant.id}/attendance`,
                              {
                                attendance:
                                  attendance[participant.id] ?? participant.attendance ?? 'PRESENT',
                                expectedVersion: participant.version,
                                ...(attendanceEvidence[participant.id]
                                  ? { evidenceNote: attendanceEvidence[participant.id] }
                                  : {}),
                              },
                            )
                          }
                          type="button"
                        >
                          Registrar asistencia
                        </button>
                        {participant.attendance && participant.attendance !== 'ABSENT' ? (
                          <form
                            className="workforce-form workforce-compact-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = new FormData(event.currentTarget);
                              const completedAt = String(form.get('completedAt') ?? '');
                              const completionNote = String(
                                form.get('completionNote') ?? '',
                              ).trim();
                              const certificateReference = String(
                                form.get('certificateReference') ?? '',
                              ).trim();
                              run(
                                `/training/sessions/${sessionId}/participants/${participant.id}/complete`,
                                {
                                  expectedVersion: participant.version,
                                  completedAt: new Date(completedAt).toISOString(),
                                  ...(matchingRequirement
                                    ? { requirementId: matchingRequirement.id }
                                    : {}),
                                  ...(completionNote ? { completionNote } : {}),
                                  ...(certificateReference ? { certificateReference } : {}),
                                },
                              );
                            }}
                          >
                            <label className="field">
                              <span>{`Fecha de completitud de ${participant.worker.displayName}`}</span>
                              <input name="completedAt" required type="datetime-local" />
                            </label>
                            <label className="field">
                              <span>{`Evidencia o nota de completitud de ${participant.worker.displayName}`}</span>
                              <textarea name="completionNote" rows={2} />
                            </label>
                            <label className="field">
                              <span>{`Referencia interna de ${participant.worker.displayName} (opcional)`}</span>
                              <input name="certificateReference" />
                            </label>
                            <button className="button" disabled={operation.isPending} type="submit">
                              Registrar completitud
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                    {participant.completion ? (
                      <Card>
                        <p>
                          Completada el {formatDate(participant.completion.completedAt)} · vigencia:{' '}
                          {formatDate(participant.completion.validUntil)}
                        </p>
                        {participant.completion.renewsCompletionId ? (
                          <small>
                            Renovación registrada; la completitud anterior permanece en la historia.
                          </small>
                        ) : null}
                      </Card>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {!data.participants.length ? <p>Aún no hay participantes inscritos.</p> : null}
          </WorkspaceSection>
        </WorkspaceMain>
        <WorkspaceInspector label="Contexto de la sesión">
          <section>
            <h2>Responsable</h2>
            <p>{data.instructorName ?? 'Sin responsable registrado'}</p>
            <p>{data.location ?? 'Sin lugar registrado'}</p>
          </section>
          <section>
            <h2>Vigencia</h2>
            <p>
              {data.trainingDefinition.validityDays
                ? `${data.trainingDefinition.validityDays} días desde cada completitud.`
                : 'Sin vencimiento operativo configurado.'}
            </p>
            <p>La vigencia no constituye una certificación legal automática.</p>
          </section>
          {canReview && data.status === 'DRAFT' ? (
            <button
              className="button"
              disabled={!data.participants.length || operation.isPending}
              onClick={() =>
                run(`/training/sessions/${sessionId}/transition`, {
                  status: 'SCHEDULED',
                  expectedVersion: data.version,
                })
              }
              type="button"
            >
              Programar sesión
            </button>
          ) : null}
          {canReview && data.status === 'SCHEDULED' ? (
            <button
              className="button"
              disabled={operation.isPending}
              onClick={() =>
                run(`/training/sessions/${sessionId}/transition`, {
                  status: 'COMPLETED',
                  expectedVersion: data.version,
                })
              }
              type="button"
            >
              Cerrar sesión completada
            </button>
          ) : null}
        </WorkspaceInspector>
      </div>
    </WorkspaceShell>
  );
}

export function WorkerTrainingPanel({
  workerId,
  workerStatus,
}: {
  workerId: string;
  workerStatus: 'ACTIVE' | 'INACTIVE';
}) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '') && workerStatus === 'ACTIVE';
  const workspace = useQuery({
    queryKey: queryKeys.organization.workerTraining(organizationId ?? 'inactive', workerId),
    queryFn: ({ signal }) =>
      auth.request<WorkerTrainingWorkspace>(
        `/training/workers/${workerId}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const definitions = useQuery({
    queryKey: queryKeys.organization.trainingDefinitions(organizationId ?? 'inactive', 'active'),
    queryFn: ({ signal }) =>
      auth.request<DefinitionResponse>(
        '/training/definitions?isActive=true&pageSize=100',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite),
  });
  const form = useForm<RequirementForm>({
    defaultValues: { trainingDefinitionId: '', reason: '', requiredByDate: '' },
  });
  const create = useMutation({
    mutationFn: (values: RequirementForm) =>
      auth.request(
        '/training/requirements',
        {
          method: 'POST',
          body: JSON.stringify({
            workerId,
            trainingDefinitionId: values.trainingDefinitionId,
            reason: values.reason,
            requiredByDate: values.requiredByDate || undefined,
            renewalRequired: true,
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
  const requirements = workspace.data?.requirements ?? [];
  const completions = workspace.data?.completions ?? [];

  return (
    <WorkspaceSection eyebrow="Competencia" title="Capacitación" id="training">
      <p>
        Requisitos, asistencia, completitud y renovaciones se derivan de registros profesionales; no
        representan un puntaje ni una certificación legal automática.
      </p>
      {workspace.isLoading ? <p role="status">Cargando historia de capacitación…</p> : null}
      {workspace.isError ? <p role="alert">{errorMessage(workspace.error)}</p> : null}
      <ContextSummary>
        <span>
          {requirements.filter((item) => item.competencyStatus === 'CURRENT').length} vigentes
        </span>
        <span>
          {requirements.filter((item) => item.competencyStatus === 'DUE_SOON').length} próximas a
          vencer
        </span>
        <span>
          {requirements.filter((item) => item.competencyStatus === 'EXPIRED').length} vencidas
        </span>
      </ContextSummary>
      {canWrite ? (
        <form
          className="workforce-form workforce-compact-form"
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
        >
          <label className="field">
            <span>Capacitación requerida</span>
            <select {...form.register('trainingDefinitionId', { required: true })}>
              <option value="">Selecciona una definición</option>
              {(definitions.data?.items ?? []).map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Motivo profesional</span>
            <textarea rows={2} {...form.register('reason', { required: true, minLength: 3 })} />
          </label>
          <label className="field">
            <span>Fecha requerida</span>
            <input type="date" {...form.register('requiredByDate')} />
          </label>
          <button className="button secondary" disabled={create.isPending} type="submit">
            Añadir requisito de capacitación
          </button>
          {create.isError ? <p role="alert">{errorMessage(create.error)}</p> : null}
          {create.isSuccess ? <p role="status">Requisito registrado.</p> : null}
        </form>
      ) : null}
      <div className="worker-list">
        {requirements.map((requirement) => (
          <article
            className="incident-action-card"
            id={`training-requirement-${requirement.id}`}
            key={requirement.id}
          >
            <div className="worker-row__title">
              <h3>{requirement.trainingDefinition.title}</h3>
              <span
                className="status-badge"
                data-status={requirement.competencyStatus.toLowerCase()}
              >
                {COMPETENCY_LABELS[requirement.competencyStatus]}
              </span>
            </div>
            <p>{requirement.reason}</p>
            <small>
              {requirement.requiredByDate
                ? `Requerida para ${formatDate(requirement.requiredByDate)}`
                : 'Sin fecha límite registrada'}
            </small>
            {requirement.linkedAssessment ? (
              <p>Riesgo relacionado: {requirement.linkedAssessment.title}</p>
            ) : null}
            {requirement.regulatoryContext ? (
              <Card>
                <p>{requirement.regulatoryContext.title}</p>
                <small>
                  {requirement.regulatoryContext.candidate
                    ? 'Referencia candidata: requiere revisión antes de tratarla como obligación.'
                    : 'Referencia aprobada para elaboración de reglas; no certifica cumplimiento.'}
                </small>
              </Card>
            ) : null}
          </article>
        ))}
      </div>
      <h3>Historia de completitud y renovación</h3>
      <div className="worker-list">
        {completions.map((completion) => (
          <article
            className="incident-action-card"
            id={`training-completion-${completion.id}`}
            key={completion.id}
          >
            <div className="worker-row__title">
              <h3>{completion.trainingDefinition.title}</h3>
              <span className="status-badge">{COMPETENCY_LABELS[completion.competencyStatus]}</span>
            </div>
            <p>
              Completada el {formatDate(completion.completedAt)} · vigencia:{' '}
              {formatDate(completion.validUntil)}
            </p>
            {completion.certificateReference ? (
              <small>Referencia documental: {completion.certificateReference}</small>
            ) : null}
            {completion.renewsCompletionId ? (
              <p>Renovación: el registro anterior permanece preservado en esta historia.</p>
            ) : null}
            <Link href={`/app/training/sessions/${completion.session.id}`}>
              Abrir sesión origen
            </Link>
          </article>
        ))}
      </div>
      {!requirements.length && !completions.length && !workspace.isLoading ? (
        <p>Aún no hay historia de capacitación para esta persona.</p>
      ) : null}
      {workerStatus === 'INACTIVE' ? (
        <Card>
          <p>
            La persona está inactiva. La historia permanece visible, pero no se permiten nuevas
            asignaciones.
          </p>
        </Card>
      ) : null}
    </WorkspaceSection>
  );
}
