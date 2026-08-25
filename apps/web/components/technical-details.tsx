import type { PropsWithChildren, ReactNode } from 'react';

export function TechnicalDetails({
  summary = 'Detalles técnicos',
  children,
}: PropsWithChildren<{ summary?: ReactNode }>) {
  return (
    <details className="technical-details">
      <summary>{summary}</summary>
      <div className="technical-details__content">{children}</div>
    </details>
  );
}
