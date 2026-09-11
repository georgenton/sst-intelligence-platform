'use client';

import { Card, StatusBadge } from '@sst/ui';
import Link from 'next/link';
import { useDashboardData } from './use-app-data';

export function DemoView() {
  const dashboard = useDashboardData();
  if (dashboard.isLoading) return <p>Cargando demostración…</p>;
  if (!dashboard.data) return <p>Selecciona una organización.</p>;
  const { organization, entitlements } = dashboard.data;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Demostración</p>
        <h2>Estado del workspace</h2>
      </div>
      <Card className="stack">
        <div>
          <StatusBadge>{entitlements.demoActive ? 'ACTIVA' : 'INACTIVA'}</StatusBadge>
          <h3>
            {entitlements.demoActive
              ? 'Demostración conceptual en curso'
              : 'No hay una demo activa'}
          </h3>
          <p className="muted">
            {organization.demoExpiresAt
              ? `Vence: ${new Date(organization.demoExpiresAt).toLocaleString('es')}`
              : 'Completa un diagnóstico para activar módulos recomendados.'}
          </p>
        </div>
        <p>
          Todos los centros, registros e indicadores marcados como demo son sintéticos y no
          representan una evaluación técnica ejecutada.
        </p>
        <div>
          <Link
            className="button"
            href={entitlements.demoActive ? '/app/modules' : '/app/evaluation'}
          >
            {entitlements.demoActive ? 'Ver módulos demo' : 'Iniciar diagnóstico'}
          </Link>
        </div>
      </Card>
    </div>
  );
}
