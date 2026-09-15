'use client';

import type { SstAssessmentFact, SstAssessmentQuestion, SstAssessmentScope } from '@sst/contracts';
import { useEffect, useRef } from 'react';
import type { AssessmentAnswer } from '@/lib/sst-assessment-types';
import {
  assessmentQuestionScopeContext,
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
}: {
  question: SstAssessmentQuestion;
  disabled: boolean;
  onAnswer(answer: AssessmentAnswer): void;
  onSkip(): void;
  focusOnMount?: boolean;
  facts: readonly SstAssessmentFact[];
  scopes: readonly SstAssessmentScope[];
  canContinueLater?: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const scopeContext = assessmentQuestionScopeContext(question, facts, scopes);
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
    >
      {scopeContext ? (
        <div className="assessment-question__scope" aria-live="polite">
          <strong>{scopeContext.label}</strong>
          <span>{scopeContext.name}</span>
          <p>{scopeContext.summary}</p>
        </div>
      ) : null}
      <p className="assessment-assistant">
        {assessmentTopicLabel(question.topic) === 'Operación'
          ? 'Ahora revisaremos cómo funciona la operación de este centro.'
          : assessmentTopicLabel(question.topic) === 'Gestión'
            ? 'Ahora revisaremos cómo se organiza y da seguimiento a la gestión SST.'
            : 'Quiero entender este aspecto antes de continuar con tu diagnóstico.'}
      </p>
      <fieldset disabled={disabled}>
        <legend>
          <span>{assessmentTopicLabel(question.topic)}</span>
          {question.questionText}
        </legend>
        <details className="assessment-why">
          <summary>¿Por qué te pregunto esto?</summary>
          <p>{question.purpose || question.helpText}</p>
        </details>
        {sensitiveHelp ? <p className="assessment-safety-note">{question.helpText}</p> : null}
        <AssessmentQuestionControl
          key={question.questionId}
          question={question}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      </fieldset>
      {canSkipAssessmentQuestion(question) ? (
        <div className="assessment-defer">
          <button className="assessment-skip" type="button" disabled={disabled} onClick={onSkip}>
            Responder después
          </button>
          <small>“No lo sé” guarda esa respuesta; “Responder después” no crea ningún dato.</small>
        </div>
      ) : null}
      {canContinueLater ? (
        <a className="assessment-continue-later" href="/">
          Continuar después
        </a>
      ) : null}
    </article>
  );
}
