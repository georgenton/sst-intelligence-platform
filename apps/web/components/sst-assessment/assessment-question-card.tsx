'use client';

import type { SstAssessmentQuestion } from '@sst/contracts';
import type { AssessmentAnswer } from '@/lib/sst-assessment-types';
import { assessmentTopicLabel, canSkipAssessmentQuestion } from '@/lib/sst-assessment-presentation';
import { AssessmentQuestionControl } from './assessment-question-control';

export function AssessmentQuestionCard({
  question,
  disabled,
  onAnswer,
  onSkip,
}: {
  question: SstAssessmentQuestion;
  disabled: boolean;
  onAnswer(answer: AssessmentAnswer): void;
  onSkip(): void;
}) {
  return (
    <article
      className="assessment-question"
      data-question-id={question.questionId}
      data-question-type={question.valueType}
    >
      <p className="assessment-assistant">
        Quiero entender este aspecto antes de continuar con tu diagnóstico.
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
        <AssessmentQuestionControl
          key={question.questionId}
          question={question}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      </fieldset>
      {canSkipAssessmentQuestion(question) ? (
        <button className="assessment-skip" type="button" disabled={disabled} onClick={onSkip}>
          Omitir por ahora
        </button>
      ) : null}
    </article>
  );
}
