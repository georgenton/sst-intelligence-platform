'use client';

import { Button, Card, StatusBadge } from '@sst/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  humanInvitationStatusLabel,
  humanMembershipStatusLabel,
  humanRoleLabel,
} from '@/lib/human-lexicon';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';

type Member = {
  id: string;
  role: string;
  status: string;
  user: { id: string; email: string; displayName: string };
};

type Invitation = {
  id: string;
  emailNormalized: string;
  role: string;
  status: string;
  expiresAt: string;
};

type InvitationResult = Invitation & {
  token: string;
  delivery: 'MANUAL_COPY_LINK';
};

const editableRoles = ['ORG_ADMIN', 'SST_MANAGER', 'SST_TECHNICIAN', 'CONSULTANT', 'VIEWER'];

export function MembersView() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const organizationId = organization.activeId;
  const activeMembership = organization.organizations.find((item) => item.id === organizationId)
    ?.memberships[0];
  const canManage =
    activeMembership?.role === 'ORG_OWNER' || activeMembership?.role === 'ORG_ADMIN';
  const membersQuery = useQuery({
    queryKey: queryKeys.organization.members(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Member[]>(
        `/organizations/${organizationId}/members`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const invitationsQuery = useQuery({
    queryKey: queryKeys.organization.invitations(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Invitation[]>(
        `/organizations/${organizationId}/invitations`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canManage),
  });
  const activeMembers = useMemo(
    () => membersQuery.data?.filter((member) => member.status === 'ACTIVE') ?? [],
    [membersQuery.data],
  );
  const { register, handleSubmit, reset } = useForm<{ email: string; role: string }>({
    defaultValues: { email: '', role: 'VIEWER' },
  });

  async function refreshTeam() {
    if (!organizationId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.organization.members(organizationId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.invitations(organizationId),
      }),
    ]);
  }

  const submitInvitation = handleSubmit(async (body) => {
    if (!organizationId) return;
    setError('');
    setNotice('');
    setInvitationLink('');
    try {
      const result = await auth.request<InvitationResult>(
        `/organizations/${organizationId}/invitations`,
        { method: 'POST', body: JSON.stringify(body) },
        organizationId,
      );
      const link = `${window.location.origin}/invite/accept#token=${encodeURIComponent(result.token)}`;
      setInvitationLink(link);
      setNotice('Invitación creada. Copia el enlace ahora: por seguridad no volverá a mostrarse.');
      reset();
      await refreshTeam();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos crear la invitación.');
    }
  });

  async function copyInvitationLink() {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setNotice('Enlace copiado. Compártelo únicamente con la persona invitada.');
    } catch {
      setError('No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.');
    }
  }

  async function updateRole(member: Member, role: string) {
    if (!organizationId || role === member.role) return;
    setError('');
    setNotice('');
    try {
      await auth.request(
        `/organizations/${organizationId}/members/${member.id}/role`,
        { method: 'PATCH', body: JSON.stringify({ role }) },
        organizationId,
      );
      setNotice(`Rol de ${member.user.displayName} actualizado.`);
      await refreshTeam();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos actualizar el rol.');
    }
  }

  async function deactivate(member: Member) {
    if (!organizationId) return;
    setError('');
    setNotice('');
    try {
      await auth.request(
        `/organizations/${organizationId}/members/${member.id}/deactivate`,
        { method: 'POST' },
        organizationId,
      );
      setNotice(`Acceso de ${member.user.displayName} desactivado.`);
      await refreshTeam();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos desactivar el acceso.');
    }
  }

  async function revoke(invitation: Invitation) {
    if (!organizationId) return;
    setError('');
    setNotice('');
    try {
      await auth.request(
        `/organizations/${organizationId}/invitations/${invitation.id}/revoke`,
        { method: 'POST' },
        organizationId,
      );
      setNotice(`Invitación para ${invitation.emailNormalized} revocada.`);
      await refreshTeam();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos revocar la invitación.');
    }
  }

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Configuración</p>
        <h2>Equipo y miembros</h2>
        <p className="muted">
          Consulta quién tiene acceso a la organización activa y administra sus responsabilidades.
        </p>
      </div>

      {notice ? <p role="status">{notice}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid">
        <Card className="stack">
          <div>
            <h3>Miembros</h3>
            <p className="muted">{activeMembers.length} con acceso activo.</p>
          </div>
          {membersQuery.isLoading ? <p>Cargando equipo…</p> : null}
          {membersQuery.isError ? (
            <p className="field-error" role="alert">
              No pudimos cargar los miembros.
            </p>
          ) : null}
          {membersQuery.data?.map((member) => {
            const canEditMember =
              canManage &&
              member.role !== 'ORG_OWNER' &&
              member.user.id !== auth.user?.id &&
              member.status === 'ACTIVE';
            return (
              <div className="module-row" key={member.id}>
                <span>
                  <strong>{member.user.displayName}</strong>
                  <br />
                  <small className="muted">{member.user.email}</small>
                  <br />
                  <small>{humanMembershipStatusLabel(member.status)}</small>
                </span>
                {canEditMember ? (
                  <span className="form-actions compact">
                    <label className="sr-only" htmlFor={`role-${member.id}`}>
                      Rol de {member.user.displayName}
                    </label>
                    <select
                      id={`role-${member.id}`}
                      aria-label={`Rol de ${member.user.displayName}`}
                      value={member.role}
                      onChange={(event) => void updateRole(member, event.target.value)}
                    >
                      {editableRoles.map((role) => (
                        <option value={role} key={role}>
                          {humanRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      className="secondary"
                      onClick={() => void deactivate(member)}
                    >
                      Desactivar
                    </Button>
                  </span>
                ) : (
                  <StatusBadge>{humanRoleLabel(member.role)}</StatusBadge>
                )}
              </div>
            );
          })}
        </Card>

        {canManage ? (
          <Card>
            <form className="stack" onSubmit={submitInvitation}>
              <div>
                <h3>Invitar a una persona</h3>
                <p className="muted">
                  No enviamos correo en esta versión. Comparte el enlace de forma segura con la
                  persona invitada; caduca en 7 días y solo puede usarse una vez.
                </p>
              </div>
              <div className="field">
                <label htmlFor="invite-email">Correo</label>
                <input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  {...register('email', { required: true })}
                />
              </div>
              <div className="field">
                <label htmlFor="invite-role">Rol</label>
                <select id="invite-role" {...register('role')}>
                  {editableRoles.map((role) => (
                    <option value={role} key={role}>
                      {humanRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
              <Button>Crear invitación</Button>
            </form>
            {invitationLink ? (
              <div className="stack" aria-live="polite">
                <div className="field">
                  <label htmlFor="invitation-link">Enlace de invitación</label>
                  <input id="invitation-link" readOnly value={invitationLink} />
                </div>
                <Button
                  type="button"
                  className="secondary"
                  onClick={() => void copyInvitationLink()}
                >
                  Copiar enlace de invitación
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

      {canManage ? (
        <Card className="stack">
          <div>
            <h3>Invitaciones</h3>
            <p className="muted">Seguimiento de enlaces creados para esta organización.</p>
          </div>
          {invitationsQuery.isLoading ? <p>Cargando invitaciones…</p> : null}
          {invitationsQuery.data?.length === 0 ? (
            <p className="muted">Aún no hay invitaciones.</p>
          ) : null}
          {invitationsQuery.data?.map((invitation) => (
            <div className="module-row" key={invitation.id}>
              <span>
                <strong>{invitation.emailNormalized}</strong>
                <br />
                <small className="muted">
                  {humanRoleLabel(invitation.role)} ·{' '}
                  {humanInvitationStatusLabel(invitation.status)}
                </small>
              </span>
              {invitation.status === 'PENDING' ? (
                <Button type="button" className="secondary" onClick={() => void revoke(invitation)}>
                  Revocar
                </Button>
              ) : (
                <StatusBadge>{humanInvitationStatusLabel(invitation.status)}</StatusBadge>
              )}
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
