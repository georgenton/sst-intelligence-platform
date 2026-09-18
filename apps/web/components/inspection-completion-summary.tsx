'use client';

import { INSPECTION_CRITERION_OUTCOME_LABELS } from '@/lib/inspection-standard-presentation';
import type { Inspection } from './inspections-ui';

export function InspectionCompletionSummary({ inspection }: { inspection: Inspection }) {
  const results = inspection.criterionResults ?? [];
  const recorded = results.filter(({ hasRecordedResult }) => hasRecordedResult);
  const findings = inspection.findings ?? [];
  const pendingActions = findings
    .flatMap(({ actions }) => actions)
    .filter(({ status }) => !['COMPLETED', 'CANCELED'].includes(status));
  return (
    <div className="inspection-review-list">
      <h3>Resumen del recorrido</h3>
      <p>
        {recorded.length} de {results.length} criterios registrados ·{' '}
        {results.length - recorded.length} sin registrar.
      </p>
      <dl className="inspection-action-meta">
        {Object.entries(INSPECTION_CRITERION_OUTCOME_LABELS).map(([outcome, label]) => (
          <div key={outcome}>
            <dt>{label}</dt>
            <dd>{recorded.filter((result) => result.outcome === outcome).length}</dd>
          </div>
        ))}
        <div>
          <dt>Hallazgos abiertos</dt>
          <dd>{findings.filter(({ status }) => status !== 'CLOSED').length}</dd>
        </div>
        <div>
          <dt>Acciones pendientes</dt>
          <dd>{pendingActions.length}</dd>
        </div>
      </dl>
      <p className="inspection-invariant-note">
        Completar termina el recorrido. Ejecutar una acción, verificar un hallazgo y completar la
        inspección son actos distintos. Los pendientes conservan su seguimiento en la Cola de
        trabajo.
      </p>
    </div>
  );
}
