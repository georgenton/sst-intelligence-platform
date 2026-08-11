'use client';

import { Card, StatusBadge } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';

type Dashboard = {
  organization: {
    name: string;
    status: string;
    demoExpiresAt?: string;
    _count: { workCenters: number; memberships: number };
    modules: Array<{
      status: string;
      expiresAt?: string;
      module: { key: string; name: string; description: string };
    }>;
  };
  entitlements: {
    plan: { key: string; name: string };
    features: Record<string, boolean | number | string>;
  };
};

export function DashboardView() {
  const auth = useAuth();
  const organization = useOrganization();
  const query = useQuery({
    queryKey: ['dashboard', organization.activeId],
    queryFn: () => auth.request<Dashboard>('/dashboard', {}, organization.activeId!),
    enabled: Boolean(organization.activeId),
  });
  if (!organization.activeId)
    return (
      <Card className="stack">
        <h2>Crea tu primera organización</h2>
        <p className="muted">Una organización es el límite principal de aislamiento.</p>
        <div>
          <Link className="button" href="/app/organizations">
            Crear organización
          </Link>
        </div>
      </Card>
    );
  if (query.isLoading) return <p>Cargando dashboard…</p>;
  if (query.isError || !query.data)
    return (
      <p className="field-error" role="alert">
        No pudimos cargar el dashboard.
      </p>
    );
  const data = query.data;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h2>{data.organization.name}</h2>
        <p className="muted">
          Plan {data.entitlements.plan.name}. Los límites efectivos provienen de la API.
        </p>
      </div>
      <div className="grid">
        <Card>
          <p className="eyebrow">Centros</p>
          <h2>{data.organization._count.workCenters}</h2>
        </Card>
        <Card>
          <p className="eyebrow">Miembros</p>
          <h2>{data.organization._count.memberships}</h2>
        </Card>
        <Card>
          <p className="eyebrow">Módulos habilitados</p>
          <h2>{data.organization.modules.length}</h2>
        </Card>
      </div>
      <section>
        <h2>Módulos</h2>
        <div className="grid">
          {data.organization.modules.map((item) => (
            <Card className="stack" key={item.module.key}>
              <div>
                <StatusBadge>{item.status}</StatusBadge>
                <h3>{item.module.name}</h3>
                <p className="muted">{item.module.description}</p>
              </div>
              <Link href={`/app/modules/${item.module.key}`}>Ver presentación →</Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
