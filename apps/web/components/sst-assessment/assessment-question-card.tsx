'use client';

import type {
  SstAssessmentFact,
  SstAssessmentQuestion,
  SstAssessmentQuestionLegalBasis,
  SstAssessmentScope,
} from '@sst/contracts';
import { useEffect, useRef, type ReactNode } from 'react';
import type { AssessmentAnswer } from '@/lib/sst-assessment-types';
import {
  assessmentQuestionScopeContext,
  assessmentQuestionPurpose,
  assessmentTopicLabel,
  canSkipAssessmentQuestion,
} from '@/lib/sst-assessment-presentation';
import { AssessmentQuestionControl } from './assessment-question-control';

function jurisdictionLabel(code: string) {
  const labels: Record<string, string> = { EC: 'Ecuador', CO: 'Colombia' };
  const normalized = code.trim().toUpperCase();
  return labels[normalized] ?? (normalized || 'esta jurisdicción');
}

function AssessmentQuestionLegalBasis({
  legalBasis,
}: {
  legalBasis: SstAssessmentQuestionLegalBasis;
}) {
  if (legalBasis.status === 'VERIFIED') {
    return (
      <div className="assessment-legal-basis">
        <p className="assessment-legal-basis__label">
          <strong>Fundamento legal · {jurisdictionLabel(legalBasis.jurisdictionCode)}</strong>
        </p>
        <details>
          <summary>Ver fundamento</summary>
          {legalBasis.sources.map((source) => (
            <div key={source.sourceKey} className="assessment-legal-basis__content">
              <p>
                <strong>{source.title}</strong>
                <br />
                {source.issuer} · {source.referenceNumber}
              </p>
              <p>{source.unitLocators.join(' · ')}</p>
              <p>{legalBasis.explanation}</p>
              <p>La interpretación y aplicabilidad requieren revisión profesional.</p>
              <a href={source.officialUrl} target="_blank" rel="noreferrer">
                Ver fuente oficial
              </a>
            </div>
          ))}
        </details>
      </div>
    );
  }
  if (legalBasis.status === 'CONTEXT_REQUIRED') {
    return (
      <div className="assessment-legal-basis assessment-legal-basis--context">
        <strong>Fundamento legal</strong>
        <p>{legalBasis.explanation}</p>
      </div>
    );
  }
  if (legalBasis.status === 'JURISDICTION_NOT_SUPPORTED') {
    return (
      <div className="assessment-legal-basis assessment-legal-basis--unsupported">
        <strong>Cobertura normativa</strong>
        <p>{legalBasis.explanation}</p>
      </div>
    );
  }
  return (
    <div className="assessment-legal-basis assessment-legal-basis--context">
      <strong>Contexto de evaluación</strong>
      <p>{legalBasis.explanation}</p>
    </div>
  );
}

export function AssessmentQuestionCard({
  question,
  disabled,
  onAnswer,
  onSkip,
  focusOnMount = false,
  facts,
  scopes,
  canContinueLater = false,
  saveStatus,
  processing,
  error,
}: {
  question: SstAssessmentQuestion;
  disabled: boolean;
  onAnswer(answer: AssessmentAnswer): void;
  onSkip(): void;
  focusOnMount?: boolean;
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  canContinueLater?: boolean;
  saveStatus?: ReactNode;
  processing?: ReactNode;
  error?: string;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const purpose = assessmentQuestionPurpose(question);
  const scopeContext = assessmentQuestionScopeContext(question, facts, scopes);
  const scopeId = `assessment-scope-${question.questionId}`;
  const sensitiveHelp = [
    'organization.psychosocialReviewNeeded',
    'organization.stressExposedRolesPresent',
    'organization.additionalContext',
  ].includes(question.factKey);

  useEffect(() => {
    if (!focusOnMount) return;
    const card = cardRef.current;
    const target = card?.querySelector<HTMLElement>('input, select, textarea, button') ?? card;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [focusOnMount, question.questionId]);

  return (
    <article
      ref={cardRef}
      className="assessment-question"
      data-question-id={question.questionId}
      data-question-type={question.valueType}
      tabIndex={-1}
      aria-busy={disabled}
    >
      {scopeContext ? (
        <div className="assessment-question__scope" id={scopeId}>
          <strong>{scopeContext.label}</strong>
          <span>{scopeContext.name}</span>
          <p>{scopeContext.summary}</p>
        </div>
      ) : null}
      <fieldset disabled={disabled} aria-describedby={scopeContext ? scopeId : undefined}>
        <legend>
          <span>{assessmentTopicLabel(question.topic)}</span>
          {question.questionText}
        </legend>
        <div className="assessment-why">
          <p>
            <strong>Por qué lo preguntamos. </strong>
            {purpose}
          </p>
        </div>
        {question.legalBasis ? (
          <AssessmentQuestionLegalBasis legalBasis={question.legalBasis} />
        ) : null}
        {sensitiveHelp && question.helpText !== purpose ? (
          <p className="assessment-safety-note">{question.helpText}</p>
        ) : null}
        <AssessmentQuestionControl
          key={question.questionId}
          question={question}
          disabled={disabled}
          onAnswer={onAnswer}
          saveStatus={saveStatus}
          secondaryAction={
            canSkipAssessmentQuestion(question) ? (
              <button
                className="assessment-skip"
                type="button"
                disabled={disabled}
                onClick={onSkip}
              >
                Responder después
              </button>
            ) : undefined
          }
        />
      </fieldset>
      {canSkipAssessmentQuestion(question) ? (
        <div className="assessment-defer">
          <small>“No lo sé” guarda esa respuesta; “Responder después” no crea ningún dato.</small>
        </div>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {processing}
      {canContinueLater ? (
        <a className="assessment-continue-later" href="/">
          Continuar después
        </a>
      ) : null}
    </article>
  );
}
