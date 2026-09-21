'use client';

import { Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';
import { useDashboardData } from './use-app-data';

type CatalogItem = { key: string; name: string; description: string; objective: string };
type CapabilityAccess = {
  assessment: {
    id: string;
    finalizedAt: string | null;
    engineVersion: string;
    outputHash: string;
  } | null;
  demo: {
    active: boolean;
    startedAt: string | null;
    expiresAt: string | null;
    canActivate: boolean;
  };
  capabilities: Array<{
    capabilityKey: string;
    title: string;
    description: string;
    href: string;
    recommended: boolean;
    recommendationReasons: string[];
    currentAccess: 'CORE' | 'PLAN' | 'ACTIVE' | 'DEMO' | 'LOCKED';
    demoEligible: boolean;
    accessExpiresAt?: string;
    capabilityOrigin: 'ASSESSMENT_RECOMMENDED' | 'EXPLORATION_SELECTED';
  }>;
};

export function ModulesView() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const dashboard = useDashboardData();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const idempotencyKey = useRef<string | null>(null);
  const organizationId = organization.activeId;
  const assessmentId = searchParams.get('assessment') ?? '';
  const catalog = useQuery({
    queryKey: queryKeys.global.moduleCatalog(),
    queryFn: ({ signal }) => auth.request<CatalogItem[]>('/module-catalog', { signal }),
    enabled: Boolean(auth.accessToken),
  });
  const access = useQuery({
    queryKey: queryKeys.organization.capabilityAccess(organizationId ?? 'inactive', assessmentId),
    queryFn: ({ signal }) =>
      auth.request<CapabilityAccess>(
        `/capability-access${assessmentId ? `?assessmentId=${encodeURIComponent(assessmentId)}` : ''}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(auth.accessToken && organizationId),
  });
  const activate = useMutation({
    mutationFn: () =>
      auth.request(
        '/capability-access/demo',
        {
          method: 'POST',
          headers: {
            'Idempotency-Key': (idempotencyKey.current ??= crypto.randomUUID()),
          },
          body: JSON.stringify({
            assessmentId: access.data?.assessment?.id,
            capabilityKeys: selected,
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      setConfirming(false);
      idempotencyKey.current = null;
      setMessage('Demostración activada. Las capacidades seleccionadas ya están disponibles.');
      setSelected([]);
      await Promise.all([
        access.refetch(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.entitlements(organizationId!),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.dashboard(organizationId!),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.user.organizations(auth.user?.id ?? ''),
        }),
      ]);
    },
  });
  if (catalog.isLoading || dashboard.isLoading || access.isLoading) return <p>Cargando módulos…</p>;
  if (!catalog.data) return <p className="field-error">No pudimos cargar el catálogo.</p>;
  const selectable =
    access.data?.capabilities.filter(
      (item) => item.demoEligible && item.currentAccess === 'LOCKED',
    ) ?? [];
  const recommended = selectable.filter((item) => item.recommended);
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Catálogo modular</p>
        <h1>Módulos disponibles</h1>
        <p className="muted">
          Consulta lo que está activo, disponible como demostración o no incluido.
        </p>
      </div>
      {access.data ? (
        <section className="stack" aria-labelledby="capability-access-title">
          <div>
            <p className="eyebrow">Decisión humana</p>
            <h2 id="capability-access-title">Explora las capacidades propuestas</h2>
            <p className="muted">
              La evaluación propone; una persona decide qué abrir temporalmente. Esto no cambia el
              plan ni el resultado del diagnóstico.
            </p>
          </div>
          <div className="grid">
            {access.data.capabilities.map((capability) => {
              const selectableCapability =
                capability.demoEligible && capability.currentAccess === 'LOCKED';
              const checked = selected.includes(capability.capabilityKey);
              return (
                <Card className="stack" key={capability.capabilityKey}>
                  <div>
                    <StatusBadge>
                      {capability.currentAccess === 'DEMO'
                        ? 'Demo temporal'
                        : capability.currentAccess === 'CORE'
                          ? 'Disponible'
                          : capability.currentAccess === 'LOCKED'
                            ? capability.recommended
                              ? 'Recomendada · bloqueada'
                              : 'Disponible para explorar'
                            : 'Activo'}
                    </StatusBadge>
                    <h3>{capability.title}</h3>
                    <p className="muted">{capability.description}</p>
                    {capability.recommended ? (
                      <p className="muted">Recomendada por tu evaluación.</p>
                    ) : capability.demoEligible && capability.currentAccess === 'LOCKED' ? (
                      <p className="muted">
                        Disponible para explorar; no fue recomendada por esta evaluación.
                      </p>
                    ) : null}
                  </div>
                  {selectableCapability ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelected((current) =>
                            checked
                              ? current.filter((key) => key !== capability.capabilityKey)
                              : [...current, capability.capabilityKey],
                          )
                        }
                      />{' '}
                      Incluir en demostración
                    </label>
                  ) : capability.currentAccess !== 'LOCKED' ? (
                    <Link href={capability.href}>Abrir capacidad →</Link>
                  ) : null}
                </Card>
              );
            })}
          </div>
          {selectable.length > 0 && access.data.assessment && access.data.demo.canActivate ? (
            <div className="stack-sm">
              <p>
                {recommended.length
                  ? `${recommended.length} recomendada(s) lista(s) para revisar.`
                  : 'Selecciona una capacidad para explorar.'}
              </p>
              <button
                className="button"
                type="button"
                disabled={!selected.length || activate.isPending}
                onClick={() => {
                  idempotencyKey.current = crypto.randomUUID();
                  setConfirming(true);
                }}
              >
                Activar demostración
              </button>
            </div>
          ) : null}
          {confirming ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="demo-confirm-title"
              className="stack"
            >
              <h3 id="demo-confirm-title">Activar demostración</h3>
              <p>Activarás acceso temporal a las capacidades seleccionadas.</p>
              <p className="muted">
                Esto no cambia tu plan ni modifica el resultado de la evaluación.
              </p>
              <div>
                <button
                  className="button"
                  type="button"
                  onClick={() => activate.mutate()}
                  disabled={activate.isPending}
                >
                  {activate.isPending ? 'Activando…' : 'Confirmar activación'}
                </button>{' '}
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    idempotencyKey.current = null;
                    setConfirming(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
          {message ? <p role="status">{message}</p> : null}
          {activate.error ? (
            <p className="field-error" role="alert">
              No pudimos activar la demostración. Intenta nuevamente.
            </p>
          ) : null}
        </section>
      ) : null}
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
