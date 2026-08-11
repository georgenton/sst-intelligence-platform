'use client';

import { Card, StatusBadge } from '@sst/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDashboardData } from './use-app-data';

export function ModuleDetail() {
  const params = useParams<{ moduleKey: string }>();
  const dashboard = useDashboardData();
  if (dashboard.isLoading) return <p>Cargando módulo…</p>;
  const item = dashboard.data?.organization.modules.find(
    (candidate) => candidate.module.key === params.moduleKey,
  );
  if (!item)
    return (
      <Card className="stack">
        <StatusBadge>ENTITLEMENT REQUERIDO</StatusBadge>
        <h2>Este módulo no está habilitado.</h2>
        <p className="muted">
          La API no lo incluyó entre los módulos efectivos de la organización.
        </p>
        <div>
          <Link className="button" href="/app/billing">
            Solicitar mejora
          </Link>
        </div>
      </Card>
    );
  const indicators = item.module.demoContent?.indicators ?? [];
  return (
    <div className="stack">
      <div>
        <StatusBadge>{item.status}</StatusBadge>
        <p className="eyebrow">{item.status === 'DEMO' ? 'Demostración conceptual' : 'Módulo'}</p>
        <h2>{item.module.name}</h2>
        <p className="muted">{item.module.objective}</p>
      </div>
      <Card>
        <h3>Problemas que ayuda a organizar</h3>
        <p>{item.module.description}</p>
      </Card>
      <div className="grid">
        {indicators.map((indicator) => (
          <Card key={indicator.label}>
            <p className="eyebrow">{indicator.label}</p>
            <h2>{indicator.value}</h2>
            <p className="muted">
              Indicador sintético de ejemplo; no representa una evaluación ejecutada.
            </p>
          </Card>
        ))}
      </div>
      <Card className="stack">
        <p>
          <strong>Estado:</strong> {item.status}
        </p>
        <p className="muted">
          Los flujos profundos de este módulo no forman parte del incremento actual.
        </p>
        <div>
          <Link className="button" href="/app/billing">
            Solicitar activación real
          </Link>
        </div>
      </Card>
    </div>
  );
}
