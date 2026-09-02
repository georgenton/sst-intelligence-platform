'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextSummary,
  WorkspaceHeader,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type Membership = {
  id: string;
  role: string;
  status: string;
  user: { id: string; displayName: string; email: string };
};
type WorkCenter = { id: string; name: string; isActive: boolean };
type GovernanceMember = {
  id: string;
  roleLabel?: string | null;
  isActive: boolean;
  worker?: { id: string; displayName: string; status: string } | null;
  membership?: Membership | null;
};
type Evidence = { id: string; type: 'NOTE' | 'EXTERNAL_LINK'; note?: string; externalUrl?: string };
type GovernanceAction = {
  id: string;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt?: string | null;
  version: number;
  assignedToMembership?: Membership | null;
  evidence: Evidence[];
};
type GovernanceDecision = {
  id: string;
  summary: string;
  rationale?: string | null;
  regulatorySnapshot: {
    boundary?: 'REFERENCIA_REVISADA' | 'REFERENCIA_CANDIDATA' | 'SIN_REFERENCIA';
    legalMandateInferred?: boolean;
  };
  actions: GovernanceAction[];
  evidence: Evidence[];
};
type GovernanceMeeting = {
  id: string;
  title: string;
  status: 'DRAFT' | 'SCHEDULED' | 'HELD' | 'CANCELLED';
  scheduledAt: string;
  heldAt?: string | null;
  mode: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
  location?: string | null;
  notes?: string | null;
  chairMembership?: { id: string; user: { id: string; displayName: string } } | null;
  agendaItems: Array<{ id: string; title: string; notes?: string | null; sortOrder: number }>;
  decisions: GovernanceDecision[];
  evidence: Evidence[];
};
type GovernanceBody = {
  id: string;
  name: string;
  category: 'COMMITTEE' | 'WORK_GROUP' | 'SAFETY_MEETING' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE';
  workCenter?: { id: string; name: string } | null;
  members: GovernanceMember[];
  meetings: GovernanceMeeting[];
};

const WRITE_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);
const bodyLabels = {
  COMMITTEE: 'Comité SST',
  WORK_GROUP: 'Grupo de trabajo',
  SAFETY_MEETING: 'Reunión de seguridad',
  OTHER: 'Otro espacio',
} as const;
const meetingLabels = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  HELD: 'Realizada',
  CANCELLED: 'Cancelada',
} as const;

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.payload.message;
  return 'No pudimos completar la operación.';
}

export function GovernanceWorkspace() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const [selectedBodyId, setSelectedBodyId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const bodies = useQuery({
    queryKey: queryKeys.organization.governanceBodies(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<GovernanceBody[]>('/governance/bodies', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const team = useQuery({
    queryKey: queryKeys.organization.members(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Membership[]>(
        `/organizations/${organizationId}/members`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite),
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
  const selectedBody = useMemo(
    () => bodies.data?.find(({ id }) => id === selectedBodyId) ?? bodies.data?.[0],
    [bodies.data, selectedBodyId],
  );
  const bodyForm = useForm<{
    name: string;
    category: GovernanceBody['category'];
    workCenterId: string;
  }>({
    defaultValues: { name: '', category: 'COMMITTEE', workCenterId: '' },
  });
  const memberForm = useForm<{ membershipId: string; roleLabel: string }>({
    defaultValues: { membershipId: '', roleLabel: '' },
  });
  const meetingForm = useForm<{
    title: string;
    scheduledAt: string;
    mode: GovernanceMeeting['mode'];
    location: string;
    chairMembershipId: string;
    agendaTitle: string;
  }>({
    defaultValues: {
      title: '',
      scheduledAt: '',
      mode: 'IN_PERSON',
      location: '',
      chairMembershipId: '',
      agendaTitle: '',
    },
  });
  const decisionForm = useForm<{ meetingId: string; summary: string; rationale: string }>({
    defaultValues: { meetingId: '', summary: '', rationale: '' },
  });

  async function refresh() {
    if (!organizationId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.organization.governanceBodies(organizationId),
    });
  }

  const operation = useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body,
    }: {
      path: string;
      method?: 'POST' | 'PATCH';
      body: unknown;
    }) => auth.request(path, { method, body: JSON.stringify(body) }, organizationId!),
    onSuccess: async () => {
      setError('');
      setNotice('Registro actualizado.');
      await refresh();
    },
    onError: (cause) => {
      setNotice('');
      setError(errorMessage(cause));
    },
  });

  const createBody = bodyForm.handleSubmit(async ({ workCenterId, ...values }) => {
    const result = await operation.mutateAsync({
      path: '/governance/bodies',
      body: { ...values, workCenterId: workCenterId || undefined },
    });
    const created = result as GovernanceBody;
    setSelectedBodyId(created.id);
    bodyForm.reset();
  });
  const addMember = memberForm.handleSubmit(async (values) => {
    if (!selectedBody) return;
    await operation.mutateAsync({
      path: `/governance/bodies/${selectedBody.id}/members`,
      body: { membershipId: values.membershipId, roleLabel: values.roleLabel || undefined },
    });
    memberForm.reset();
  });
  const createMeeting = meetingForm.handleSubmit(async ({ agendaTitle, ...values }) => {
    if (!selectedBody) return;
    await operation.mutateAsync({
      path: `/governance/bodies/${selectedBody.id}/meetings`,
      body: {
        ...values,
        scheduledAt: new Date(values.scheduledAt).toISOString(),
        location: values.location || undefined,
        chairMembershipId: values.chairMembershipId || undefined,
        participantMemberIds: selectedBody.members
          .filter(({ isActive }) => isActive)
          .map(({ id }) => id),
        agendaItems: agendaTitle ? [{ title: agendaTitle, sortOrder: 1 }] : [],
      },
    });
    meetingForm.reset();
  });
  const createDecision = decisionForm.handleSubmit(async ({ meetingId, ...values }) => {
    await operation.mutateAsync({
      path: `/governance/meetings/${meetingId}/decisions`,
      body: { summary: values.summary, rationale: values.rationale || undefined },
    });
    decisionForm.reset();
  });

  const heldMeetings = selectedBody?.meetings.filter(({ status }) => status === 'HELD') ?? [];

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Operación"
        title="Gobernanza"
        description="Registra espacios, reuniones, decisiones y compromisos sin asumir composiciones ni frecuencias legales."
        context={
          <ContextSummary>
            <span>La plataforma conserva evidencia e historia operativa.</span>
            <span>Una referencia normativa no crea por sí sola una obligación.</span>
          </ContextSummary>
        }
      />
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <WorkspaceMain>
        <WorkspaceSection
          eyebrow="Espacios"
          title="Comités y grupos de trabajo"
          description="La denominación es organizacional; no declara obligatoriedad legal."
        >
          <div className="dashboard-grid">
            {bodies.data?.map((body) => (
              <button
                className="record-button"
                key={body.id}
                onClick={() => setSelectedBodyId(body.id)}
                type="button"
                aria-pressed={selectedBody?.id === body.id}
              >
                <strong>{body.name}</strong>
                <span>
                  {bodyLabels[body.category]} · {body.workCenter?.name ?? 'Toda la organización'}
                </span>
              </button>
            ))}
          </div>
          {canWrite ? (
            <form className="stack-form" onSubmit={createBody}>
              <label>
                Nombre
                <input {...bodyForm.register('name', { required: true })} />
              </label>
              <label>
                Tipo
                <select {...bodyForm.register('category')}>
                  {Object.entries(bodyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Centro de trabajo
                <select {...bodyForm.register('workCenterId')}>
                  <option value="">Toda la organización</option>
                  {centers.data
                    ?.filter(({ isActive }) => isActive)
                    .map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button type="submit" disabled={operation.isPending}>
                Crear espacio
              </Button>
            </form>
          ) : null}
        </WorkspaceSection>

        {selectedBody ? (
          <WorkspaceSection
            eyebrow={bodyLabels[selectedBody.category]}
            title={selectedBody.name}
            description={`${selectedBody.members.length} participante(s) · ${selectedBody.meetings.length} reunión(es)`}
          >
            {canWrite ? (
              <form className="stack-form" onSubmit={addMember}>
                <label>
                  Cuenta participante
                  <select {...memberForm.register('membershipId', { required: true })}>
                    <option value="">Selecciona una cuenta</option>
                    {team.data
                      ?.filter(({ status }) => status === 'ACTIVE')
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Rol en el espacio
                  <input
                    {...memberForm.register('roleLabel')}
                    placeholder="Ej. Presidencia, secretaría, participante"
                  />
                </label>
                <Button type="submit" disabled={operation.isPending}>
                  Agregar participante
                </Button>
              </form>
            ) : null}
            <div className="dashboard-grid">
              {selectedBody.members.map((member) => (
                <Card key={member.id}>
                  <strong>
                    {member.worker?.displayName ?? member.membership?.user.displayName}
                  </strong>
                  <p>
                    {member.roleLabel ?? 'Participante'} ·{' '}
                    {member.worker ? 'Trabajador' : 'Cuenta del equipo'}
                  </p>
                </Card>
              ))}
            </div>
            {canWrite ? (
              <form className="stack-form" onSubmit={createMeeting}>
                <label>
                  Título
                  <input {...meetingForm.register('title', { required: true })} />
                </label>
                <label>
                  Fecha y hora
                  <input
                    type="datetime-local"
                    {...meetingForm.register('scheduledAt', { required: true })}
                  />
                </label>
                <label>
                  Modalidad
                  <select {...meetingForm.register('mode')}>
                    <option value="IN_PERSON">Presencial</option>
                    <option value="VIRTUAL">Virtual</option>
                    <option value="HYBRID">Híbrida</option>
                  </select>
                </label>
                <label>
                  Lugar o enlace
                  <input {...meetingForm.register('location')} />
                </label>
                <label>
                  Presidencia
                  <select {...meetingForm.register('chairMembershipId')}>
                    <option value="">Sin asignar todavía</option>
                    {team.data
                      ?.filter(({ status }) => status === 'ACTIVE')
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Primer punto de agenda
                  <input {...meetingForm.register('agendaTitle')} />
                </label>
                <Button type="submit" disabled={operation.isPending}>
                  Crear reunión
                </Button>
              </form>
            ) : null}
            <div className="stack-list">
              {selectedBody.meetings.map((meeting) => (
                <Card key={meeting.id}>
                  <div className="record-heading">
                    <strong>{meeting.title}</strong>
                    <StatusBadge>{meetingLabels[meeting.status]}</StatusBadge>
                  </div>
                  <p>
                    {new Date(meeting.scheduledAt).toLocaleString('es-EC')} ·{' '}
                    {meeting.location ?? 'Sin lugar registrado'}
                  </p>
                  {meeting.agendaItems.length ? (
                    <p>Agenda: {meeting.agendaItems.map(({ title }) => title).join(' · ')}</p>
                  ) : null}
                  {canWrite && meeting.status === 'DRAFT' ? (
                    <Button
                      type="button"
                      onClick={() =>
                        operation.mutate({
                          path: `/governance/meetings/${meeting.id}/transition`,
                          body: { status: 'SCHEDULED' },
                        })
                      }
                    >
                      Programar
                    </Button>
                  ) : null}
                  {canWrite && meeting.status === 'SCHEDULED' ? (
                    <Button
                      type="button"
                      onClick={() =>
                        operation.mutate({
                          path: `/governance/meetings/${meeting.id}/transition`,
                          body: { status: 'HELD' },
                        })
                      }
                    >
                      Registrar como realizada
                    </Button>
                  ) : null}
                  {meeting.decisions.map((decision) => (
                    <div className="record-inset" key={decision.id}>
                      <strong>Decisión</strong>
                      <p>{decision.summary}</p>
                      <small>
                        {decision.regulatorySnapshot.boundary === 'REFERENCIA_REVISADA'
                          ? 'Referencia revisada'
                          : decision.regulatorySnapshot.boundary === 'REFERENCIA_CANDIDATA'
                            ? 'Referencia candidata; requiere revisión'
                            : 'Sin fundamento normativo asociado'}
                      </small>
                      {decision.actions.map((action) => (
                        <p key={action.id}>
                          Compromiso: {action.title} · {action.status}
                        </p>
                      ))}
                      {canWrite ? (
                        <ActionForm
                          decisionId={decision.id}
                          pending={operation.isPending}
                          run={(path, body) => operation.mutate({ path, body })}
                        />
                      ) : null}
                    </div>
                  ))}
                  {canWrite ? (
                    <EvidenceForm
                      meetingId={meeting.id}
                      pending={operation.isPending}
                      run={(path, body) => operation.mutate({ path, body })}
                    />
                  ) : null}
                </Card>
              ))}
            </div>
            {canWrite && heldMeetings.length ? (
              <form className="stack-form" onSubmit={createDecision}>
                <h3>Registrar decisión</h3>
                <label>
                  Reunión realizada
                  <select {...decisionForm.register('meetingId', { required: true })}>
                    <option value="">Selecciona una reunión</option>
                    {heldMeetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Decisión
                  <textarea {...decisionForm.register('summary', { required: true })} />
                </label>
                <label>
                  Fundamento interno
                  <textarea {...decisionForm.register('rationale')} />
                </label>
                <Button type="submit" disabled={operation.isPending}>
                  Registrar decisión
                </Button>
              </form>
            ) : null}
          </WorkspaceSection>
        ) : null}
      </WorkspaceMain>
    </WorkspaceShell>
  );
}

function ActionForm({
  decisionId,
  pending,
  run,
}: {
  decisionId: string;
  pending: boolean;
  run: (path: string, body: unknown) => void;
}) {
  const form = useForm<{ title: string; dueAt: string }>({
    defaultValues: { title: '', dueAt: '' },
  });
  return (
    <form
      className="inline-form"
      onSubmit={form.handleSubmit((values) => {
        run(`/governance/decisions/${decisionId}/actions`, {
          title: values.title,
          dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
        });
        form.reset();
      })}
    >
      <label>
        Nuevo compromiso
        <input {...form.register('title', { required: true })} />
      </label>
      <label>
        Fecha objetivo
        <input type="date" {...form.register('dueAt')} />
      </label>
      <Button type="submit" disabled={pending}>
        Agregar
      </Button>
    </form>
  );
}

function EvidenceForm({
  meetingId,
  pending,
  run,
}: {
  meetingId: string;
  pending: boolean;
  run: (path: string, body: unknown) => void;
}) {
  const form = useForm<{ note: string }>({ defaultValues: { note: '' } });
  return (
    <form
      className="inline-form"
      onSubmit={form.handleSubmit((values) => {
        run(`/governance/meetings/${meetingId}/evidence`, { type: 'NOTE', note: values.note });
        form.reset();
      })}
    >
      <label>
        Nota de evidencia
        <input {...form.register('note', { required: true })} />
      </label>
      <Button type="submit" disabled={pending}>
        Adjuntar nota
      </Button>
    </form>
  );
}
