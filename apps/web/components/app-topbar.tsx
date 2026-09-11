'use client';

import Link from 'next/link';
import { AppearanceControls } from './appearance-provider';
import { humanRoleLabel } from '@/lib/human-lexicon';

type OrganizationOption = { id: string; name: string };

export function AppTopbar({
  activeId,
  currentName,
  currentRole,
  organizations,
  transitioning,
  onOrganizationChange,
  onLogout,
}: {
  activeId: string | null;
  currentName?: string;
  currentRole?: string;
  organizations: OrganizationOption[];
  transitioning: boolean;
  onOrganizationChange(id: string): void;
  onLogout(): void;
}) {
  return (
    <header className="app-topbar">
      <div className="app-context-summary">
        <span className="app-context-summary__label">Organización activa</span>
        <strong>{currentName ?? 'Sin organización'}</strong>
        <span>{currentRole ? humanRoleLabel(currentRole) : 'Selecciona una organización'}</span>
      </div>
      <label className="app-organization-control">
        <span>Cambiar organización</span>
        <select
          className="org-select"
          aria-label="Organización activa"
          value={transitioning ? '' : (activeId ?? '')}
          disabled={transitioning}
          aria-busy={transitioning}
          onChange={(event) => onOrganizationChange(event.target.value)}
        >
          <option value="">Selecciona una organización</option>
          {organizations.map((organization) => (
            <option value={organization.id} key={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      <AppearanceControls />
      <div className="app-topbar__actions">
        <Link className="button secondary" href="/app/setup/new-company">
          Agregar empresa
        </Link>
        <button className="button secondary" type="button" onClick={onLogout}>
          Salir
        </button>
      </div>
    </header>
  );
}
