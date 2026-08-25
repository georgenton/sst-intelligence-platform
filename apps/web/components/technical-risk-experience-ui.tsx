'use client';

import type { TechnicalQuestion } from '@sst/contracts';
import { Card } from '@sst/ui';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { Controller, type Control } from 'react-hook-form';
import {
  TECHNICAL_RISK_DEMO_COPY,
  technicalAnswerLabel,
  technicalAssessmentStatusMeta,
  technicalQuestionExpectation,
  technicalRiskLabel,
  type TechnicalReviewRecord,
} from '@/lib/technical-risk-experience';
import {
  AUTHORIZED_TECHNICAL_REVIEWER_LABELS,
  AUTHORIZED_TECHNICAL_WRITER_LABELS,
  humanRoleLabel,
} from '@/lib/human-lexicon';
import { TechnicalDetails } from './technical-details';

export type TechnicalAnswerValues = { answers: Record<string, unknown> };

export function TechnicalRiskPageHeader({
  eyebrow,
  title,
  description,
  context,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="technical-risk-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="technical-risk-lede">{description}</p>
        {context}
      </div>
      {actions ? <div className="technical-risk-header-actions focus-dim">{actions}</div> : null}
    </header>
  );
}

export function TechnicalRiskState({
  kind,
  title,
  description,
  action,
}: {
  kind: 'empty' | 'error' | 'permission' | 'entitlement' | 'info';
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card
      className={`technical-risk-state technical-risk-state-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="technical-risk-state-mark" aria-hidden="true">
        {kind === 'error' ? '×' : kind === 'empty' ? '—' : 'i'}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="technical-risk-state-action">{action}</div> : null}
      </div>
    </Card>
  );
}

export function TechnicalRiskPermissionState({
  role,
  capability,
}: {
  role?: string;
  capability: 'crear o completar evaluaciones' | 'registrar una revisión profesional';
}) {
  const roles =
    capability === 'registrar una revisión profesional'
      ? AUTHORIZED_TECHNICAL_REVIEWER_LABELS
      : AUTHORIZED_TECHNICAL_WRITER_LABELS;
  return (
    <TechnicalRiskState
      kind="permission"
      title="Acción no disponible para tu rol"
      description={`Tu rol (${humanRoleLabel(role)}) puede consultar este contexto, pero no ${capability}. Pueden hacerlo: ${roles}. Los permisos se validan en cada operación.`}
    />
  );
}

export function TechnicalRiskEntitlementState({ planName }: { planName?: string }) {
  return (
    <TechnicalRiskState
      kind="entitlement"
      title="Riesgo técnico no está disponible en este plan"
      description={`El plan ${planName ?? 'activo'} no incluye el módulo de Riesgo técnico. Un Propietario o Administrador puede revisar Módulos y plan.`}
      action={
        <Link className="button secondary" href="/app/modules">
          Ver módulos y plan
        </Link>
      }
    />
  );
}

export function TechnicalRiskSkeleton({ label }: { label: string }) {
  return (
    <div className="technical-risk-skeleton" role="status" aria-label={label}>
      <span className="technical-risk-skeleton-line wide" />
      <span className="technical-risk-skeleton-line medium" />
      <div className="technical-risk-skeleton-grid">
        <span />
        <span />
        <span />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function TechnicalRiskDemoNotice({ disclaimer }: { disclaimer?: string | null }) {
  return (
    <div className="technical-risk-demo-notice" role="note">
      <span aria-hidden="true">i</span>
      <div>
        <strong>Metodología demostrativa</strong>
        <p>{disclaimer ?? TECHNICAL_RISK_DEMO_COPY}</p>
      </div>
    </div>
  );
}

export function TechnicalAssessmentStatus({ status }: { status: string }) {
  const meta = technicalAssessmentStatusMeta(status);
  return (
    <span className={`technical-status technical-status-${meta.tone}`}>
      <span aria-hidden="true">{meta.symbol}</span>
      {meta.label}
    </span>
  );
}

export function TechnicalRiskBadge({
  level,
  score,
}: {
  level?: string | null;
  score?: number | null;
}) {
  if (!level) return <span className="risk-badge risk-pending">Sin resultado</span>;
  return (
    <span className={`risk-badge risk-${level.toLocaleLowerCase('en')}`}>
      {technicalRiskLabel(level)}
      {score !== undefined && score !== null ? <strong>{score}</strong> : null}
    </span>
  );
}

export function MethodVersionSummary({
  name,
  code,
  version,
  isDemo,
  disclaimer,
}: {
  name: string;
  code?: string;
  version: string;
  isDemo: boolean;
  disclaimer?: string | null;
}) {
  return (
    <section className="technical-method-summary" aria-labelledby="technical-method-summary-title">
      <div>
        <p className="technical-risk-kicker">Metodología utilizada</p>
        <h2 id="technical-method-summary-title">{name}</h2>
        <div className="technical-method-identity">
          {isDemo ? <span className="demo-chip">Demostración</span> : null}
        </div>
        <TechnicalDetails summary="Ver metodología y detalles">
          <dl className="technical-description-list">
            <div>
              <dt>Versión</dt>
              <dd>{version}</dd>
            </div>
            {code ? (
              <div>
                <dt>Identificador</dt>
                <dd>
                  <code>{code}</code>
                </dd>
              </div>
            ) : null}
          </dl>
        </TechnicalDetails>
      </div>
      {isDemo ? <TechnicalRiskDemoNotice disclaimer={disclaimer} /> : null}
    </section>
  );
}

export function TechnicalProgress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div
      className="technical-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
      style={{ '--technical-progress': `${percentage}%` } as CSSProperties}
    >
      <div>
        <strong>{label}</strong>
        <span>{percentage}% del cuestionario respondido</span>
      </div>
      <span className="technical-progress-track" aria-hidden="true">
        <span />
      </span>
    </div>
  );
}

export function TechnicalQuestionField({
  question,
  control,
  error,
}: {
  question: TechnicalQuestion;
  control: Control<TechnicalAnswerValues>;
  error?: string;
}) {
  const helpId = useId();
  const errorId = useId();
  const name = `answers.${question.key}` as `answers.${string}`;
  const describedBy = [helpId, error ? errorId : null].filter(Boolean).join(' ');
  const expectation = technicalQuestionExpectation(question);
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const common = {
          id: `technical-question-${question.key}`,
          name: field.name,
          'aria-invalid': Boolean(error),
          'aria-describedby': describedBy || undefined,
        };
        let input: ReactNode;
        switch (question.type) {
          case 'BOOLEAN':
            input = (
              <fieldset className="technical-choice-group" aria-describedby={describedBy}>
                <legend>{question.label}</legend>
                <div className="technical-choice-options two">
                  {[
                    { value: true, label: 'Sí' },
                    { value: false, label: 'No' },
                  ].map((option) => (
                    <label key={option.label}>
                      <input
                        type="radio"
                        name={field.name}
                        checked={field.value === option.value}
                        onChange={() => field.onChange(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
            break;
          case 'SINGLE_CHOICE':
            input = (
              <select
                {...common}
                value={typeof field.value === 'string' ? field.value : ''}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value || undefined)}
              >
                <option value="">Selecciona una opción</option>
                {question.options.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            );
            break;
          case 'INTEGER':
          case 'DECIMAL':
            input = (
              <input
                {...common}
                type="number"
                inputMode={question.type === 'INTEGER' ? 'numeric' : 'decimal'}
                step={question.type === 'INTEGER' ? 1 : 'any'}
                min={question.min}
                max={question.max}
                value={typeof field.value === 'number' ? field.value : ''}
                onBlur={field.onBlur}
                onChange={(event) =>
                  field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                }
              />
            );
            break;
          case 'TEXT':
            input = (
              <textarea
                {...common}
                rows={5}
                maxLength={question.maxLength}
                value={typeof field.value === 'string' ? field.value : ''}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            );
            break;
          case 'LIKELIHOOD':
          case 'CONSEQUENCE':
            input = (
              <fieldset
                className="technical-choice-group technical-scale"
                aria-describedby={describedBy}
              >
                <legend>{question.label}</legend>
                <div className="technical-scale-options">
                  {Array.from(
                    { length: question.max - question.min + 1 },
                    (_, index) => question.min + index,
                  ).map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={field.name}
                        value={option}
                        checked={field.value === option}
                        onChange={() => field.onChange(option)}
                      />
                      <strong>{option}</strong>
                      <span>
                        {option === question.min ? 'Menor' : option === question.max ? 'Mayor' : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
            break;
        }
        return (
          <div className="technical-question-field" data-question-type={question.type}>
            {!['BOOLEAN', 'LIKELIHOOD', 'CONSEQUENCE'].includes(question.type) ? (
              <label htmlFor={common.id}>
                {question.label}
                {!question.required ? <span> · opcional</span> : null}
              </label>
            ) : null}
            <p className="technical-field-help" id={helpId}>
              {question.description ?? expectation}
              {!question.required ? ' Esta respuesta es opcional.' : ''}
            </p>
            {input}
            {error ? (
              <p className="field-error" id={errorId} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

export function AnswerSummary({
  questions,
  answers,
}: {
  questions: TechnicalQuestion[];
  answers: Record<string, unknown>;
}) {
  return (
    <dl className="technical-description-list">
      {questions.map((question) => (
        <div key={question.key}>
          <dt>{question.label}</dt>
          <dd>{technicalAnswerLabel(question, answers[question.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TechnicalInlineMessage({
  tone = 'error',
  children,
}: PropsWithChildren<{ tone?: 'error' | 'success' | 'info' }>) {
  return (
    <p
      className={`technical-inline-message technical-inline-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      tabIndex={-1}
    >
      {children}
    </p>
  );
}

export function ReviewHistory({ reviews }: { reviews?: TechnicalReviewRecord[] }) {
  if (!reviews?.length) return <p className="muted">Aún no existe una revisión profesional.</p>;
  return (
    <ol className="technical-review-history">
      {reviews.map((review, index) => (
        <li key={`${review.createdAt}-${index}`}>
          <span
            className={`technical-review-mark review-${review.decision.toLocaleLowerCase('en')}`}
            aria-hidden="true"
          />
          <div>
            <strong>
              {review.decision === 'APPROVED' ? 'Revisión aprobada' : 'Revisión: requiere ajustes'}
            </strong>
            <span>
              {review.reviewer?.displayName ?? 'Usuario autorizado'} ·{' '}
              {new Date(review.createdAt).toLocaleString('es-EC')}
            </span>
            {review.comment ? <p>{review.comment}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TechnicalReviewDialog({
  open,
  title,
  description,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  onClose(): void;
  onConfirm(): void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled])');
    focusable?.[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [onClose, open, pending]);
  if (!open) return null;
  return (
    <div className="technical-dialog-backdrop">
      <div
        className="technical-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="technical-dialog-actions">
          <button className="button secondary" type="button" disabled={pending} onClick={onClose}>
            Volver a revisar
          </button>
          <button className="button" type="button" disabled={pending} onClick={onConfirm}>
            {pending ? 'Registrando…' : 'Registrar decisión'}
          </button>
        </div>
      </div>
    </div>
  );
}
