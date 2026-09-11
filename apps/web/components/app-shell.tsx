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
import { isolateOrganizationTransition, planOrganizationReconciliation } from '@/lib/query-cache';
import { queryKeys } from '@/lib/query-keys';
import {
  isAssessmentSetupPath,
  requiresAssessmentSetup,
  setupStateMessage,
} from '@/lib/sst-assessment-setup';
import type { AssessmentSetupState } from '@/lib/sst-assessment-types';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { useAuth } from './auth-provider';
import { PublicAssessmentEntry } from './sst-assessment/public-assessment-entry';
import { SetupShell } from './sst-assessment/setup-shell';

type Organization = {
  id: string;
  name: string;
  status: string;
  demoExpiresAt?: string;
  memberships: Array<{ role: string }>;
};
type OrganizationContextValue = {
  activeId: string | null;
  currentRole: string | null;
  setActiveId(id: string, notice?: string): Promise<void>;
  organizations: Organization[];
  loading: boolean;
  transitioning: boolean;
};
type EffectiveEntitlements = { features: Record<string, boolean | number | string> };
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
  const setupState = useQuery({
    queryKey: queryKeys.organization.sstAssessmentSetup(activeId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<AssessmentSetupState>('/sst-assessment/setup-state', { signal }, activeId!),
    enabled: Boolean(activeId && transitionTarget === undefined),
  });
  const setupAllowsApplication = setupState.data?.hardGate === false;
  const entitlements = useQuery({
    queryKey: queryKeys.organization.entitlements(activeId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<EffectiveEntitlements>('/entitlements', { signal }, activeId!),
    enabled: Boolean(activeId && transitionTarget === undefined && setupAllowsApplication),
  });

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      const reason = auth.sessionEnded ? '&reason=session-ended' : '';
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}${reason}`);
    }
  }, [auth.loading, auth.sessionEnded, auth.user, pathname, router]);
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
    void isolateOrganizationTransition(queryClient, activeId, reconciliation.organizationId, () => {
      if (pathname.startsWith('/app/evaluation/')) router.replace('/app/evaluation');
      setActiveIdState(reconciliation.organizationId);
      if (reconciliation.organizationId)
        storeActiveOrganization(
          window.localStorage,
          userId,
          reconciliation.organizationId,
          validIds,
        );
      else clearStoredActiveOrganization(window.localStorage, userId);
    }).catch(() => setTransitionTarget(undefined));
  }, [
    activeId,
    contextUserId,
    organizations.data,
    pathname,
    queryClient,
    router,
    transitionTarget,
    userId,
  ]);

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
        if (pathname.startsWith('/app/evaluation/')) router.replace('/app/evaluation');
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
      currentRole: current?.memberships[0]?.role ?? null,
      setActiveId,
      organizations: organizations.data ?? [],
      loading: organizations.isLoading || transitioning,
      transitioning,
    }),
    [activeId, current?.memberships, organizations.data, organizations.isLoading, transitioning],
  );
  if (auth.loading || (!auth.user && !auth.loading))
    return (
      <main className="auth-wrap">
        <p>Cargando sesión…</p>
      </main>
    );
  const setupPath = isAssessmentSetupPath(pathname);
  const noOrganizations = organizations.isSuccess && organizations.data.length === 0;
  const setupLoading = transitioning || Boolean(activeId && setupState.isLoading);
  const setupError = Boolean(activeId && setupState.isError);
  const setupRequired = requiresAssessmentSetup(setupState.data);
  const useSetupShell = noOrganizations || setupPath || setupLoading || setupError || setupRequired;
  if (useSetupShell) {
    const setupContent = noOrganizations ? (
      pathname === '/app/setup/claim' || pathname === '/app/organizations' ? (
        children
      ) : (
        <PublicAssessmentEntry continuation="authenticated" />
      )
    ) : setupLoading ? (
      <div className="assessment-shell" aria-busy="true">
        <div className="assessment-skeleton assessment-skeleton--title" />
        <div className="assessment-skeleton assessment-skeleton--question" />
      </div>
    ) : setupError ? (
      <section className="assessment-shell">
        <h1>No pudimos verificar la configuración</h1>
        <p>No abrimos módulos privados mientras el estado de la empresa no sea verificable.</p>
        <button className="button" type="button" onClick={() => void setupState.refetch()}>
          Reintentar
        </button>
      </section>
    ) : setupPath ? (
      children
    ) : (
      <section className="assessment-shell assessment-gate-callout">
        <p className="eyebrow">Configuración inicial</p>
        <h1>{setupState.data ? setupStateMessage(setupState.data.state) : 'Evaluación SST'}</h1>
        <p>
          Completa o revisa el diagnóstico antes de entrar a los módulos operativos. Tu información
          histórica permanece intacta.
        </p>
        <Link
          className="button"
          href={
            setupState.data?.assessmentId
              ? `/app/evaluation/${setupState.data.assessmentId}`
              : '/app/evaluation'
          }
        >
          Continuar Evaluación SST
        </Link>
      </section>
    );
    return (
      <OrganizationContext.Provider value={context}>
        <SetupShell
          organizations={organizations.data ?? []}
          activeId={activeId}
          activeName={current?.name}
          transitioning={transitioning}
          onOrganizationChange={(id) => void setActiveId(id)}
          onLogout={() => void auth.logout().then(() => router.push('/'))}
        >
          {setupContent}
        </SetupShell>
      </OrganizationContext.Provider>
    );
  }
  return (
    <OrganizationContext.Provider value={context}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <div className="app-layout">
        <AppSidebar pathname={pathname} features={entitlements.data?.features} />
        <div className="app-main">
          <AppTopbar
            activeId={activeId}
            currentName={transitioning ? 'Cambiando organización…' : current?.name}
            currentRole={transitioning ? undefined : current?.memberships[0]?.role}
            organizations={organizations.data ?? []}
            transitioning={transitioning}
            onOrganizationChange={(id) => void setActiveId(id)}
            onLogout={() => void auth.logout().then(() => router.push('/'))}
          />
          {demoActive && !transitioning && (
            <div className="demo-banner" role="status">
              <span>
                Demostración conceptual activa
                {current.demoExpiresAt
                  ? ` hasta ${new Date(current.demoExpiresAt).toLocaleDateString('es')}`
                  : ''}
                . Los datos son sintéticos.
              </span>
              <Link href="/app/demo">Ver detalles</Link>
            </div>
          )}
          <main
            id="main-content"
            className="app-content focus-task"
            aria-busy={transitioning}
            tabIndex={-1}
          >
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
