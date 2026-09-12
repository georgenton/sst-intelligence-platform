'use client';

import type { SstAssessmentQuestion } from '@sst/contracts';
import { useState } from 'react';
import { explicitBooleanChoices, questionBounds } from '@/lib/sst-assessment-presentation';
import type { AssessmentAnswer } from '@/lib/sst-assessment-types';

export function AssessmentQuestionControl({
  question,
  disabled,
  onAnswer,
}: {
  question: SstAssessmentQuestion;
  disabled: boolean;
  onAnswer(answer: AssessmentAnswer): void;
}) {
  const [value, setValue] = useState<string | string[]>(
    question.valueType === 'MULTI_CHOICE' ? [] : '',
  );
  const [validation, setValidation] = useState('');
  const bounds = questionBounds(question.factKey);
  const base = { scopeKey: question.scopeKey, factKey: question.factKey };
  const choose = (selected: boolean | string) =>
    onAnswer({ ...base, answerState: 'KNOWN', value: selected });
  const unknown = () => onAnswer({ ...base, answerState: 'EXPLICIT_UNKNOWN' });

  if (question.valueType === 'BOOLEAN') {
    return (
      <div className="assessment-choice-grid assessment-choice-grid--boolean">
        {explicitBooleanChoices(question.unknownAllowed).map((choice) => (
          <button
            type="button"
            key={choice.label}
            disabled={disabled}
            onClick={() => (choice.value === 'EXPLICIT_UNKNOWN' ? unknown() : choose(choice.value))}
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.valueType === 'SINGLE_CHOICE') {
    return (
      <div className="assessment-choice-grid">
        {question.choices.map((choice) => (
          <button
            type="button"
            key={choice.value}
            disabled={disabled}
            onClick={() => choose(choice.value)}
          >
            {choice.label}
          </button>
        ))}
        {question.unknownAllowed ? (
          <button type="button" disabled={disabled} onClick={unknown}>
            No tengo esa información
          </button>
        ) : null}
      </div>
    );
  }

  const submit = () => {
    setValidation('');
    if (question.valueType === 'MULTI_CHOICE') {
      if (!Array.isArray(value) || value.length === 0) {
        setValidation('Selecciona al menos una opción para continuar.');
        return;
      }
      onAnswer({ ...base, answerState: 'KNOWN', value });
      return;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      setValidation('Completa este campo o indica que aún no tienes la información.');
      return;
    }
    if (question.valueType === 'INTEGER') {
      const number = Number(text);
      if (
        !Number.isInteger(number) ||
        (bounds.min !== undefined && number < bounds.min) ||
        (bounds.max !== undefined && number > bounds.max)
      ) {
        setValidation(
          `Ingresa un número entero${bounds.min !== undefined ? ` desde ${bounds.min}` : ''}${bounds.max !== undefined ? ` hasta ${bounds.max}` : ''}.`,
        );
        return;
      }
      onAnswer({ ...base, answerState: 'KNOWN', value: number });
      return;
    }
    if (bounds.maxLength !== undefined && text.length > bounds.maxLength) {
      setValidation(`Usa máximo ${bounds.maxLength} caracteres.`);
      return;
    }
    onAnswer({ ...base, answerState: 'KNOWN', value: text });
  };

  return (
    <div className="assessment-response-editor">
      {question.valueType === 'MULTI_CHOICE' ? (
        <div className="assessment-choice-grid" aria-label="Opciones disponibles">
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
                {choice.label}
              </button>
            );
          })}
        </div>
      ) : question.valueType === 'INTEGER' ? (
        <input
          aria-label="Respuesta numérica"
          inputMode="numeric"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
        />
      ) : (
        <textarea
          aria-label="Respuesta"
          rows={question.factKey === 'organization.additionalContext' ? 5 : 3}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
        />
      )}
      {question.factKey === 'organization.additionalContext' ? (
        <p className="assessment-privacy-note">
          Lo guardaremos como contexto. Todavía no lo convertiremos automáticamente en una
          conclusión.
        </p>
      ) : null}
      {validation ? (
        <p className="field-error" role="alert">
          {validation}
        </p>
      ) : null}
      <div className="assessment-actions">
        {question.unknownAllowed ? (
          <button className="button secondary" type="button" disabled={disabled} onClick={unknown}>
            No tengo esa información
          </button>
        ) : null}
        <button className="button" type="button" disabled={disabled} onClick={submit}>
          Continuar
        </button>
      </div>
    </div>
  );
}
