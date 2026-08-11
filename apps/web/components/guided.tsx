import type { PropsWithChildren, ReactNode } from 'react';

export function GuidedFlow({ children }: PropsWithChildren) {
  return <div className="card stack">{children}</div>;
}

export function GuidedStep({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <section className="stack" aria-labelledby="step-title">
      <div>
        <p className="eyebrow">Diagnóstico guiado</p>
        <h2 id="step-title">{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function GuidedQuestion({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="stack">
      <legend className="legend">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function ProgressIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div aria-label={`Paso ${step} de ${total}`}>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <p className="muted">
        Paso {step} de {total}
      </p>
    </div>
  );
}

export const SessionPersistence = {
  save(id: string, token: string) {
    window.localStorage.setItem(`solution-session:${id}`, token);
  },
  load(id: string) {
    return window.localStorage.getItem(`solution-session:${id}`);
  },
};

export function RecommendationSummary({ children }: PropsWithChildren) {
  return (
    <section className="card stack" aria-labelledby="recommendation-title">
      <h2 id="recommendation-title">Recomendación</h2>
      {children}
    </section>
  );
}
