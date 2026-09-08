'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

type ObservationStatus =
  'OPEN' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED_NO_ACTION';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Observation = {
  id: string;
  title: string;
  description: string;
  category: string;
  observedAt: string;
  priority: Priority;
  status: ObservationStatus;
  version: number;
  resolutionNote?: string | null;
  workCenter: { id: string; name: string };
  workArea?: { id: string; name: string } | null;
  reportedBy: { id: string; displayName: string };
  assignedTo?: { id: string; displayName: string } | null;
  evidence: Array<{
    id: string;
    type: 'NOTE' | 'EXTERNAL_LINK';
    note?: string | null;
    externalUrl?: string | null;
    createdAt: string;
  }>;
  actionLinks: Array<{
    id: string;
    obligationExecution: {
      id: string;
      title: string;
      status: string;
      priority: Priority;
      dueAt?: string | null;
    };
  }>;
};
type ObservationList = { items: Observation[]; total: number };
type WorkCenter = { id: string; name: string; isActive: boolean };
type WorkArea = { id: string; name: string; workCenterId: string };
type Member = {
  status: string;
  user: { id: string; displayName: string };
};
type ObligationList = {
  items: Array<{ id: string; title: string; status: string }>;
};
type ObservationForm = {
  title: string;
  description: string;
  category: string;
  workCenterId: string;
  workAreaId: string;
  observedAt: string;
  priority: Priority;
  assignedToUserId: string;
  evidenceNote: string;
  evidenceUrl: string;
};
type PendingObservationEvidence = {
  organizationId: string;
  observationId: string;
  payload: { type: 'NOTE' | 'EXTERNAL_LINK'; note?: string; externalUrl?: string };
};

const WRITE_ROLES = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
const REVIEW_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);
const STATUS_LABELS: Record<ObservationStatus, string> = {
  OPEN: 'Abierta',
  UNDER_REVIEW: 'En revisión',
  ACTION_REQUIRED: 'Requiere acción',
  RESOLVED: 'Resuelta',
  CLOSED_NO_ACTION: 'Cerrada sin acción',
};
const CATEGORY_LABELS: Record<string, string> = {
  UNSAFE_ACT: 'Acto inseguro',
  UNSAFE_CONDITION: 'Condición insegura',
  GOOD_PRACTICE: 'Buena práctica',
  HOUSEKEEPING: 'Orden y limpieza',
  PPE: 'EPP',
  OTHER: 'Otra',
};

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.payload.message
    : 'No pudimos completar la operación. Intenta nuevamente.';
}

export function SafetyObservationRegistry() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const organizationId = organization.activeId;
  const [pendingEvidence, setPendingEvidence] = useState<PendingObservationEvidence | null>(null);
  const activePendingEvidence =
    pendingEvidence?.organizationId === organizationId ? pendingEvidence : null;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const observations = useQuery({
    queryKey: queryKeys.organization.safetyObservations(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<ObservationList>('/safety-observations', { signal }, organizationId!),
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
  const areas = useQuery({
    queryKey: queryKeys.organization.workAreas(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<WorkArea[]>('/workers/work-areas', { signal }, organizationId!),
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
    enabled: Boolean(organizationId && canWrite),
  });
  const form = useForm<ObservationForm>({
    defaultValues: {
      title: '',
      description: '',
      category: 'UNSAFE_CONDITION',
      workCenterId: '',
      workAreaId: '',
      observedAt: new Date().toISOString().slice(0, 16),
      priority: 'MEDIUM',
      assignedToUserId: '',
      evidenceNote: '',
      evidenceUrl: '',
    },
  });
  const create = useMutation({
    mutationFn: async (values: ObservationForm) => {
      const observation = await auth.request<Observation>(
        '/safety-observations',
        {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            workAreaId: values.workAreaId || undefined,
            assignedToUserId: values.assignedToUserId || undefined,
            observedAt: new Date(values.observedAt).toISOString(),
            evidenceNote: undefined,
            evidenceUrl: undefined,
          }),
        },
        organizationId!,
      );
      const evidencePayload =
        values.evidenceNote.trim() || values.evidenceUrl.trim()
          ? {
              type: (values.evidenceUrl.trim() ? 'EXTERNAL_LINK' : 'NOTE') as
                'NOTE' | 'EXTERNAL_LINK',
              note: values.evidenceNote.trim() || undefined,
              externalUrl: values.evidenceUrl.trim() || undefined,
            }
          : null;
      if (evidencePayload) {
        try {
          await auth.request(
            `/safety-observations/${observation.id}/evidence`,
            {
              method: 'POST',
              body: JSON.stringify(evidencePayload),
            },
            organizationId!,
          );
        } catch {
          return { observation, pendingEvidence: evidencePayload };
        }
      }
      return { observation, pendingEvidence: null };
    },
    onSuccess: async ({ observation, pendingEvidence: failedEvidence }) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
      if (failedEvidence) {
        setPendingEvidence({
          organizationId: organizationId!,
          observationId: observation.id,
          payload: failedEvidence,
        });
        return;
      }
      router.push(`/app/safety-observations/${observation.id}`);
    },
  });
  const retryEvidence = useMutation({
    mutationFn: async () => {
      if (!activePendingEvidence) return;
      await auth.request(
        `/safety-observations/${activePendingEvidence.observationId}/evidence`,
        {
          method: 'POST',
          body: JSON.stringify(activePendingEvidence.payload),
        },
        organizationId!,
      );
      return activePendingEvidence.observationId;
    },
    onSuccess: (observationId) => {
      if (!observationId) return;
      setPendingEvidence(null);
      router.push(`/app/safety-observations/${observationId}`);
    },
  });

  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceMain>
        <WorkspaceHeader
          eyebrow="Operación · Prevención"
          title="Observaciones de seguridad"
          description="Registra señales preventivas sin convertirlas automáticamente en hallazgos ni incidentes."
        />
        <ContextSummary>
          <span>{observations.data?.total ?? 0} observaciones</span>
          <span>Flujo preventivo independiente</span>
          <span>Revisión profesional explícita</span>
        </ContextSummary>
        <WorkspaceSection title="Registro" eyebrow="Triage">
          {observations.isLoading ? <p role="status">Cargando observaciones…</p> : null}
          {observations.isError ? (
            <p role="alert">No fue posible cargar las observaciones.</p>
          ) : null}
          <div className="card-grid">
            {(observations.data?.items ?? []).map((observation) => (
              <Card key={observation.id}>
                <p className="eyebrow">
                  {CATEGORY_LABELS[observation.category] ?? observation.category} ·{' '}
                  {observation.priority}
                </p>
                <h3>{observation.title}</h3>
                <p>{observation.description}</p>
                <p>
                  {observation.workCenter.name}
                  {observation.workArea ? ` · ${observation.workArea.name}` : ''}
                </p>
                <span className="status-badge" data-status={observation.status.toLowerCase()}>
                  {STATUS_LABELS[observation.status]}
                </span>
                <p>
                  <Link href={`/app/safety-observations/${observation.id}`}>Abrir seguimiento</Link>
                </p>
              </Card>
            ))}
          </div>
          {!observations.isLoading && observations.data?.items.length === 0 ? (
            <p>No hay observaciones registradas.</p>
          ) : null}
        </WorkspaceSection>
      </WorkspaceMain>
      <WorkspaceInspector>
        <WorkspaceSection title="Nueva observación" eyebrow="Registro autenticado">
          {!canWrite ? <p>Tu rol puede consultar, pero no registrar observaciones.</p> : null}
          {canWrite ? (
            <form className="stack" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
              <label>
                Título
                <input {...form.register('title', { required: true })} />
              </label>
              <label>
                Descripción breve
                <textarea {...form.register('description', { required: true })} />
              </label>
              <label>
                Categoría
                <select {...form.register('category')}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Centro de trabajo
                <select {...form.register('workCenterId', { required: true })}>
                  <option value="">Selecciona un centro</option>
                  {(centers.data ?? [])
                    .filter((center) => center.isActive)
                    .map((center) => (
                      <option value={center.id} key={center.id}>
                        {center.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Área (opcional)
                <select {...form.register('workAreaId')}>
                  <option value="">Sin área específica</option>
                  {(areas.data ?? [])
                    .filter((area) => area.workCenterId === form.watch('workCenterId'))
                    .map((area) => (
                      <option value={area.id} key={area.id}>
                        {area.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Fecha y hora observada
                <input type="datetime-local" {...form.register('observedAt', { required: true })} />
              </label>
              <label>
                Nota de evidencia (opcional)
                <textarea
                  rows={2}
                  placeholder="Qué se observó o qué evidencia quedó registrada"
                  {...form.register('evidenceNote')}
                />
              </label>
              <label>
                Enlace HTTPS de evidencia (opcional)
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  {...form.register('evidenceUrl')}
                />
              </label>
              <label>
                Prioridad de atención interna
                <select {...form.register('priority')}>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </label>
              <label>
                Responsable de seguimiento (opcional)
                <select {...form.register('assignedToUserId')}>
                  <option value="">Sin responsable asignado</option>
                  {(members.data ?? [])
                    .filter((member) => member.status === 'ACTIVE')
                    .map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <button type="submit" disabled={create.isPending || Boolean(activePendingEvidence)}>
                Registrar observación
              </button>
              {create.isError ? <p role="alert">{errorMessage(create.error)}</p> : null}
              {activePendingEvidence ? (
                <div role="alert" className="boundary-note">
                  <p>Observación registrada; la evidencia no pudo guardarse.</p>
                  <button
                    type="button"
                    disabled={retryEvidence.isPending}
                    onClick={() => retryEvidence.mutate()}
                  >
                    Reintentar solo la evidencia
                  </button>
                  {retryEvidence.isError ? <p>{errorMessage(retryEvidence.error)}</p> : null}
                </div>
              ) : null}
            </form>
          ) : null}
        </WorkspaceSection>
      </WorkspaceInspector>
    </WorkspaceShell>
  );
}

export function SafetyObservationDetail({ observationId }: { observationId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const canReview = REVIEW_ROLES.has(organization.currentRole ?? '');
  const [resolutionNote, setResolutionNote] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [obligationExecutionId, setObligationExecutionId] = useState('');
  const observation = useQuery({
    queryKey: queryKeys.organization.safetyObservation(organizationId ?? 'inactive', observationId),
    queryFn: ({ signal }) =>
      auth.request<Observation>(
        `/safety-observations/${observationId}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const obligations = useQuery({
    queryKey: queryKeys.organization.obligations(organizationId ?? 'inactive', 'active'),
    queryFn: ({ signal }) =>
      auth.request<ObligationList>(
        '/operational-execution/obligations?pageSize=100',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite),
  });
  const transition = useMutation({
    mutationFn: ({
      status,
      resolutionNote,
    }: {
      status: ObservationStatus;
      resolutionNote?: string;
    }) =>
      auth.request<Observation>(
        `/safety-observations/${observationId}/transition`,
        {
          method: 'POST',
          body: JSON.stringify({
            status,
            expectedVersion: observation.data!.version,
            ...(resolutionNote ? { resolutionNote } : {}),
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      setResolutionNote('');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });
  const operation = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      auth.request(path, { method: 'POST', body: JSON.stringify(body) }, organizationId!),
    onSuccess: async () => {
      setEvidenceNote('');
      setObligationExecutionId('');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });
  if (observation.isLoading) return <p role="status">Cargando observación…</p>;
  if (!observation.data) return <p role="alert">No fue posible cargar la observación.</p>;
  const item = observation.data;
  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceMain>
        <WorkspaceHeader
          eyebrow="Observación de seguridad"
          title={item.title}
          description={item.description}
          actions={<Link href="/app/safety-observations">Volver al registro</Link>}
        />
        <ContextSummary>
          <span>{STATUS_LABELS[item.status]}</span>
          <span>{item.workCenter.name}</span>
          <span>Prioridad {item.priority.toLowerCase()}</span>
        </ContextSummary>
        <WorkspaceSection title="Trazabilidad" eyebrow="Contexto">
          <p>Reportada por {item.reportedBy.displayName}.</p>
          <p>Observada el {new Date(item.observedAt).toLocaleString('es-EC')}.</p>
          {item.resolutionNote ? (
            <p>
              <strong>Resolución:</strong> {item.resolutionNote}
            </p>
          ) : null}
          {item.evidence.length === 0 ? <p>Sin evidencia referenciada.</p> : null}
          {item.evidence.map((evidence) => (
            <p key={evidence.id}>
              {evidence.note ?? evidence.externalUrl} ·{' '}
              {new Date(evidence.createdAt).toLocaleDateString('es-EC')}
            </p>
          ))}
        </WorkspaceSection>
        <WorkspaceSection title="Acciones vinculadas" eyebrow="Ejecución existente">
          {item.actionLinks.length === 0 ? <p>No hay acciones operativas vinculadas.</p> : null}
          {item.actionLinks.map(({ id, obligationExecution: action }) => (
            <Card key={id}>
              <h3>{action.title}</h3>
              <p>
                {action.status} · {action.priority}
              </p>
              <Link href={`/app/work/obligations/${action.id}`}>Abrir acción</Link>
            </Card>
          ))}
        </WorkspaceSection>
      </WorkspaceMain>
      <WorkspaceInspector>
        <WorkspaceSection title="Revisión profesional" eyebrow="Cambio de estado">
          {!canReview ? <p>Solo un revisor autorizado puede cambiar el estado.</p> : null}
          {canReview && !['RESOLVED', 'CLOSED_NO_ACTION'].includes(item.status) ? (
            <div className="stack">
              {item.status === 'OPEN' ? (
                <button type="button" onClick={() => transition.mutate({ status: 'UNDER_REVIEW' })}>
                  Iniciar revisión
                </button>
              ) : null}
              {item.status !== 'ACTION_REQUIRED' ? (
                <button
                  type="button"
                  onClick={() => transition.mutate({ status: 'ACTION_REQUIRED' })}
                >
                  Requiere acción
                </button>
              ) : null}
              <button
                type="button"
                disabled={resolutionNote.trim().length < 3 || transition.isPending}
                onClick={() =>
                  transition.mutate({ status: 'RESOLVED', resolutionNote: resolutionNote.trim() })
                }
              >
                Resolver con verificación
              </button>
              <label>
                Nota de resolución profesional
                <textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                />
              </label>
              {transition.isError ? <p role="alert">{errorMessage(transition.error)}</p> : null}
            </div>
          ) : null}
        </WorkspaceSection>
        {canWrite && !['RESOLVED', 'CLOSED_NO_ACTION'].includes(item.status) ? (
          <WorkspaceSection title="Evidencia y acciones" eyebrow="Referencias explícitas">
            <div className="stack">
              <label>
                Nota de evidencia
                <textarea
                  value={evidenceNote}
                  onChange={(event) => setEvidenceNote(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={evidenceNote.trim().length < 1 || operation.isPending}
                onClick={() =>
                  operation.mutate({
                    path: `/safety-observations/${observationId}/evidence`,
                    body: { type: 'NOTE', note: evidenceNote.trim() },
                  })
                }
              >
                Añadir referencia de evidencia
              </button>
              <label>
                Acción operativa existente
                <select
                  value={obligationExecutionId}
                  onChange={(event) => setObligationExecutionId(event.target.value)}
                >
                  <option value="">Selecciona una acción</option>
                  {(obligations.data?.items ?? [])
                    .filter(
                      (action) =>
                        !item.actionLinks.some((link) => link.obligationExecution.id === action.id),
                    )
                    .map((action) => (
                      <option key={action.id} value={action.id}>
                        {action.title} · {action.status}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!obligationExecutionId || operation.isPending}
                onClick={() =>
                  operation.mutate({
                    path: `/safety-observations/${observationId}/actions`,
                    body: { obligationExecutionId },
                  })
                }
              >
                Vincular acción existente
              </button>
              {operation.isError ? <p role="alert">{errorMessage(operation.error)}</p> : null}
            </div>
          </WorkspaceSection>
        ) : null}
      </WorkspaceInspector>
    </WorkspaceShell>
  );
}
