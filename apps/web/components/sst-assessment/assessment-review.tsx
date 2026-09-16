import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import type { ReactNode } from 'react';
import {
  assessmentWorkerCountMismatch,
  editableQuestionForFact,
  groupAssessmentContext,
  assessmentTopicLabel,
} from '@/lib/sst-assessment-presentation';

export function AssessmentReview({
  facts,
  scopes,
  busy,
  hasOptionalContext,
  onConfirm,
  onEdit,
  onAddOptionalContext,
  optionalQuestions = [],
  saveStatus,
  processing,
}: {
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  busy: boolean;
  hasOptionalContext: boolean;
  onConfirm(): void;
  onEdit(question: SstAssessmentQuestion): void;
  onAddOptionalContext(): void;
  optionalQuestions?: readonly SstAssessmentQuestion[];
  saveStatus?: ReactNode;
  processing?: ReactNode;
}) {
  const groups = groupAssessmentContext(facts, scopes);
  const workerCountMismatch = assessmentWorkerCountMismatch(facts, scopes);
  return (
    <section
      className="assessment-review"
      aria-labelledby="assessment-review-title"
      aria-busy={busy}
    >
      <div className="assessment-review__ready">
        <strong>✓ Información mínima para el diagnóstico completada</strong>
        <p>Puedes confirmar ahora. Profundizar el contexto es opcional.</p>
      </div>
      <h2 id="assessment-review-title">Esto es lo que entendimos de tu empresa</h2>
      <div className="assessment-review__columns">
        <div>
          <h3>Listo para diagnóstico</h3>
          <div className="assessment-review__summary">
            {groups.map((group) => {
              const scope = scopes.find(({ scopeKey }) => scopeKey === group.scopeKey)!;
              const editable = facts
                .filter(({ scopeKey }) => scopeKey === group.scopeKey)
                .map((fact) => editableQuestionForFact(fact, scope))
                .find((question) => question !== null);
              return (
                <div key={group.scopeKey}>
                  <span>{group.title}</span>
                  <strong>
                    {group.factCount}{' '}
                    {group.factCount === 1 ? 'dato confirmado' : 'datos confirmados'}
                  </strong>
                  <p>{group.summary}</p>
                  {editable ? (
                    <button type="button" disabled={busy} onClick={() => onEdit(editable)}>
                      Revisar y corregir
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="assessment-review__optional">
          <h3>Contexto que puede profundizarse</h3>
          <p>Opcional · Puedes añadirlo ahora o seguir con la información confirmada.</p>
          <ul>
            {[
              ...new Set(
                optionalQuestions
                  .filter(({ collectionPolicy }) => collectionPolicy !== 'COMMERCIAL_OPTIONAL')
                  .map(({ topic }) => assessmentTopicLabel(topic)),
              ),
            ].map((label) => (
              <li key={label}>
                <span aria-hidden="true">＋</span> {label}
              </li>
            ))}
          </ul>
          {facts.some(({ answerState }) => answerState === 'EXPLICIT_UNKNOWN') ? (
            <p>
              “Aún no lo sabemos” es una respuesta válida. Puedes revisarla cuando tengas más
              información.
            </p>
          ) : null}
        </div>
      </div>
      {workerCountMismatch ? (
        <p className="assessment-review__notice">
          <strong>Revisa la distribución de personas.</strong> {workerCountMismatch}
        </p>
      ) : null}
      <p className="assessment-context__note">
        El diagnóstico es orientativo. La configuración del espacio es un paso posterior y
        explícito.
      </p>
      <div className="assessment-actions">
        {saveStatus}
        <button type="button" className="button" disabled={busy} onClick={onConfirm}>
          {busy ? 'Generando diagnóstico…' : 'Confirmar y generar diagnóstico'}
        </button>
        {hasOptionalContext ? (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onAddOptionalContext}
          >
            Añadir contexto opcional
          </button>
        ) : null}
      </div>
      {processing}
    </section>
  );
}
