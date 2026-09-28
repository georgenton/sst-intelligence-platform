'use client';

import type { SstAssessmentQuestion } from '@sst/contracts';
import { useRef, useState, type ReactNode } from 'react';
import { explicitBooleanChoices, questionBounds } from '@/lib/sst-assessment-presentation';
import type { AssessmentAnswer } from '@/lib/sst-assessment-types';

export function AssessmentQuestionControl({
  question,
  disabled,
  onAnswer,
  saveStatus,
  secondaryAction,
}: {
  question: SstAssessmentQuestion;
  disabled: boolean;
  onAnswer(answer: AssessmentAnswer): void;
  saveStatus?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  const [value, setValue] = useState<string | string[]>(
    question.valueType === 'MULTI_CHOICE' ? [] : '',
  );
  const [validation, setValidation] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const bounds = questionBounds(question.factKey);
  const base = { scopeKey: question.scopeKey, factKey: question.factKey };
  const inputId = `assessment-answer-${question.questionId}`;
  const errorId = `${inputId}-error`;
  const isRadio = question.valueType === 'BOOLEAN' || question.valueType === 'SINGLE_CHOICE';
  const radioChoices =
    question.valueType === 'BOOLEAN'
      ? explicitBooleanChoices(question.unknownAllowed).map((choice) => ({
          label: choice.label,
          value: choice.value === 'EXPLICIT_UNKNOWN' ? 'EXPLICIT_UNKNOWN' : String(choice.value),
        }))
      : [
          ...question.choices,
          ...(question.unknownAllowed ? [{ label: 'No lo sé', value: 'EXPLICIT_UNKNOWN' }] : []),
        ];
  const hasAnswer = Array.isArray(value) ? value.length > 0 : value.trim().length > 0;

  function invalid(message: string) {
    setValidation(message);
    editorRef.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
  }
  function submit() {
    setValidation('');
    if (isRadio) {
      if (!hasAnswer) return invalid('Selecciona una opción para continuar.');
      if (value === 'EXPLICIT_UNKNOWN')
        return onAnswer({ ...base, answerState: 'EXPLICIT_UNKNOWN' });
      return onAnswer({
        ...base,
        answerState: 'KNOWN',
        value: question.valueType === 'BOOLEAN' ? value === 'true' : value,
      });
    }
    if (question.valueType === 'MULTI_CHOICE') {
      if (!Array.isArray(value) || value.length === 0)
        return invalid('Selecciona al menos una opción para continuar.');
      onAnswer({ ...base, answerState: 'KNOWN', value });
      return;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return invalid('Completa este campo o indica que aún no tienes la información.');
    if (question.valueType === 'INTEGER') {
      const number = Number(text);
      if (
        !Number.isInteger(number) ||
        (bounds.min !== undefined && number < bounds.min) ||
        (bounds.max !== undefined && number > bounds.max)
      ) {
        return invalid(
          `Ingresa un número entero${bounds.min !== undefined ? ` desde ${bounds.min}` : ''}${bounds.max !== undefined ? ` hasta ${bounds.max}` : ''}.`,
        );
      }
      onAnswer({ ...base, answerState: 'KNOWN', value: number });
      return;
    }
    if (bounds.maxLength !== undefined && text.length > bounds.maxLength)
      return invalid(`Usa máximo ${bounds.maxLength} caracteres.`);
    onAnswer({ ...base, answerState: 'KNOWN', value: text });
  }
  const inputProps = {
    id: inputId,
    'aria-label': question.valueType === 'INTEGER' ? 'Respuesta numérica' : 'Respuesta',
    'aria-invalid': Boolean(validation),
    'aria-describedby': validation ? errorId : undefined,
    value: typeof value === 'string' ? value : '',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(event.target.value);
      setValidation('');
    },
    disabled,
  };

  return (
    <div className="assessment-response-editor" ref={editorRef}>
      {isRadio ? (
        <div
          className={`assessment-choice-grid${question.valueType === 'BOOLEAN' ? ' assessment-choice-grid--boolean' : ''}`}
          role="radiogroup"
          aria-label="Opciones disponibles"
        >
          {radioChoices.map((choice) => (
            <label
              key={choice.value}
              className="assessment-option"
              data-selected={value === choice.value}
            >
              <input
                type="radio"
                name={inputId}
                value={choice.value}
                checked={value === choice.value}
                disabled={disabled}
                onChange={() => setValue(choice.value)}
              />
              <span className="assessment-option__marker" aria-hidden="true" />
              <span className="assessment-option__label">{choice.label}</span>
            </label>
          ))}
        </div>
      ) : question.valueType === 'MULTI_CHOICE' ? (
        <div
          className="assessment-choice-grid"
          aria-label="Opciones disponibles"
          aria-describedby={validation ? errorId : undefined}
        >
          {question.choices.map((choice) => {
            const selected = Array.isArray(value) && value.includes(choice.value);
            return (
              <button
                type="button"
                key={choice.value}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() =>
                  setValue((current) => {
                    const choices = Array.isArray(current) ? current : [];
                    return selected
                      ? choices.filter((item) => item !== choice.value)
                      : [...choices, choice.value];
                  })
                }
              >
                <span aria-hidden="true">{selected ? '✓' : '+'}</span> {choice.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="assessment-answer-field">
          <label htmlFor={inputId}>
            {question.valueType === 'INTEGER' ? 'Respuesta numérica' : 'Respuesta'}
          </label>
          {question.valueType === 'INTEGER' ? (
            <input
              {...inputProps}
              type="number"
              step={1}
              min={bounds.min}
              max={bounds.max}
              inputMode="numeric"
            />
          ) : [
              'organization.activityDescription',
              'organization.additionalContext',
              'workCenter.activityDescription',
            ].includes(question.factKey) ? (
            <textarea
              {...inputProps}
              rows={question.factKey === 'organization.additionalContext' ? 5 : 3}
            />
          ) : (
            <input
              {...inputProps}
              type="text"
              autoComplete={
                question.factKey === 'organization.country' ? 'country-name' : undefined
              }
              placeholder={
                question.factKey === 'organization.country'
                  ? 'Ej. Ecuador'
                  : question.factKey === 'organization.sector'
                    ? 'Ej. Manufactura, servicios, construcción'
                    : undefined
              }
            />
          )}
        </div>
      )}
      {question.factKey === 'organization.additionalContext' ? (
        <p className="assessment-privacy-note">
          Lo guardaremos como contexto y no como una conclusión. No incluyas datos personales,
          médicos, psicosociales individuales, investigaciones privilegiadas, archivos ni
          credenciales.
        </p>
      ) : null}
      {question.factKey === 'organization.strategicProtectionPriorities' ? (
        <p className="assessment-privacy-note">{question.helpText}</p>
      ) : null}
      {validation ? (
        <p id={errorId} className="field-error" role="alert">
          {validation}
        </p>
      ) : null}
      <div className="assessment-question__footer">
        <div className="assessment-question__secondary">
          {secondaryAction}
          {!isRadio && question.unknownAllowed ? (
            <button
              className="button secondary"
              type="button"
              disabled={disabled}
              onClick={() => onAnswer({ ...base, answerState: 'EXPLICIT_UNKNOWN' })}
            >
              No lo sé
            </button>
          ) : null}
        </div>
        <div className="assessment-question__primary">
          {saveStatus}
          <button
            className="button assessment-primary-action"
            type="button"
            disabled={disabled || !hasAnswer}
            onClick={submit}
          >
            Continuar <span aria-hidden="true">→</span>
          </button>
        </div>
        {!hasAnswer ? (
          <small className="assessment-answer-hint">
            {isRadio || question.valueType === 'MULTI_CHOICE'
              ? 'Selecciona una opción para continuar.'
              : 'Completa tu respuesta para continuar.'}
          </small>
        ) : null}
      </div>
    </div>
  );
}
