'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  clearStoredActiveOrganization,
  resolveStoredActiveOrganization,
  storeActiveOrganization,
} from '@/lib/active-organization-storage';
import {
  isolateOrganizationTransition,
  planOrganizationReconciliation,
} from '@/lib/query-cache';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';

type Organization = {
  id: string;
  name: string;
  status: string;
  demoExpiresAt?: string;
  memberships: Array<{ role: string }>;
};
type OrganizationContextValue = {
  activeId: string | null;
  setActiveId(id: string, notice?: string): Promise<void>;
  organizations: Organization[];
  loading: boolean;
  transitioning: boolean;
};
const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function AppShell({ children }: PropsWithChildren) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<string | null | undefined>(undefined);
  const [contextUserId, setContextUserId] = useState<string | null>(null);
  const [contextNotice, setContextNotice] = useState<string | null>(null);
  const userId = auth.user?.id;
  const organizations = useQuery({
    queryKey: queryKeys.user.organizations(userId ?? 'unauthenticated'),
    queryFn: ({ signal }) => auth.request<Organization[]>('/organizations', { signal }),
    enabled: Boolean(userId && auth.accessToken),
  });

  useEffect(() => {
    if (!auth.loading && !auth.user)
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.loading, auth.user, pathname, router]);
  useEffect(() => setContextNotice(null), [pathname]);
  useEffect(() => {
    if (!userId || !organizations.data || transitionTarget !== undefined) return;
    const validIds = organizations.data.map(({ id }) => id);
    const initialOrganizationId =
      contextUserId === userId
        ? null
        : resolveStoredActiveOrganization(window.localStorage, userId, validIds);
    const reconciliation = planOrganizationReconciliation({
      contextUserId,
      authenticatedUserId: userId,
      activeOrganizationId: activeId,
      validOrganizationIds: validIds,
      initialOrganizationId,
    });
    if (reconciliation.action === 'initialize') {
      setTransitionTarget(undefined);
      setActiveIdState(reconciliation.organizationId);
      setContextUserId(userId);
      if (reconciliation.organizationId)
        storeActiveOrganization(
          window.localStorage,
          userId,
          reconciliation.organizationId,
          validIds,
        );
      else clearStoredActiveOrganization(window.localStorage, userId);
      return;
    }
    if (reconciliation.action === 'preserve') {
      if (reconciliation.organizationId)
        storeActiveOrganization(
          window.localStorage,
          userId,
          reconciliation.organizationId,
          validIds,
        );
      else clearStoredActiveOrganization(window.localStorage, userId);
      return;
    }
    setContextNotice(null);
    setTransitionTarget(reconciliation.organizationId);
    void isolateOrganizationTransition(
      queryClient,
      activeId,
      reconciliation.organizationId,
      () => {
        setActiveIdState(reconciliation.organizationId);
        if (reconciliation.organizationId)
          storeActiveOrganization(
            window.localStorage,
            userId,
            reconciliation.organizationId,
            validIds,
          );
        else clearStoredActiveOrganization(window.localStorage, userId);
      },
    ).catch(() => setTransitionTarget(undefined));
  }, [activeId, contextUserId, organizations.data, queryClient, transitionTarget, userId]);

  useEffect(() => {
    if (transitionTarget === undefined || activeId !== transitionTarget) return;
    const frame = window.requestAnimationFrame(() => setTransitionTarget(undefined));
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, transitionTarget]);

  async function setActiveId(id: string, notice?: string) {
    if (!userId) return;
    if (id === activeId) {
      setContextNotice(notice ?? null);
      return;
    }
    const currentOrganizations =
      queryClient.getQueryData<Organization[]>(queryKeys.user.organizations(userId)) ??
      organizations.data ??
      [];
    const validIds = currentOrganizations.map((organization) => organization.id);
    if (!validIds.includes(id)) throw new Error('ACTIVE_ORGANIZATION_NOT_AVAILABLE');
    setContextNotice(null);
    setTransitionTarget(id);
    try {
      await isolateOrganizationTransition(queryClient, activeId, id, () => {
        storeActiveOrganization(window.localStorage, userId, id, validIds);
        setActiveIdState(id);
        setContextNotice(notice ?? null);
      });
    } catch (error) {
      setTransitionTarget(undefined);
      throw error;
    }
  }
  const current = organizations.data?.find((item) => item.id === activeId);
  const transitioning =
    transitionTarget !== undefined || Boolean(userId && contextUserId !== userId);
  const demoActive =
    current?.status === 'DEMO' &&
    current.demoExpiresAt !== undefined &&
    new Date(current.demoExpiresAt).getTime() > Date.now();
  const context = useMemo(
    () => ({
      activeId,
      setActiveId,
      organizations: organizations.data ?? [],
      loading: organizations.isLoading || transitioning,
      transitioning,
    }),
    [activeId, organizations.data, organizations.isLoading, transitioning],
  );
  if (auth.loading || (!auth.user && !auth.loading))
    return (
      <main className="auth-wrap">
        <p>Cargando sesión…</p>
      </main>
    );
  return (
    <OrganizationContext.Provider value={context}>
      <div className="app-layout">
        <aside className="sidebar">
          <Link className="brand" href="/app">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'SST Inteligente'}
          </Link>
          <nav aria-label="Navegación de la aplicación">
            <Link href="/app">Resumen</Link>
            <Link href="/app/inspections">Inspecciones</Link>
            <Link href="/app/technical-risk">Riesgo técnico</Link>
            <Link href="/app/modules">Módulos</Link>
            <Link href="/app/organizations">Organizaciones</Link>
            <Link href="/app/settings/organization">Empresa</Link>
            <Link href="/app/settings/members">Miembros</Link>
            <Link href="/app/billing">Plan</Link>
            <Link href="/app/demo">Demo</Link>
          </nav>
        </aside>
        <div className="app-main">
          <header className="app-topbar">
            <div>
              <strong>Organización activa</strong>
              <br />
              <span className="muted">{current?.memberships[0]?.role ?? 'Sin organización'}</span>
            </div>
            <select
              className="org-select"
              aria-label="Organización activa"
              value={transitioning ? '' : (activeId ?? '')}
              disabled={transitioning}
              aria-busy={transitioning}
              onChange={(event) => void setActiveId(event.target.value)}
            >
              <option value="">Selecciona una organización</option>
              {(organizations.data ?? []).map((organization) => (
                <option value={organization.id} key={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <button
              className="button secondary"
              onClick={() => auth.logout().then(() => router.push('/'))}
            >
              Salir
            </button>
          </header>
          {demoActive && (
            <div className="demo-banner" role="status">
              Demostración conceptual activa
              {current.demoExpiresAt
                ? ` hasta ${new Date(current.demoExpiresAt).toLocaleDateString('es')}`
                : ''}
              . Los datos son sintéticos.
            </div>
          )}
          <main className="app-content" aria-busy={transitioning}>
            {transitioning ? (
              <p role="status" aria-live="polite">
                Cambiando organización…
              </p>
            ) : (
              <>
                {contextNotice && <p role="status">{contextNotice}</p>}
                {children}
              </>
            )}
          </main>
        </div>
      </div>
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const value = useContext(OrganizationContext);
  if (!value) throw new Error('OrganizationContext is required');
  return value;
}
