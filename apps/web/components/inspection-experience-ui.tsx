'use client';

import { Card } from '@sst/ui';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from 'react';
import { humanRiskLevelLabel, humanRoleLabel } from '@/lib/human-lexicon';
import type { FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { statusMeta, type StatusDomain } from '@/lib/inspection-experience';
import { WorkspaceHeader } from './workspace';

export function InspectionPageHeader({
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
    <WorkspaceHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      context={context}
      actions={actions}
    />
  );
}

export function ContextLine({ children }: PropsWithChildren) {
  return <p className="inspection-context-line">{children}</p>;
}

export function DomainStatusBadge({ domain, status }: { domain: StatusDomain; status: string }) {
  const meta = statusMeta(domain, status);
  return (
    <span className={`domain-status status-${meta.tone}`}>
      <span aria-hidden="true">{meta.symbol}</span>
      {meta.label}
    </span>
  );
}

export function InspectionRiskBadge({
  level,
  score,
  pending = false,
}: {
  level?: string | null;
  score?: number | null;
  pending?: boolean;
}) {
  if (pending || !level) {
    return <span className="risk-badge risk-pending">Residual pendiente</span>;
  }
  return (
    <span className={`risk-badge risk-${level.toLowerCase()}`}>
      {humanRiskLevelLabel(level)}
      {score !== undefined && score !== null ? <strong>{score}</strong> : null}
    </span>
  );
}

export function InspectionDemoNotice({
  compact = false,
  methodName = 'Matriz demostrativa 5×5',
  disclaimer = 'Metodología demostrativa. No constituye una evaluación regulatoria validada.',
}: {
  compact?: boolean;
  methodName?: string;
  disclaimer?: string;
}) {
  return (
    <div className={`inspection-demo-notice${compact ? ' compact' : ''}`} role="note">
      <span aria-hidden="true">i</span>
      <div>
        <strong>{methodName}</strong>
        <p>{disclaimer}</p>
      </div>
    </div>
  );
}

export function InspectionSkeleton({ label = 'Cargando contenido' }: { label?: string }) {
  return (
    <div className="inspection-skeleton" role="status" aria-label={label}>
      <span className="skeleton-line wide" />
      <span className="skeleton-line medium" />
      <div className="skeleton-grid">
        <span />
        <span />
        <span />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function InspectionState({
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
      className={`inspection-state inspection-state-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="inspection-state-mark" aria-hidden="true">
        {kind === 'error' ? '×' : kind === 'empty' ? '—' : 'i'}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="inspection-state-action">{action}</div> : null}
      </div>
    </Card>
  );
}

export function PermissionState({
  role,
  capability,
  authorizedRoles,
}: {
  role?: string;
  capability: string;
  authorizedRoles: string;
}) {
  return (
    <InspectionState
      kind="permission"
      title="Acción no disponible para tu rol"
      description={`Tu rol (${humanRoleLabel(role)}) puede consultar este registro, pero no ${capability}. Pueden hacerlo: ${authorizedRoles}. Los permisos se validan en cada operación.`}
    />
  );
}

export function EntitlementState({ planName }: { planName?: string }) {
  return (
    <InspectionState
      kind="entitlement"
      title="Inspecciones no está disponible en este plan"
      description={`El plan ${planName ?? 'activo'} no incluye el módulo de inspecciones. Un Propietario o Administrador puede revisar Módulos y plan.`}
      action={
        <Link className="button secondary" href="/app/modules">
          Ver módulos y plan
        </Link>
      }
    />
  );
}

export function InlineRequestState({ children }: PropsWithChildren) {
  return (
    <p className="inspection-inline-error" role="alert" tabIndex={-1}>
      {children}
    </p>
  );
}

export function QuestionScale<T extends FieldValues>({
  name,
  title,
  descriptions,
  register,
  error,
}: {
  name: Path<T>;
  title: string;
  descriptions: readonly string[];
  register: UseFormRegister<T>;
  error?: string;
}) {
  const errorId = useId();
  return (
    <fieldset className="inspection-scale" aria-describedby={error ? errorId : undefined}>
      <legend>{title}</legend>
      <div className="inspection-scale-options">
        {descriptions.map((description, index) => {
          const value = index + 1;
          return (
            <label key={description}>
              <input
                type="radio"
                value={value}
                {...register(name, {
                  required: `Selecciona un valor de 1 a 5 para ${title.toLocaleLowerCase('es')}.`,
                  valueAsNumber: true,
                })}
              />
              <strong>{value}</strong>
              <span>{description}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function InspectionDialog({
  open,
  title,
  description,
  onClose,
  children,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  description: string;
  onClose(): void;
}>) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>('[data-dialog-initial]');
    first?.focus();
    return () => returnFocusRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="inspection-dialog-backdrop">
      <div
        className="inspection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
        onKeyDown={trapFocus}
      >
        <button
          type="button"
          className="inspection-dialog-close"
          aria-label="Cerrar diálogo"
          data-dialog-initial
          onClick={onClose}
        >
          ×
        </button>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId} className="muted">
          {description}
        </p>
        {children}
      </div>
    </div>
  );
}

export function ActiveFilters({
  filters,
  onRemove,
  onClear,
}: {
  filters: Array<{ key: string; label: string }>;
  onRemove(key: string): void;
  onClear(): void;
}) {
  if (filters.length === 0)
    return <p className="inspection-filter-context">Sin filtros activos.</p>;
  return (
    <div className="inspection-active-filters" aria-live="polite">
      <p>
        Filtros activos: <strong>{filters.map(({ label }) => label).join(' · ')}</strong>
      </p>
      <div>
        {filters.map((filter) => (
          <button type="button" key={filter.key} onClick={() => onRemove(filter.key)}>
            {filter.label} <span aria-hidden="true">×</span>
            <span className="sr-only">Quitar filtro</span>
          </button>
        ))}
        <button type="button" className="clear" onClick={onClear}>
          Quitar todos los filtros
        </button>
      </div>
    </div>
  );
}

export type DialogFocusRef = RefObject<HTMLButtonElement | null>;
