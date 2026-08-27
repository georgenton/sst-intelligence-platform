'use client';

import type { PropsWithChildren, ReactNode } from 'react';

export function WorkspaceShell({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return <div className={`workspace-shell ${className}`.trim()}>{children}</div>;
}

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  context,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="workspace-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="workspace-lede">{description}</p>
        {context}
      </div>
      {actions ? <div className="workspace-header-actions focus-dim">{actions}</div> : null}
    </header>
  );
}

export function WorkspaceMain({ children }: PropsWithChildren) {
  return <div className="workspace-main">{children}</div>;
}

export function WorkspaceInspector({
  label = 'Contexto del registro',
  children,
  className = '',
}: PropsWithChildren<{ label?: string; className?: string }>) {
  return (
    <details className={`workspace-inspector ${className}`.trim()} open>
      <summary>{label}</summary>
      <aside aria-label={label}>{children}</aside>
    </details>
  );
}

export function WorkspaceSection({
  title,
  eyebrow,
  description,
  actions,
  children,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}>) {
  return (
    <section className="workspace-section">
      <header>
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function ContextSummary({ children }: PropsWithChildren) {
  return <div className="workspace-context-summary">{children}</div>;
}

export function TechnicalDetailsDisclosure({
  summary = 'Ver detalles técnicos',
  children,
}: PropsWithChildren<{ summary?: string }>) {
  return (
    <details className="workspace-technical-details">
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
