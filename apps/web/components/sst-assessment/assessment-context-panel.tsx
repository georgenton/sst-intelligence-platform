import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import { editableQuestionForFact, visibleFactSummaries } from '@/lib/sst-assessment-presentation';

export function AssessmentContextPanel({
  facts,
  scopes,
  onEdit,
}: {
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  onEdit(question: SstAssessmentQuestion): void;
}) {
  const summaries = visibleFactSummaries(facts, scopes);
  const scopeMap = new Map(scopes.map((scope) => [scope.scopeKey, scope]));
  return (
    <details className="assessment-context" open>
      <summary>Lo que ya sabemos</summary>
      {summaries.length === 0 ? (
        <p>Aún estamos construyendo el contexto.</p>
      ) : (
        <div className="assessment-context__facts">
          {summaries.map((item) => {
            const fact = facts.find(
              ({ scopeKey, factKey }) => scopeKey === item.scopeKey && factKey === item.factKey,
            )!;
            const scope = scopeMap.get(item.scopeKey)!;
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
      )}
    </details>
  );
}
