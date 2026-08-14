'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  appNavigationGroups,
  isNavigationItemVisible,
  resolveActiveNavigationItem,
} from '@/lib/app-navigation';

export function AppSidebar({
  pathname,
  features,
}: {
  pathname: string;
  features?: Record<string, boolean | number | string>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = resolveActiveNavigationItem(pathname);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__header">
        <Link className="app-brand" href="/app">
          <span aria-hidden="true" className="app-brand__mark">
            SI
          </span>
          <span>{process.env.NEXT_PUBLIC_APP_NAME ?? 'SST Inteligente'}</span>
        </Link>
        <button
          type="button"
          className="app-navigation-toggle"
          aria-expanded={mobileOpen}
          aria-controls="app-primary-navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'}
        </button>
      </div>
      <nav
        id="app-primary-navigation"
        className="app-navigation focus-dim focus-decorative-motion"
        data-mobile-open={mobileOpen}
        aria-label="Navegación principal"
      >
        {appNavigationGroups.map((group) => {
          const items = group.items.filter((item) => isNavigationItemVisible(item, features));
          if (items.length === 0) return null;
          const groupActive = items.some((item) => item.id === activeItem?.id);
          return (
            <section className="app-navigation__group" data-active={groupActive} key={group.id}>
              <h2>{group.label}</h2>
              <div>
                {items.map((item) => {
                  const active = item.id === activeItem?.id;
                  return (
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      data-active={active}
                      key={item.id}
                    >
                      <span aria-hidden="true" className="app-navigation__marker" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
