'use client';

import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import { useEffect, useRef, type ReactNode } from 'react';
import type { AssessmentAnswer } from '@/lib/sst-assessment-types';
import {
  assessmentQuestionScopeContext,
  assessmentQuestionPurpose,
  assessmentTopicLabel,
  canSkipAssessmentQuestion,
} from '@/lib/sst-assessment-presentation';
import { AssessmentQuestionControl } from './assessment-question-control';

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
