'use client';

import { Button, Card, StatusBadge } from '@sst/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from './auth-provider';
import { useDashboardData } from './use-app-data';

export function BillingView() {
  const auth = useAuth();
  const dashboard = useDashboardData();
  const [message, setMessage] = useState('');
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ requestedPlan: string; message: string }>({
    defaultValues: { requestedPlan: 'GROWTH' },
  });
  const submit = handleSubmit(async (body) => {
    await auth.request(
      '/upgrade-requests',
      { method: 'POST', body: JSON.stringify(body) },
      dashboard.activeId!,
    );
    setMessage('Solicitud registrada. El equipo comercial podrá revisarla.');
  });
  if (dashboard.isLoading) return <p>Cargando plan…</p>;
  if (!dashboard.data) return <p>Selecciona una organización.</p>;
  const features = dashboard.data.entitlements.features;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Plan y límites</p>
        <h2>{dashboard.data.entitlements.plan.name}</h2>
        <p className="muted">Cifras provisionales configurables; no representan precios finales.</p>
      </div>
      <div className="grid">
        <Card className="stack">
          <h3>Entitlements efectivos</h3>
          {Object.entries(features).map(([key, value]) => (
            <div className="module-row" key={key}>
              <code>{key}</code>
              <StatusBadge>{String(value)}</StatusBadge>
            </div>
          ))}
        </Card>
        <Card>
          <form className="stack" onSubmit={submit}>
            <h3>Solicitar mejora</h3>
            <div className="field">
              <label htmlFor="requestedPlan">Plan de interés</label>
              <select id="requestedPlan" {...register('requestedPlan')}>
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="upgrade-message">Contexto (opcional)</label>
              <textarea id="upgrade-message" rows={4} {...register('message')} />
            </div>
            {message && <p role="status">{message}</p>}
            <Button disabled={isSubmitting}>Enviar solicitud</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
