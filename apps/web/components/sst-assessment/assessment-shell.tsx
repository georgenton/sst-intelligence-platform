import type { PropsWithChildren, ReactNode } from 'react';

export function AssessmentShell({
  eyebrow = 'Evaluación SST',
  title,
  description,
  aside,
  progress,
  scope,
  children,
}: PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description: string;
  aside?: ReactNode;
  progress?: ReactNode;
  scope?: ReactNode;
}>) {
  return (
    <section className="assessment-shell" aria-labelledby="assessment-title">
      <header className="assessment-shell__header">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="assessment-title">{title}</h1>
        <p>{description}</p>
      </header>
      {scope}
      {progress}
      <div className="assessment-shell__layout" data-has-aside={Boolean(aside)}>
        <div className="assessment-shell__conversation">{children}</div>
        {aside ? <aside className="assessment-shell__aside">{aside}</aside> : null}
      </div>
    </section>
  );
}

export function AssessmentSkeleton() {
  return (
    <div className="assessment-shell" aria-label="Recuperando Evaluación SST" aria-busy="true">
      <div className="assessment-skeleton assessment-skeleton--title" />
      <div className="assessment-skeleton assessment-skeleton--progress" />
      <div className="assessment-shell__layout">
        <div className="assessment-skeleton assessment-skeleton--question" />
        <div className="assessment-skeleton assessment-skeleton--context" />
      </div>
    </div>
  );
}
