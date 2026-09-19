'use client';

import { Card } from '@sst/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { inspectionDepthLabel } from '@/lib/inspection-experience';
import {
  INSPECTION_CRITERION_OUTCOME_LABELS,
  INSPECTION_DOMAIN_LABELS,
  type InspectionCriterionOutcome,
} from '@/lib/inspection-standard-presentation';
import type { Inspection, InspectionApi } from './inspections-ui';
import { InlineRequestState } from './inspection-experience-ui';
import { TechnicalDetails } from './technical-details';
import { useRealRequestFeedback } from './use-real-request-feedback';

type Result = NonNullable<Inspection['criterionResults']>[number];
type Draft = { outcome?: InspectionCriterionOutcome; note: string; references: string };
const symbols: Record<InspectionCriterionOutcome, string> = {
  CONFORME: '●',
  NO_CONFORME: '▲',
  NO_APLICA: '◇',
  NO_VERIFICADO: '○',
};
const meanings: Record<InspectionCriterionOutcome, string> = {
  CONFORME: 'Cumple el criterio observado',
  NO_CONFORME: 'No cumple lo observado',
  NO_APLICA: 'El criterio no corresponde',
  NO_VERIFICADO: 'No se pudo comprobar',
};
const referencesText = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join('\n')
    : '';
const storedDraft = (result: Result): Draft => ({
  outcome: result.hasRecordedResult ? result.outcome : undefined,
  note: result.note ?? '',
  references: referencesText(result.evidenceReferences),
});
const dirty = (draft: Draft, result: Result) => {
  const stored = storedDraft(result);
  return (
    draft.outcome !== stored.outcome ||
    draft.note !== stored.note ||
    draft.references !== stored.references
  );
};

export function InspectionLiveContext({
  inspection,
  organizationName,
}: {
  inspection: Inspection;
  organizationName?: string;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 700px)');
    const match = () => {
      if (details.current) details.current.open = !mobile.matches;
    };
    match();
    mobile.addEventListener('change', match);
    return () => mobile.removeEventListener('change', match);
  }, []);
  const results = inspection.criterionResults ?? [];
  const reviewed = results.filter(({ hasRecordedResult }) => hasRecordedResult).length;
  return (
    <aside className="inspection-live-context" aria-label="Contexto de inspección">
      <details ref={details} open>
        <summary>
          <span className="eyebrow">Inspección actual</span>
          <strong>
            {inspection.workCenter.name} ·{' '}
            {inspection.resourceScopeSnapshot?.resource.name ?? 'Alcance general sin recurso'}
          </strong>
        </summary>
        <div className="inspection-live-context-body">
          <dl>
            <div>
              <dt>Organización</dt>
              <dd>{organizationName ?? 'Organización activa'}</dd>
            </div>
            <div>
              <dt>Centro / área</dt>
              <dd>
                {inspection.workCenter.name}
                {inspection.workArea ? ` · ${inspection.workArea.name}` : ''}
              </dd>
            </div>
            <div>
              <dt>Dominio</dt>
              <dd>
                {inspection.inspectionDomain
                  ? INSPECTION_DOMAIN_LABELS[inspection.inspectionDomain]
                  : 'Registro histórico sin dominio'}
              </dd>
            </div>
            <div>
              <dt>Recurso</dt>
              <dd>
                {inspection.resourceScopeSnapshot?.resource.name ??
                  'General · sin mapeo por recurso'}
              </dd>
            </div>
            <div>
              <dt>Base</dt>
              <dd>
                {inspection.inspectionBasisSnapshot?.definition.name ??
                  inspection.standardSnapshot?.source.name ??
                  inspection.inspectionBasisVersion?.definition.name ??
                  inspection.standardVersion?.source.name ??
                  'Sin base técnica asociada'}
              </dd>
            </div>
            <div>
              <dt>Profundidad</dt>
              <dd>{inspectionDepthLabel(inspection.inspectionDepth)}</dd>
            </div>
            <div>
              <dt>Metodología del hallazgo</dt>
              <dd>
                {inspection.riskMethodVersion.displayName} · v
                {inspection.riskMethodVersion.semanticVersion}
              </dd>
            </div>
            <div>
              <dt>Criterios registrados</dt>
              <dd>
                {reviewed} de {results.length}
              </dd>
            </div>
          </dl>
          <TechnicalDetails summary="Fuentes y configuración conservada">
            {inspection.inspectionBasisSnapshot?.technicalSources.map((link) => (
              <p key={link.version.id}>
                <strong>
                  {link.role === 'PRIMARY_TECHNICAL'
                    ? 'Principal'
                    : link.role === 'SUPPLEMENTAL_TECHNICAL'
                      ? 'Suplementaria'
                      : 'Interna'}
                  :
                </strong>{' '}
                {link.source.name} · {link.version.edition} · Jurisdicción:{' '}
                {link.source.jurisdiction ?? 'No indicada'}
                <small>
                  Versión {link.version.code} · huella {link.version.digest}
                </small>
              </p>
            )) ??
              inspection.inspectionBasisVersion?.technicalSources.map((link) => (
                <p key={link.id}>
                  <strong>
                    {link.role === 'PRIMARY_TECHNICAL'
                      ? 'Principal'
                      : link.role === 'SUPPLEMENTAL_TECHNICAL'
                        ? 'Suplementaria'
                        : 'Interna'}
                    :
                  </strong>{' '}
                  {link.standardVersion.source.name} · {link.standardVersion.editionLabel} ·{' '}
                  {link.standardVersion.source.originCountry ?? 'Jurisdicción no indicada'}
                </p>
              )) ??
              (inspection.standardVersion ? (
                <p>
                  Principal:{' '}
                  {inspection.standardSnapshot?.source.name ??
                    inspection.standardVersion.source.name}{' '}
                  ·{' '}
                  {inspection.standardSnapshot?.version.editionLabel ??
                    inspection.standardVersion.editionLabel}
                </p>
              ) : null)}
            <p>La base técnica no equivale a una ley, metodología de riesgo ni protocolo.</p>
            {inspection.inspectionBasisVersion?.regulatoryUnits.map(({ id, regulatoryUnit }) => (
              <p key={id}>
                Contexto regulatorio separado: {regulatoryUnit.sourceVersion.source.canonicalTitle}{' '}
                · {regulatoryUnit.identifier} · {regulatoryUnit.sourceVersion.source.countryCode}
              </p>
            ))}
            {inspection.resourceScopeSnapshot ? (
              <p>
                Taxonomía v{inspection.resourceScopeSnapshot.taxonomy.version} · mapeo v
                {inspection.resourceScopeSnapshot.mapping.version}
              </p>
            ) : null}
          </TechnicalDetails>
          <p className="inspection-invariant-note">
            Esta inspección conserva la configuración utilizada ese día. Cambiar la base no altera
            sus criterios ni resultados guardados.
          </p>
        </div>
      </details>
    </aside>
  );
}

export function InspectionCriterionExecution({
  api,
  inspection,
  editable,
}: {
  api: InspectionApi;
  inspection: Inspection;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const results = inspection.criterionResults ?? [];
  const [activeId, setActiveId] = useState(
    () => results.find(({ hasRecordedResult }) => !hasRecordedResult)?.id ?? results[0]?.id,
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [feedback, setFeedback] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const activeIndex = Math.max(
    0,
    results.findIndex(({ id }) => id === activeId),
  );
  const result = results[activeIndex];
  const hasUnsaved = results.some((item) => drafts[item.id] && dirty(drafts[item.id]!, item));
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);
  useEffect(() => {
    if (editable) heading.current?.focus();
  }, [activeId, editable]);
  const navigate = (index: number) => {
    const next = results[index];
    if (next) setActiveId(next.id);
  };
  const mutation = useMutation({
    mutationFn: ({ result: target, draft }: { result: Result; draft: Draft }) =>
      api.request<Result>(`/inspections/${inspection.id}/criteria/${target.criterion.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          outcome: draft.outcome,
          note: draft.note.trim() || undefined,
          evidenceReferences: draft.references
            .split('\n')
            .map((reference) => reference.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<Inspection>(
        queryKeys.organization.inspection(api.organizationId!, inspection.id),
        (current) =>
          current
            ? {
                ...current,
                criterionResults: current.criterionResults?.map((item) =>
                  item.id === updated.id
                    ? {
                        ...item,
                        ...updated,
                        criterion: {
                          ...item.criterion,
                          ...updated.criterion,
                          standardVersion: item.criterion.standardVersion,
                        },
                      }
                    : item,
                ),
              }
            : current,
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      setFeedback('Registrado');
      if (updated.outcome !== 'NO_CONFORME' || updated.finding) {
        const index = results.findIndex(({ id }) => id === variables.result.id);
        navigate(index + 1);
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspection(api.organizationId!, inspection.id),
      });
    },
  });
  const pendingFeedback = useRealRequestFeedback(mutation.isPending);
  if (!result) return null;
  const draft = drafts[result.id] ?? storedDraft(result);
  const setDraft = (patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [result.id]: { ...draft, ...patch } }));
  const reviewed = results.filter(({ hasRecordedResult }) => hasRecordedResult).length;
  const missingNote = draft.outcome === 'NO_CONFORME' && !draft.note.trim();
  const canSave = editable && draft.outcome && !missingNote && !mutation.isPending;
  const source = result.criterion.standardVersion;
  const frozenSource = inspection.inspectionBasisSnapshot?.technicalSources.find(
    ({ version }) => version.id === source?.id,
  );
  const sourceRole =
    frozenSource?.role ??
    inspection.inspectionBasisVersion?.technicalSources.find(
      ({ standardVersion }) => standardVersion.id === source?.id,
    )?.role;
  return (
    <section className="inspection-focal-execution" aria-label="Ejecución de criterios">
      <div className="inspection-criterion-progress">
        <strong>
          {reviewed} de {results.length} criterios registrados
        </strong>
        <progress value={reviewed} max={results.length} aria-label="Criterios registrados" />
        <span>{results.length - reviewed} sin registrar</span>
      </div>
      <Card className="inspection-criterion-card inspection-focal-card">
        <div className="inspection-criterion-heading">
          <div>
            <p className="eyebrow">
              Criterio {activeIndex + 1} de {results.length} · {result.criterion.section?.title}
            </p>
            <h2 ref={heading} tabIndex={-1}>
              {result.criterion.title}
            </h2>
          </div>
          <span className={`criterion-outcome criterion-outcome--${result.outcome.toLowerCase()}`}>
            {result.hasRecordedResult
              ? INSPECTION_CRITERION_OUTCOME_LABELS[result.outcome]
              : 'Sin registrar'}
          </span>
        </div>
        <p>{result.criterion.guidance}</p>
        {source ? (
          <div className="inspection-standard-basis">
            <strong>
              Origen:{' '}
              {frozenSource?.source.name ??
                inspection.standardSnapshot?.source.name ??
                source.source.name}
            </strong>
            <p>
              {sourceRole === 'SUPPLEMENTAL_TECHNICAL'
                ? 'Referencia suplementaria'
                : sourceRole === 'INTERNAL_ORGANIZATION'
                  ? 'Fuente interna'
                  : 'Fuente principal'}{' '}
              ·{' '}
              {frozenSource?.version.edition ??
                inspection.standardSnapshot?.version.editionLabel ??
                source.editionLabel}{' '}
              · Jurisdicción:{' '}
              {frozenSource?.source.jurisdiction ?? source.source.originCountry ?? 'No indicada'}
              {result.criterion.sourceLocator ? ` · ${result.criterion.sourceLocator}` : ''}
            </p>
          </div>
        ) : null}
        {result.finding ? (
          <p className="inspection-invariant-note">
            Este criterio conserva No conforme porque tiene un hallazgo vinculado. La observación y
            las referencias pueden actualizarse durante el recorrido; el resultado no puede cambiar.
          </p>
        ) : null}
        <fieldset
          className="inspection-result-controls"
          aria-describedby={!result.canMarkNotApplicable ? `na-reason-${result.id}` : undefined}
          disabled={!editable || mutation.isPending}
        >
          <legend>Resultado observado</legend>
          <div className="inspection-result-options">
            {(
              Object.entries(INSPECTION_CRITERION_OUTCOME_LABELS) as Array<
                [InspectionCriterionOutcome, string]
              >
            ).map(([value, label]) => (
              <label
                key={value}
                className="inspection-result-option"
                data-selected={draft.outcome === value}
              >
                <input
                  type="radio"
                  name={`criterion-outcome-${result.id}`}
                  value={value}
                  checked={draft.outcome === value}
                  disabled={
                    (value === 'NO_APLICA' && !result.canMarkNotApplicable) ||
                    Boolean(result.finding && value !== 'NO_CONFORME')
                  }
                  onChange={() => {
                    setDraft({ outcome: value });
                    setFeedback('');
                  }}
                />
                <span aria-hidden="true">{symbols[value]}</span>
                <span>
                  <strong>{label}</strong>
                  <small>{meanings[value]}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {!result.canMarkNotApplicable ? (
          <p id={`na-reason-${result.id}`} className="inspection-invariant-note">
            No aplica no disponible:{' '}
            {result.notApplicableReason ?? 'Este criterio requiere verificación.'}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor={`criterion-note-${result.id}`}>
            Observación {draft.outcome === 'NO_CONFORME' ? '(obligatoria)' : '(opcional)'}
          </label>
          <textarea
            id={`criterion-note-${result.id}`}
            rows={3}
            maxLength={2000}
            value={draft.note}
            disabled={!editable || mutation.isPending}
            onChange={(event) => setDraft({ note: event.target.value })}
            aria-invalid={missingNote}
          />
          {missingNote ? (
            <small className="field-error">
              Describe la condición observada antes de guardar No conforme.
            </small>
          ) : null}
        </div>
        <TechnicalDetails summary="Referencias de evidencia opcionales">
          <label className="field">
            <span>Referencias de evidencia (una por línea, opcional)</span>
            <textarea
              rows={2}
              maxLength={22000}
              value={draft.references}
              disabled={!editable || mutation.isPending}
              onChange={(event) => setDraft({ references: event.target.value })}
            />
          </label>
          <p>
            Esta versión registra notas y referencias o enlaces. No adjunta fotografías ni archivos.
          </p>
          {result.criterion.evidenceExpectation ? (
            <p>Evidencia esperada: {result.criterion.evidenceExpectation}</p>
          ) : null}
        </TechnicalDetails>
        <p className="inspection-invariant-note">
          No conforme describe la condición frente al criterio técnico; no declara automáticamente
          una infracción legal.
        </p>
        {mutation.isError ? (
          <InlineRequestState>
            No pudimos guardar el resultado. Tus cambios permanecen aquí; puedes reintentar. No se
            avanzó al siguiente criterio.
          </InlineRequestState>
        ) : null}
        <p className="inspection-save-feedback" role="status">
          {pendingFeedback
            ? 'Guardando resultado…'
            : feedback || (dirty(draft, result) ? 'Cambios locales sin guardar' : '')}
        </p>
        {editable ? (
          <button
            className="button"
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (canSave) mutation.mutate({ result, draft });
            }}
          >
            {pendingFeedback ? 'Guardando…' : 'Guardar resultado'}
          </button>
        ) : null}
        {result.hasRecordedResult ? (
          <small>
            Último registro: {result.actor.displayName} ·{' '}
            {new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(result.observedAt),
            )}
          </small>
        ) : null}
        {result.finding ? (
          <Link
            className="button secondary"
            href={`/app/inspections/${inspection.id}/findings/${result.finding.id}`}
          >
            Ver hallazgo vinculado
          </Link>
        ) : result.hasRecordedResult &&
          result.outcome === 'NO_CONFORME' &&
          editable &&
          !mutation.isPending &&
          !dirty(draft, result) ? (
          <section className="inspection-recurrence" aria-label="Siguiente paso para No conforme">
            <h3>¿Registrar un hallazgo?</h3>
            <p>
              El resultado ya está registrado. Crear un hallazgo es una decisión humana y vincula su
              valoración de riesgo. Después, el criterio conserva No conforme.
            </p>
            <div className="inspection-dialog-actions">
              <Link
                className="button"
                href={`/app/inspections/${inspection.id}/findings/new?criterionResultId=${result.id}`}
              >
                Registrar hallazgo
              </Link>
              <button
                className="button secondary"
                type="button"
                onClick={() => navigate(activeIndex + 1)}
                disabled={activeIndex === results.length - 1}
              >
                Solo registrar resultado · continuar
              </button>
            </div>
          </section>
        ) : null}
      </Card>
      <nav className="inspection-criterion-navigation" aria-label="Navegar criterios">
        <button
          className="button secondary"
          type="button"
          disabled={activeIndex === 0 || mutation.isPending}
          onClick={() => navigate(activeIndex - 1)}
        >
          Anterior
        </button>
        <div className="field">
          <label htmlFor="inspection-criterion-jump">Ir a criterio</label>
          <select
            id="inspection-criterion-jump"
            value={result.id}
            disabled={mutation.isPending}
            onChange={(event) => setActiveId(event.target.value)}
          >
            {results.map((item, index) => (
              <option key={item.id} value={item.id}>
                {index + 1} · {item.criterion.title} ·{' '}
                {item.hasRecordedResult
                  ? INSPECTION_CRITERION_OUTCOME_LABELS[item.outcome]
                  : 'Sin registrar'}
              </option>
            ))}
          </select>
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={activeIndex === results.length - 1 || mutation.isPending}
          onClick={() => navigate(activeIndex + 1)}
        >
          Siguiente criterio
        </button>
      </nav>
      <p className="inspection-invariant-note">
        Navegar conserva los cambios locales de este recorrido. Sólo Guardar resultado los registra;
        recargar puede descartar cambios sin guardar.
      </p>
    </section>
  );
}
