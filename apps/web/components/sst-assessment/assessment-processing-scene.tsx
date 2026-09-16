'use client';

import { useEffect, useState } from 'react';

export function AssessmentProcessingScene({
  busy,
  status,
  answerText,
}: {
  busy: boolean;
  status: 'idle' | 'saving' | 'evaluating' | 'saved';
  answerText?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    // Only reveal a slow operation. This timer never gates requests or advancement.
    const threshold = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(threshold);
  }, [busy]);
  if (!busy || !visible) return null;
  return (
    <div className="assessment-processing" data-processing-state={status}>
      <div className="assessment-processing__panel">
        <span className="assessment-processing__spinner" aria-hidden="true" />
        <h2>Estamos incorporando tu respuesta</h2>
        {answerText ? (
          <p className="assessment-processing__answer">
            <span>Tu respuesta</span>
            <strong>{answerText}</strong>
          </p>
        ) : null}
        <ol>
          <li data-state={status === 'saving' ? 'active' : 'complete'}>
            <span aria-hidden="true">{status === 'saving' ? '●' : '✓'}</span> Guardando la respuesta
          </li>
          <li data-state={status === 'evaluating' ? 'active' : 'pending'}>
            <span aria-hidden="true">{status === 'evaluating' ? '●' : '○'}</span> Actualizando el
            contexto
          </li>
          <li data-state="pending">
            <span aria-hidden="true">○</span> Preparando la siguiente pregunta relevante
          </li>
        </ol>
        <p>No hace falta volver a responder. Tu selección sigue visible.</p>
      </div>
    </div>
  );
}
