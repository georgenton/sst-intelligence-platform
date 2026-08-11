'use client';

import { ApiClientError, apiRequest } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Fields>({ defaultValues: { country: 'Ecuador' } });
  const submit = handleSubmit(async (fields) => {
    setError('');
    setMessage('');
    try {
      const created = await auth.request<{ id: string; name: string }>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ ...fields, sector: fields.sector || undefined }),
      });
      organization.setActiveId(created.id);
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      const sessionId = search.get('sessionId');
      if (sessionId) {
        const token = SessionPersistence.load(sessionId);
        if (!token) throw new Error('No encontramos el token del diagnóstico.');
        await apiRequest(
          `/solution-finder/sessions/${sessionId}/claim`,
          { method: 'POST' },
          {
            accessToken: auth.accessToken ?? undefined,
            organizationId: created.id,
            sessionToken: token,
          },
        );
        await apiRequest(
          `/solution-finder/sessions/${sessionId}/activate-demo`,
          { method: 'POST' },
          {
            accessToken: auth.accessToken ?? undefined,
            organizationId: created.id,
            sessionToken: token,
          },
        );
        await queryClient.invalidateQueries({ queryKey: ['organizations'] });
        router.push('/app');
        return;
      }
      reset({ name: '', country: 'Ecuador', sector: '' });
      setMessage('Organización creada correctamente.');
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
                onClick={() => organization.setActiveId(item.id)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <br />
                  <small className="muted">{item.memberships[0]?.role}</small>
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
            {message && <p role="status">{message}</p>}
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
