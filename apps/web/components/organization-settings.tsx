'use client';

import { Button, Card, StatusBadge } from '@sst/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';

type Details = {
  id: string;
  name: string;
  country: string;
  sector?: string;
  workCenters: Array<{ id: string; name: string; city?: string; isDemo: boolean }>;
};

export function OrganizationSettings() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['organization', organization.activeId],
    queryFn: () =>
      auth.request<Details>(`/organizations/${organization.activeId}`, {}, organization.activeId!),
    enabled: Boolean(organization.activeId),
  });
  const { register, handleSubmit } = useForm<{ name: string; sector: string }>({
    values: query.data ? { name: query.data.name, sector: query.data.sector ?? '' } : undefined,
  });
  const submit = handleSubmit(async (body) => {
    await auth.request(
      `/organizations/${organization.activeId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      organization.activeId!,
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['organization'] }),
      queryClient.invalidateQueries({ queryKey: ['organizations'] }),
    ]);
    setMessage('Datos actualizados.');
  });
  if (!organization.activeId) return <p>Selecciona una organización.</p>;
  if (query.isLoading) return <p>Cargando empresa…</p>;
  if (!query.data) return <p className="field-error">No pudimos cargar la empresa.</p>;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Configuración</p>
        <h2>Datos de empresa y centros</h2>
      </div>
      <div className="grid">
        <Card>
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label htmlFor="org-name">Nombre</label>
              <input id="org-name" {...register('name', { required: true })} />
            </div>
            <div className="field">
              <label htmlFor="org-sector">Sector</label>
              <input id="org-sector" {...register('sector')} />
            </div>
            <div className="field">
              <label>País</label>
              <input value={query.data.country} disabled />
            </div>
            {message && <p role="status">{message}</p>}
            <Button>Guardar cambios</Button>
          </form>
        </Card>
        <Card className="stack">
          <h3>Centros de trabajo</h3>
          {query.data.workCenters.map((center) => (
            <div className="module-row" key={center.id}>
              <span>
                {center.name}
                {center.city ? ` · ${center.city}` : ''}
              </span>
              {center.isDemo && <StatusBadge>Sintético</StatusBadge>}
            </div>
          ))}
          <p className="muted">
            La creación avanzada de centros queda limitada por `organization.max_work_centers` en el
            siguiente slice.
          </p>
        </Card>
      </div>
    </div>
  );
}
