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
  setActiveId(id: string): void;
  organizations: Organization[];
  loading: boolean;
};
const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function AppShell({ children }: PropsWithChildren) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const organizations = useQuery({
    queryKey: ['organizations', auth.user?.id],
    queryFn: () => auth.request<Organization[]>('/organizations'),
    enabled: Boolean(auth.user && auth.accessToken),
  });

  useEffect(() => {
    if (!auth.loading && !auth.user)
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.loading, auth.user, pathname, router]);
  useEffect(() => {
    if (!organizations.data?.length) return;
    const stored = window.localStorage.getItem('active-organization-id');
    const valid = organizations.data.some((item) => item.id === stored);
    setActiveIdState(valid ? stored : organizations.data[0]!.id);
  }, [organizations.data]);

  function setActiveId(id: string) {
    window.localStorage.setItem('active-organization-id', id);
    setActiveIdState(id);
    void queryClient.invalidateQueries();
  }
  const current = organizations.data?.find((item) => item.id === activeId);
  const demoActive =
    current?.status === 'DEMO' &&
    current.demoExpiresAt !== undefined &&
    new Date(current.demoExpiresAt).getTime() > Date.now();
  const context = useMemo(
    () => ({
      activeId,
      setActiveId,
      organizations: organizations.data ?? [],
      loading: organizations.isLoading,
    }),
    [activeId, organizations.data, organizations.isLoading],
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
              value={activeId ?? ''}
              onChange={(event) => setActiveId(event.target.value)}
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
          <main className="app-content">{children}</main>
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
