'use client';

import { useEffect, useId, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { Card } from '@sst/ui';
import { humanOperationalPriorityLabel } from '@/lib/human-lexicon';
import { planItemSource } from '@/lib/operational-plan-handoff';
import {
  isInheritedPlanItem,
  planDate,
  planExecutionCounts,
  planMissingFields,
  planStateLabel,
  planVersionSource,
  type PlanItem,
  type PlanVersion,
} from '@/lib/operational-plan-presentation';
import styles from './operational-plans.module.css';

export function PlanPriority({
  priority,
  suggested = false,
}: {
  priority: string;
  suggested?: boolean;
}) {
  return (
    <span className={styles.priority}>
      <span aria-hidden="true">
        {({ LOW: '●', MEDIUM: '■', HIGH: '▲', URGENT: '◆' } as Record<string, string>)[priority]}
      </span>
      <span>
        {suggested ? 'Prioridad sugerida: ' : ''}
        {humanOperationalPriorityLabel(priority)}
      </span>
    </span>
  );
}
export function PlanBadge({ status, version }: { status: string; version: number }) {
  return (
    <span className={styles.planBadge}>
      <span aria-hidden="true">{status === 'ACTIVE' ? '✓' : '◇'}</span>
      <span>
        {planStateLabel(status)} · versión {version}
      </span>
    </span>
  );
}
export function PlanHeader({ version, children }: { version: PlanVersion; children?: ReactNode }) {
  const counts = planExecutionCounts(version.items);
  return (
    <Card className={styles.header}>
      <div>
        <PlanBadge status={version.status} version={version.version} />
      </div>
      <h1 id="operational-plan-title" tabIndex={-1}>
        {version.name}
      </h1>
      {version.description ? <p>{version.description}</p> : null}
      <dl className={styles.facts}>
        <div>
          <dt>Período</dt>
          <dd>
            {planDate(version.periodStart)} – {planDate(version.periodEnd)}
          </dd>
        </div>
        <div>
          <dt>Responsable general</dt>
          <dd className={!version.responsible ? styles.missing : ''}>
            {version.responsible?.displayName ?? 'Sin asignar'}
          </dd>
        </div>
        <div>
          <dt>Contenido</dt>
          <dd>{version.items.length} actividades</dd>
          <dd>
            {counts.completed} completadas · {counts.inProgress} en curso · {counts.planned}{' '}
            planificadas · {counts.canceled} canceladas
          </dd>
        </div>
        <div>
          <dt>Origen</dt>
          <dd>{planVersionSource(version)}</dd>
          {typeof version.provenance.capabilityEngineVersion === 'string' ? (
            <dd>Motor de recomendación {version.provenance.capabilityEngineVersion}</dd>
          ) : null}
        </div>
      </dl>
      {children}
    </Card>
  );
}
export function PlanVersionBanner({
  source,
  next,
  preparing = false,
}: {
  source: PlanVersion;
  next: number;
  preparing?: boolean;
}) {
  return (
    <section className={styles.versionBanner} aria-label="Contexto de versión">
      <div className={styles.versionNodes}>
        <div className={styles.versionNode}>
          <small>{source.status === 'ACTIVE' ? 'Versión actual' : 'Versión guardada'}</small>
          <strong>
            v{source.version} · {planStateLabel(source.status)}
          </strong>
        </div>
        <span aria-hidden="true">→</span>
        <div className={styles.versionNode}>
          <small>{preparing ? 'Estás preparando' : 'Nueva versión'}</small>
          <strong>
            v{next} · Borrador{preparing ? ' en preparación' : ''}
          </strong>
        </div>
      </div>
      <p>
        v{source.version} no se modifica.
        {source.status === 'ACTIVE'
          ? ' Tu versión vigente no se modifica y sigue activa mientras revisas el borrador.'
          : ' Tus cambios se guardarán como una versión nueva.'}
      </p>
    </section>
  );
}
export function PlanMissingReview({
  items,
  newOnly = false,
}: {
  items: PlanItem[];
  newOnly?: boolean;
}) {
  const counts = planMissingFields(items);
  if (!counts.responsible && !counts.dueAt && !counts.frequency) return null;
  return (
    <section className={styles.notice} aria-label="Datos por completar">
      <h2>{newOnly ? 'Datos de las propuestas nuevas por completar' : 'Revisión previa'}</h2>
      {counts.responsible ? <p>{counts.responsible} actividades necesitan responsable.</p> : null}
      {counts.dueAt ? <p>{counts.dueAt} actividades no tienen fecha límite.</p> : null}
      {counts.frequency ? (
        <p>{counts.frequency} actividades tienen frecuencia por definir.</p>
      ) : null}
      <p>No son errores: el plan puede activarse así.</p>
    </section>
  );
}
export function PlanActivity({
  item,
  children,
  newProposal = false,
}: {
  item: PlanItem;
  children?: ReactNode;
  newProposal?: boolean;
}) {
  const missing = Number(!item.responsible) + Number(!item.dueAt) + Number(!item.frequency);
  return (
    <article id={`item-${item.id}`} aria-labelledby={`item-title-${item.id}`}>
      <Card className={styles.activity} data-state={item.execution?.status ?? 'PLANNED'}>
        <div className={styles.row}>
          <h3 id={`item-title-${item.id}`}>{item.title || 'Actividad por definir'}</h3>
          <div className={styles.actions}>
            {newProposal ? <span className={styles.info}>✧ Propuesta del diagnóstico</span> : null}
            <span className={styles.executionBadge}>
              {planStateLabel(item.execution?.status ?? 'PLANNED')}
            </span>
            <PlanPriority priority={item.priority} />
          </div>
        </div>
        {item.description ? <p>{item.description}</p> : null}
        {missing ? <p className={styles.missing}>{missing} datos por definir</p> : null}
        <dl className={styles.facts}>
          <div>
            <dt>Centro</dt>
            <dd>{item.workCenter?.name ?? 'Toda la organización'}</dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd className={!item.responsible ? styles.missing : ''}>
              {item.responsible?.displayName ?? 'Sin asignar'}
            </dd>
          </div>
          <div>
            <dt>Fecha límite</dt>
            <dd className={!item.dueAt ? styles.missing : ''}>{planDate(item.dueAt)}</dd>
          </div>
          <div>
            <dt>Frecuencia</dt>
            <dd className={!item.frequency ? styles.missing : ''}>
              {item.frequency ?? 'No definida'}
            </dd>
          </div>
        </dl>
        <div className={styles.row}>
          <span className={styles.source}>
            Origen: {planItemSource(item.provenanceType, item.provenanceSnapshot)}
          </span>
          {children}
        </div>
        <details className={styles.technical}>
          <summary>Ver procedencia y evidencia</summary>
          {isInheritedPlanItem(item) ? (
            <p>Actividad heredada del plan vigente, con su estado y procedencia.</p>
          ) : null}
          {typeof item.provenanceSnapshot.engineVersion === 'string' ? (
            <p>Motor de recomendación {item.provenanceSnapshot.engineVersion}</p>
          ) : null}
          <p>Inicio: {planDate(item.startsAt)}</p>
          {item.evidenceReferences.length ? (
            <ul>
              {item.evidenceReferences.map((reference) => (
                <li key={reference}>{reference}</li>
              ))}
            </ul>
          ) : (
            <p>Sin referencias de evidencia</p>
          )}
        </details>
      </Card>
    </article>
  );
}

// Native modal semantics make the background inert; focus behavior follows the assessment dialog.
export function PlanDialog({
  open,
  title,
  onClose,
  drawer = false,
  children,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  drawer?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>('[data-dialog-initial]')?.focus();
    return () => {
      ref.current?.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  function trap(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      ),
    ).filter((control) => control.getClientRects().length);
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
  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${drawer ? styles.drawer : ''}`}
      aria-labelledby={id}
      aria-modal="true"
      onKeyDown={trap}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="button secondary"
          aria-label="Cerrar diálogo"
          data-dialog-initial
          onClick={onClose}
        >
          Cerrar
        </button>
      </header>
      {open ? children : null}
    </dialog>
  );
}
