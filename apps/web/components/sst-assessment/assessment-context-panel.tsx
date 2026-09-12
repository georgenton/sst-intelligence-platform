'use client';

import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import { useRef } from 'react';
import { editableQuestionForFact, visibleFactSummaries } from '@/lib/sst-assessment-presentation';

function ContextFacts({
  facts,
  scopes,
  readOnly,
  onEdit,
}: {
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  readOnly: boolean;
  onEdit(question: SstAssessmentQuestion): void;
}) {
  const summaries = visibleFactSummaries(facts, scopes);
  const scopeMap = new Map(scopes.map((scope) => [scope.scopeKey, scope]));
  if (summaries.length === 0) return <p>Aún estamos construyendo el contexto.</p>;
  return (
    <div className="assessment-context__facts">
      {summaries.map((item) => {
        const fact = facts.find(
          ({ scopeKey, factKey }) => scopeKey === item.scopeKey && factKey === item.factKey,
        )!;
        const scope = scopeMap.get(item.scopeKey)!;
        const editable = readOnly ? null : editableQuestionForFact(fact, scope);
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
  );
}

export function AssessmentContextPanel({
  facts,
  scopes,
  onEdit,
  readOnly = false,
}: {
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  onEdit(question: SstAssessmentQuestion): void;
  readOnly?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visibleCount = visibleFactSummaries(facts, scopes).length;

  function closeDialog() {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  return (
    <>
      <section className="assessment-context assessment-context--desktop">
        <h2>Lo que ya sabemos</h2>
        <ContextFacts facts={facts} scopes={scopes} readOnly={readOnly} onEdit={onEdit} />
      </section>
      <div className="assessment-context-mobile">
        <button
          ref={triggerRef}
          className="assessment-context-mobile__trigger"
          type="button"
          onClick={() => dialogRef.current?.showModal()}
        >
          Ver lo que ya sabemos · {visibleCount} {visibleCount === 1 ? 'dato' : 'datos'}
        </button>
        <dialog
          ref={dialogRef}
          className="assessment-context-dialog"
          aria-labelledby="assessment-context-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
        >
          <div className="assessment-context-dialog__header">
            <h2 id="assessment-context-dialog-title">Lo que ya sabemos</h2>
            <button type="button" aria-label="Cerrar contexto" onClick={closeDialog}>
              Cerrar
            </button>
          </div>
          <ContextFacts
            facts={facts}
            scopes={scopes}
            readOnly={readOnly}
            onEdit={(question) => {
              dialogRef.current?.close();
              onEdit(question);
            }}
          />
        </dialog>
      </div>
    </>
  );
}
