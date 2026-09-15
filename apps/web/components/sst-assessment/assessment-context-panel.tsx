'use client';

import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import { useRef, useState } from 'react';
import {
  editableQuestionForFact,
  groupAssessmentContext,
  visibleFactSummaries,
} from '@/lib/sst-assessment-presentation';

function GroupDetails({
  scopeKey,
  facts,
  scopes,
  readOnly,
  onEdit,
}: {
  scopeKey?: string;
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  readOnly: boolean;
  onEdit(question: SstAssessmentQuestion): void;
}) {
  const summaries = visibleFactSummaries(facts, scopes).filter(
    (item) => !scopeKey || item.scopeKey === scopeKey,
  );
  const scopeMap = new Map(scopes.map((scope) => [scope.scopeKey, scope]));
  if (summaries.length === 0) return <p>Aún estamos construyendo el contexto.</p>;
  return (
    <div className="assessment-context__facts">
      {summaries.map((item) => {
        const fact = facts.find(
          ({ scopeKey: factScopeKey, factKey }) =>
            factScopeKey === item.scopeKey && factKey === item.factKey,
        )!;
        const scope = scopeMap.get(item.scopeKey)!;
        const editable = readOnly ? null : editableQuestionForFact(fact, scope);
        return (
          <div key={item.identity}>
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
  const [selectedScopeKey, setSelectedScopeKey] = useState<string>();
  const groups = groupAssessmentContext(facts, scopes);
  const visibleCount = groups.reduce((total, group) => total + group.factCount, 0);
  const selectedGroup = groups.find(({ scopeKey }) => scopeKey === selectedScopeKey);

  function openDialog(scopeKey?: string) {
    setSelectedScopeKey(scopeKey);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setSelectedScopeKey(undefined);
    triggerRef.current?.focus();
  }

  return (
    <>
      <section className="assessment-context assessment-context--desktop">
        <h2>Contexto confirmado</h2>
        {groups.length === 0 ? <p>Aún estamos construyendo el contexto.</p> : null}
        <div className="assessment-context__groups">
          {groups.map((group) => (
            <button key={group.scopeKey} type="button" onClick={() => openDialog(group.scopeKey)}>
              <span>{group.title}</span>
              <strong>
                {group.factCount} {group.factCount === 1 ? 'dato' : 'datos'}
              </strong>
              <small>{group.summary}</small>
              <em>Ver detalle y corregir</em>
            </button>
          ))}
        </div>
      </section>
      <div className="assessment-context-mobile">
        <button
          ref={triggerRef}
          className="assessment-context-mobile__trigger"
          type="button"
          onClick={() => openDialog()}
        >
          Contexto · {visibleCount} {visibleCount === 1 ? 'dato' : 'datos'}
        </button>
      </div>
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
          <div>
            <span>Contexto confirmado</span>
            <h2 id="assessment-context-dialog-title">{selectedGroup?.title ?? 'Tu evaluación'}</h2>
          </div>
          <button type="button" aria-label="Cerrar contexto" onClick={closeDialog}>
            Cerrar
          </button>
        </div>
        {selectedGroup ? (
          <GroupDetails
            scopeKey={selectedGroup.scopeKey}
            facts={facts}
            scopes={scopes}
            readOnly={readOnly}
            onEdit={(question) => {
              dialogRef.current?.close();
              onEdit(question);
            }}
          />
        ) : (
          groups.map((group) => (
            <section key={group.scopeKey} className="assessment-context-dialog__group">
              <h3>
                {group.title} · {group.factCount} {group.factCount === 1 ? 'dato' : 'datos'}
              </h3>
              <GroupDetails
                scopeKey={group.scopeKey}
                facts={facts}
                scopes={scopes}
                readOnly={readOnly}
                onEdit={(question) => {
                  dialogRef.current?.close();
                  onEdit(question);
                }}
              />
            </section>
          ))
        )}
      </dialog>
    </>
  );
}
