'use client';

import Link from 'next/link';
import type { PropsWithChildren } from 'react';

export function SetupShell({
  children,
  organizations,
  activeId,
  activeName,
  transitioning,
  onOrganizationChange,
  onLogout,
}: PropsWithChildren<{
  organizations: Array<{ id: string; name: string }>;
  activeId: string | null;
  activeName?: string;
  transitioning: boolean;
  onOrganizationChange(id: string): void;
  onLogout(): void;
}>) {
  return (
    <div className="setup-layout">
      <a className="skip-link" href="#setup-main">
        Saltar al contenido principal
      </a>
      <header className="setup-header">
        <Link className="app-brand" href="/app/evaluation">
          <span className="app-brand__mark" aria-hidden="true">
            SI
          </span>
          <span>{process.env.NEXT_PUBLIC_APP_NAME ?? 'SST Inteligente'}</span>
        </Link>
        <nav aria-label="Configuración inicial">
          <Link href="/app/evaluation">Evaluación SST</Link>
          {activeId ? <Link href="/app/organizations">Empresa</Link> : null}
          <Link href="/">Ayuda</Link>
        </nav>
        {organizations.length ? (
          <label className="setup-organization">
            <span>Cambiar organización</span>
            <select
              aria-label="Organización activa"
              value={transitioning ? '' : (activeId ?? '')}
              disabled={transitioning}
              onChange={(event) => onOrganizationChange(event.target.value)}
            >
              <option value="">Selecciona una empresa</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="button secondary" type="button" onClick={onLogout}>
          Cerrar sesión
        </button>
      </header>
      <div className="setup-context" role="status">
        {transitioning
          ? 'Cambiando empresa…'
          : activeName
            ? `Configurando ${activeName}`
            : 'Configuración inicial'}
      </div>
      <main id="setup-main" className="setup-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
