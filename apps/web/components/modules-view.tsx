'use client';

import { Card, StatusBadge } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';
import { useDashboardData } from './use-app-data';

type CatalogItem = { key: string; name: string; description: string; objective: string };

export function ModulesView() {
  const auth = useAuth();
  const dashboard = useDashboardData();
  const catalog = useQuery({
    queryKey: queryKeys.global.moduleCatalog(),
    queryFn: ({ signal }) => auth.request<CatalogItem[]>('/module-catalog', { signal }),
    enabled: Boolean(auth.accessToken),
  });
  if (catalog.isLoading || dashboard.isLoading) return <p>Cargando módulos…</p>;
  if (!catalog.data) return <p className="field-error">No pudimos cargar el catálogo.</p>;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Catálogo modular</p>
        <h1>Módulos disponibles</h1>
        <p className="muted">
          Consulta lo que está activo, disponible como demostración o no incluido.
        </p>
      </div>
      <div className="grid">
        {catalog.data.map((module) => {
          const active = dashboard.data?.organization.modules.find(
            (item) => item.module.key === module.key,
          );
          return (
            <Card className="stack" key={module.key}>
              <div>
                <StatusBadge>
                  {active ? (active.status === 'DEMO' ? 'Demo temporal' : 'Activo') : 'No incluido'}
                </StatusBadge>
                <h3>{module.name}</h3>
                <p className="muted">{module.description}</p>
              </div>
              {active ? (
                <Link href={`/app/modules/${module.key}`}>Abrir presentación →</Link>
              ) : (
                <Link href="/app/billing">Solicitar mejora →</Link>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
