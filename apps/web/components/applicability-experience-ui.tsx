import type { ApplicabilityState, OrganizationSstProfile } from '@sst/contracts';
import Link from 'next/link';
import type {
  ApplicabilityDecisionRecord,
  ApplicabilityRulePackOption,
} from '@/lib/applicability-types';
import {
  applicabilityStateMeta,
  applicabilityTargetLabel,
  formatApplicabilityDate,
  predicateResultLabel,
  predicateValueLabel,
  profileFactLabel,
  profileFieldLabel,
  summarizeDecisionStates,
} from '@/lib/applicability-experience';

export function ApplicabilityPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="applicability-page-header">
      <div>
        <p className="applicability-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="applicability-lede">{description}</p>
      </div>
      {action ? <div className="applicability-header-action">{action}</div> : null}
    </header>
  );
}

export function DemoApplicabilityNotice({ disclaimer }: { disclaimer: string }) {
  return (
    <aside className="applicability-demo-notice" aria-label="Límite de demostración">
      <span aria-hidden="true">D</span>
      <div>
        <strong>Demostración conceptual</strong>
        <p>{disclaimer}</p>
      </div>
    </aside>
  );
}

export function ApplicabilityStatePanel({
  kind,
  title,
  description,
  action,
}: {
  kind: 'empty' | 'error' | 'info' | 'success';
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className="applicability-state-panel"
      data-kind={kind}
      role={kind === 'error' ? 'alert' : undefined}
    >
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
  );
}

export function ApplicabilitySkeleton({ label }: { label: string }) {
  return (
    <div className="applicability-skeleton" role="status" aria-label={label}>
      <span />
      <span />
      <span />
      <span className="applicability-skeleton__text">{label}…</span>
    </div>
  );
}

export function ProfileSnapshotSummary({
  snapshot,
  version,
  createdAt,
  createdBy,
  heading = 'Datos persistidos en esta versión',
}: {
  snapshot: OrganizationSstProfile;
  version?: number;
  createdAt?: string;
  createdBy?: string;
  heading?: string;
}) {
  return (
    <section className="applicability-profile-snapshot" aria-label={heading}>
      <div className="applicability-section-heading">
        <div>
          <p className="applicability-kicker">Snapshot inmutable</p>
          <h2>{heading}</h2>
        </div>
        {version ? <span>Versión {version}</span> : null}
      </div>
      <dl className="applicability-fact-grid">
        <div>
          <dt>País · derivado por servidor</dt>
          <dd>{profileFactLabel(snapshot.organization.country)}</dd>
        </div>
        <div>
          <dt>Sector · derivado por servidor</dt>
          <dd>{profileFactLabel(snapshot.organization.sector)}</dd>
        </div>
        <div>
          <dt>Centros de trabajo · derivado por servidor</dt>
          <dd>{profileFactLabel(snapshot.organization.workCenterCount)}</dd>
        </div>
        <div>
          <dt>Personas trabajadoras</dt>
          <dd>{profileFactLabel(snapshot.organization.workerCount)}</dd>
        </div>
        <div>
          <dt>Procesos químicos</dt>
          <dd>{profileFactLabel(snapshot.operations.hasChemicalProcesses)}</dd>
        </div>
        <div>
          <dt>Operaciones de alta energía</dt>
          <dd>{profileFactLabel(snapshot.operations.hasHighEnergyOperations)}</dd>
        </div>
      </dl>
      {createdAt || createdBy ? (
        <p className="applicability-snapshot-meta">
          {createdAt ? `Creada ${formatApplicabilityDate(createdAt)}` : ''}
          {createdAt && createdBy ? ' · ' : ''}
          {createdBy ? `por ${createdBy}` : ''}
        </p>
      ) : null}
    </section>
  );
}

export function RulePackCard({
  pack,
  selected,
  selectable = false,
  onSelect,
}: {
  pack: ApplicabilityRulePackOption;
  selected?: boolean;
  selectable?: boolean;
  onSelect?(): void;
}) {
  const body = (
    <>
      <div className="applicability-rule-pack__identity">
        <div>
          <span className="applicability-source-badge" data-demo={pack.isDemo}>
            {pack.isDemo ? 'DEMO' : pack.sourceType}
          </span>
          <h3>{pack.name}</h3>
        </div>
        <code>v{pack.version}</code>
      </div>
      <dl className="applicability-rule-pack__meta">
        <div>
          <dt>Clave</dt>
          <dd>
            <code>{pack.key}</code>
          </dd>
        </div>
        <div>
          <dt>Fuente</dt>
          <dd>{pack.sourceType}</dd>
        </div>
        <div>
          <dt>Carácter regulatorio</dt>
          <dd>{pack.regulatory ? 'Sí' : 'No'}</dd>
        </div>
      </dl>
      <p>{pack.disclaimer}</p>
    </>
  );

  if (!selectable) return <article className="applicability-rule-pack">{body}</article>;
  return (
    <label className="applicability-rule-pack" data-selected={selected}>
      <input
        type="radio"
        name="rule-pack-version"
        value={pack.id}
        checked={selected}
        onChange={onSelect}
      />
      <span className="applicability-sr-only">Seleccionar {pack.name}</span>
      {body}
    </label>
  );
}

export function ApplicabilityStateBadge({ state }: { state: ApplicabilityState }) {
  const meta = applicabilityStateMeta(state);
  return (
    <span className="applicability-state-badge" data-tone={meta.tone}>
      <span aria-hidden="true">{meta.symbol}</span>
      {meta.label}
    </span>
  );
}

export function ApplicabilityDecisionSummary({
  decisions,
}: {
  decisions: readonly ApplicabilityDecisionRecord[];
}) {
  const counts = summarizeDecisionStates(decisions);
  return (
    <section
      className="applicability-decision-summary"
      aria-labelledby="applicability-summary-title"
    >
      <div className="applicability-section-heading">
        <div>
          <p className="applicability-kicker">Conteos, no puntajes</p>
          <h2 id="applicability-summary-title">Resumen de decisiones</h2>
        </div>
        <span>{decisions.length} decisiones</span>
      </div>
      <div className="applicability-state-counts">
        {Object.entries(counts).map(([state, count]) => {
          const typedState = state as ApplicabilityState;
          const meta = applicabilityStateMeta(typedState);
          return (
            <div key={state} data-tone={meta.tone}>
              <strong>{count}</strong>
              <span>{meta.label}</span>
              <small>
                <span aria-hidden="true">{meta.symbol}</span> {typedState}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ApplicabilityDecisionCard({ decision }: { decision: ApplicabilityDecisionRecord }) {
  const meta = applicabilityStateMeta(decision.state);
  const missingFields = Array.from(
    new Set(
      decision.traces.flatMap((trace) =>
        trace.predicates
          .filter((predicate) => predicate.result === 'MISSING')
          .map((predicate) => predicate.field),
      ),
    ),
  );
  return (
    <article className="applicability-decision-card" data-tone={meta.tone}>
      <div className="applicability-decision-card__header">
        <div>
          <ApplicabilityStateBadge state={decision.state} />
          <h3>{applicabilityTargetLabel(decision.targetKey)}</h3>
          <code>{decision.targetKey}</code>
        </div>
        <div className="applicability-decision-card__source">
          <span>{decision.sourceType}</span>
          {decision.winningRuleId ? (
            <code>{decision.winningRuleId}</code>
          ) : (
            <span>Sin regla ganadora</span>
          )}
        </div>
      </div>
      <p>{decision.explanation}</p>
      <p className="applicability-decision-description">{meta.description}</p>
      {decision.state === 'NEEDS_INFORMATION' ? (
        <aside className="applicability-missing-information">
          <strong>Información que falta en este snapshot</strong>
          {missingFields.length > 0 ? (
            <ul>
              {missingFields.map((field) => (
                <li key={field}>{profileFieldLabel(field)}</li>
              ))}
            </ul>
          ) : (
            <p>El trace persistido indica información incompleta.</p>
          )}
          <Link href="/app/applicability/new">Crear nueva versión del perfil</Link>
        </aside>
      ) : null}
      {decision.state === 'NEEDS_EXPERT_REVIEW' ? (
        <aside className="applicability-expert-boundary">
          Esta señal requiere análisis profesional. Esta experiencia no aprueba, rechaza ni firma la
          evaluación.
        </aside>
      ) : null}
      <details className="applicability-trace-disclosure">
        <summary>Ver por qué</summary>
        <div className="applicability-trace-list">
          {decision.traces.map((trace) => (
            <article className="applicability-trace-rule" key={trace.id}>
              <div className="applicability-trace-rule__heading">
                <div>
                  <span>Regla</span>
                  <code>{trace.ruleId}</code>
                </div>
                <span className="applicability-predicate-result" data-result={trace.ruleResult}>
                  {predicateResultLabel(trace.ruleResult)}
                </span>
              </div>
              <dl className="applicability-trace-meta">
                <div>
                  <dt>Composición</dt>
                  <dd>
                    <code>{trace.composition}</code>
                  </dd>
                </div>
                <div>
                  <dt>Estado configurado</dt>
                  <dd>
                    <code>{trace.configuredState}</code>
                  </dd>
                </div>
                <div>
                  <dt>Estado aportado</dt>
                  <dd>
                    {trace.contributedState ? <code>{trace.contributedState}</code> : 'Ninguno'}
                  </dd>
                </div>
                <div>
                  <dt>Código de razón</dt>
                  <dd>
                    <code>{trace.reasonCode}</code>
                  </dd>
                </div>
              </dl>
              <p>{trace.explanation}</p>
              <div
                className="applicability-predicate-list"
                aria-label={`Predicados de ${trace.ruleId}`}
              >
                {trace.predicates.map((predicate) => (
                  <div
                    className="applicability-predicate-row"
                    key={`${trace.id}-${predicate.predicateIndex}`}
                  >
                    <div>
                      <span>Dato evaluado</span>
                      <strong>{profileFieldLabel(predicate.field)}</strong>
                      <code>{predicate.field}</code>
                    </div>
                    <div>
                      <span>Operador</span>
                      <code>{predicate.operator}</code>
                    </div>
                    <div>
                      <span>Esperado</span>
                      <strong>{predicateValueLabel(predicate.expected)}</strong>
                    </div>
                    <div>
                      <span>Observado</span>
                      <strong>{predicateValueLabel(predicate.actual)}</strong>
                    </div>
                    <div>
                      <span>Resultado</span>
                      <strong
                        className="applicability-predicate-result"
                        data-result={predicate.result}
                      >
                        {predicateResultLabel(predicate.result)}
                      </strong>
                      <code>{predicate.result}</code>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </details>
    </article>
  );
}
