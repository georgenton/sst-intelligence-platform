'use client';

import { Button, Card, StatusBadge } from '@sst/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { humanRoleLabel } from '@/lib/human-lexicon';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';

type Member = {
  id: string;
  role: string;
  status: string;
  user: { email: string; displayName: string };
};

export function MembersView() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const organizationId = organization.activeId;
  const query = useQuery({
    queryKey: queryKeys.organization.members(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Member[]>(
        `/organizations/${organizationId}/members`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const { register, handleSubmit, reset } = useForm<{ email: string; role: string }>({
    defaultValues: { role: 'VIEWER' },
  });
  const submit = handleSubmit(async (body) => {
    setError('');
    try {
      const result = await auth.request<{ delivery: string }>(
        `/organizations/${organization.activeId}/invitations`,
        { method: 'POST', body: JSON.stringify(body) },
        organization.activeId!,
      );
      setMessage(`Invitación registrada mediante ${result.delivery}.`);
      reset({ email: '', role: 'VIEWER' });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.members(organizationId!),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos registrar la invitación.');
    }
  });
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Acceso</p>
        <h2>Miembros y roles</h2>
        <p className="muted">Cada rol pertenece a una organización específica.</p>
      </div>
      <div className="grid">
        <Card className="stack">
          <h3>Miembros activos</h3>
          {query.isLoading ? (
            <p>Cargando…</p>
          ) : (
            query.data?.map((member) => (
              <div className="module-row" key={member.id}>
                <span>
                  <strong>{member.user.displayName}</strong>
                  <br />
                  <small className="muted">{member.user.email}</small>
                </span>
                <StatusBadge>{humanRoleLabel(member.role)}</StatusBadge>
              </div>
            ))
          )}
        </Card>
        <Card>
          <form className="stack" onSubmit={submit}>
            <h3>Invitar miembro</h3>
            <p className="muted">
              La invitación quedará registrada; en esta versión no se envía correo automático.
            </p>
            <div className="field">
              <label htmlFor="invite-email">Correo</label>
              <input id="invite-email" type="email" {...register('email', { required: true })} />
            </div>
            <div className="field">
              <label htmlFor="invite-role">Rol</label>
              <select id="invite-role" {...register('role')}>
                {['ORG_ADMIN', 'SST_MANAGER', 'SST_TECHNICIAN', 'CONSULTANT', 'VIEWER'].map(
                  (role) => (
                    <option value={role} key={role}>
                      {humanRoleLabel(role)}
                    </option>
                  ),
                )}
              </select>
            </div>
            {message && <p role="status">{message}</p>}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button>Registrar invitación</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
