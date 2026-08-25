'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { humanRoleLabel } from '@/lib/human-lexicon';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';
import { SessionPersistence } from './guided';

type Fields = { name: string; country: string; sector: string };

export function OrganizationsView() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const search = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Fields>({ defaultValues: { country: 'Ecuador' } });
  const submit = handleSubmit(async (fields) => {
    setError('');
    try {
      const created = await auth.request<{ id: string; name: string }>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ ...fields, sector: fields.sector || undefined }),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.user.organizations(auth.user!.id),
      });
      const sessionId = search.get('sessionId');
      await organization.setActiveId(
        created.id,
        sessionId ? undefined : 'Organización creada correctamente.',
      );
      if (sessionId) {
        const token = SessionPersistence.load(sessionId);
        if (!token) throw new Error('No encontramos el token del diagnóstico.');
        await auth.request(
          `/solution-finder/sessions/${sessionId}/claim`,
          { method: 'POST' },
          created.id,
          token,
        );
        await auth.request(
          `/solution-finder/sessions/${sessionId}/activate-demo`,
          { method: 'POST' },
          created.id,
          token,
        );
        await queryClient.invalidateQueries({
          queryKey: queryKeys.user.organizations(auth.user!.id),
        });
        router.push('/app');
        return;
      }
      reset({ name: '', country: 'Ecuador', sector: '' });
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : 'No pudimos crear la organización.',
      );
    }
  });
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Organizaciones</p>
        <h2>Cambia de contexto sin mezclar datos.</h2>
        <p className="muted">Puedes tener roles diferentes en cada empresa.</p>
      </div>
      <div className="grid">
        <Card className="stack">
          <h3>Tus organizaciones</h3>
          {organization.loading ? (
            <p>Cargando…</p>
          ) : organization.organizations.length === 0 ? (
            <p className="muted">Todavía no perteneces a una organización.</p>
          ) : (
            organization.organizations.map((item) => (
              <button
                className="card module-row"
                key={item.id}
                disabled={organization.transitioning}
                onClick={() => void organization.setActiveId(item.id)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <br />
                  <small className="muted">{humanRoleLabel(item.memberships[0]?.role)}</small>
                </span>
                {item.id === organization.activeId && <StatusBadge>Activa</StatusBadge>}
              </button>
            ))
          )}
        </Card>
        <Card className="stack">
          <h3>Crear organización</h3>
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label htmlFor="name">Nombre de empresa</label>
              <input id="name" {...register('name', { required: true, minLength: 2 })} />
            </div>
            <div className="field">
              <label htmlFor="country">País</label>
              <input id="country" {...register('country', { required: true })} />
            </div>
            <div className="field">
              <label htmlFor="sector">Sector</label>
              <input id="sector" {...register('sector')} />
            </div>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={isSubmitting}>
              {isSubmitting
                ? 'Creando…'
                : search.get('sessionId')
                  ? 'Crear y activar demo'
                  : 'Crear organización'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
