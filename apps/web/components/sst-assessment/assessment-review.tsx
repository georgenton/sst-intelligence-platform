import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import { visibleFactSummaries, editableQuestionForFact } from '@/lib/sst-assessment-presentation';

export function AssessmentReview({
  facts,
  scopes,
  busy,
  hasOptionalContext,
  onConfirm,
  onEdit,
  onAddOptionalContext,
}: {
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  busy: boolean;
  hasOptionalContext: boolean;
  onConfirm(): void;
  onEdit(question: SstAssessmentQuestion): void;
  onAddOptionalContext(): void;
}) {
  const summaries = visibleFactSummaries(facts, scopes);
  return (
    <section className="assessment-review" aria-labelledby="assessment-review-title">
      <p className="assessment-assistant">
        Ya tenemos la información necesaria para preparar el diagnóstico.
      </p>
      <h2 id="assessment-review-title">Esto es lo que entendimos de tu empresa</h2>
      <div className="assessment-review__summary">
        {summaries.map((item) => {
          const fact = facts.find(
            ({ scopeKey, factKey }) => scopeKey === item.scopeKey && factKey === item.factKey,
          )!;
          const scope = scopes.find(({ scopeKey }) => scopeKey === item.scopeKey)!;
          const editable = editableQuestionForFact(fact, scope);
          return (
            <div key={item.identity}>
              <span>{item.scopeName}</span>
              <strong>{item.label}</strong>
              <p>{item.value}</p>
              {editable ? (
                <button type="button" onClick={() => onEdit(editable)}>
                  Corregir
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="assessment-actions">
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
    </section>
  );
}
