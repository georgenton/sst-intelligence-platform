'use client';

import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { AssessmentContextChange } from '@/lib/sst-assessment-visual-feedback';
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
            <p data-unknown={fact.answerState === 'EXPLICIT_UNKNOWN'}>{item.value}</p>
            {editable ? (
              <button type="button" onClick={() => onEdit(editable)}>
                {fact.answerState === 'EXPLICIT_UNKNOWN' ? 'Responder' : 'Corregir'}
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
  activeScopeKey,
  changes = [],
  disabled = false,
}: {
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  onEdit(question: SstAssessmentQuestion): void;
  readOnly?: boolean;
  activeScopeKey?: string;
  changes?: readonly AssessmentContextChange[];
  disabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [selectedScopeKey, setSelectedScopeKey] = useState<string>();
  const groups = groupAssessmentContext(facts, scopes);
  const visibleCount = groups.reduce((total, group) => total + group.factCount, 0);
  const selectedGroup = groups.find(({ scopeKey }) => scopeKey === selectedScopeKey);

  useEffect(() => {
    if (disabled && dialogRef.current?.open) closeDialog();
  }, [disabled]);

  function openDialog(scopeKey?: string) {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setSelectedScopeKey(scopeKey);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setSelectedScopeKey(undefined);
    triggerRef.current?.focus();
  }

  function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (
      first &&
      last &&
      ((event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last))
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  const groupCards = (
    <div className="assessment-context__groups">
      {groups.map((group) => (
        <button
          key={group.scopeKey}
          type="button"
          disabled={disabled}
          data-active={group.scopeKey === activeScopeKey}
          onClick={() => openDialog(group.scopeKey)}
        >
          <span className="assessment-context__group-heading">
            <strong>{group.title}</strong>
            <span
              className="assessment-context__count"
              aria-label={`${group.factCount} datos confirmados`}
            >
              {group.factCount}
            </span>
          </span>
          <small>{group.summary}</small>
          <span className="assessment-context__change" aria-hidden="true">
            {changes
              .filter(({ scopeKey }) => scopeKey === group.scopeKey)
              .slice(-1)
              .map((change) => (
                <span key={change.identity}>
                  ✓ {change.kind === 'added' ? 'Se agregó' : 'Actualizado'}: {change.text}
                </span>
              ))}
          </span>
          <em>Ver detalle y corregir</em>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section className="assessment-context assessment-context--desktop">
        <div className="assessment-context__heading">
          <h2>Contexto confirmado</h2>
          <span className="assessment-context__count">{visibleCount} datos</span>
        </div>
        {groups.length === 0 ? <p>Aún estamos construyendo el contexto.</p> : null}
        {groupCards}
        <p className="assessment-context__note">
          Solo mostramos lo que confirmaste o marcaste como desconocido.
        </p>
      </section>
      <details className="assessment-context-tablet">
        <summary>Contexto confirmado · {visibleCount} datos</summary>
        {groupCards}
      </details>
      <div className="assessment-context-mobile">
        <button
          className="assessment-context-mobile__trigger"
          type="button"
          disabled={disabled}
          onClick={() => openDialog()}
        >
          Contexto · {visibleCount} {visibleCount === 1 ? 'dato' : 'datos'}
        </button>
        <div className="assessment-context__change">
          {changes.slice(-1).map((change) => (
            <span key={change.identity}>
              ✓ {change.kind === 'added' ? 'Se agregó' : 'Actualizado'}: {change.text}
            </span>
          ))}
        </div>
      </div>
      <dialog
        ref={dialogRef}
        className="assessment-context-dialog"
        aria-labelledby="assessment-context-dialog-title"
        aria-modal="true"
        onKeyDown={trapDialogFocus}
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
        <p className="assessment-context__note">
          Corregir vuelve a evaluar la información y puede adaptar las siguientes preguntas.
        </p>
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
