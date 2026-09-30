'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';

type OccupationalActivity = {
  id: string;
  componentKey: string;
  title: string;
  description?: string | null;
  status: string;
  plannedAt?: string | null;
  completedAt?: string | null;
  evidenceType?: string | null;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
  linkedOperationalPlanItemId?: string | null;
};
type OccupationalProgram = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  scopeSummary?: string | null;
  coordinatorName?: string | null;
  activities: OccupationalActivity[];
};
type PsychosocialCycle = {
  id: string;
  status: string;
  instrumentName: string;
  instrumentVersion?: string | null;
  instrumentProvider?: string | null;
  instrumentSourceType: string;
  targetPopulationCount?: number | null;
  participantCount?: number | null;
  aggregateReportAvailable: boolean;
  aggregateReportUrl?: string | null;
  linkedOperationalPlanItemId?: string | null;
  instrumentSourceVersion?: {
    id: string;
    catalogVersion: number;
    officialUrl?: string | null;
    source: { sourceKey: string; canonicalTitle: string; issuer: string };
  } | null;
};
type PsychosocialProgram = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  assessmentCycles: PsychosocialCycle[];
};

type PlanContext = {
  activePlan: { planId: string; name: string; version: number } | null;
};
type OperationalPlan = {
  versions: Array<{
    status: string;
    items: Array<{
      id: string;
      title: string;
      displayOrder: number;
      responsible?: { displayName: string } | null;
      execution?: { status: string } | null;
    }>;
  }>;
};
type PsychosocialLegalContext = {
  status: 'VERIFIED_CONTEXT' | 'NO_DIRECT_LEGAL_BASIS' | 'CONTEXT_REQUIRED' | 'JURISDICTION_NOT_SUPPORTED';
  jurisdictionCode: string;
  totalWorkerCount: number | null;
  explanation: string;
  source?: { title: string; officialUrl: string | null; unitLocators: string[] };
};

const FREE_TEXT_PRIVACY_WARNING =
  'No incluyas nombres de trabajadores, diagnósticos, resultados individuales ni información médica o psicológica personal.';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function endOfYear() {
  return `${new Date().getUTCFullYear()}-12-31`;
}

function StateMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert">No pudimos cargar esta superficie. Revisa tu acceso e inténtalo de nuevo.</p>
  );
}

export function HealthAtWorkDashboard() {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId;
  const cache = useQueryClient();
  const [title, setTitle] = useState('Programa de salud en el trabajo');
  const [scopeSummary, setScopeSummary] = useState(
    'Coordinación preventiva de la organización y sus centros.',
  );
  const [coordinatorName, setCoordinatorName] = useState('');
  const [activityEvidenceNote, setActivityEvidenceNote] = useState('');
  const [activityEvidenceUrl, setActivityEvidenceUrl] = useState('');
  const [activityPlanItemId, setActivityPlanItemId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const request = <T,>(path: string, init?: RequestInit) =>
    auth.request<T>(path, init, organizationId ?? undefined);
  const programs = useQuery({
    queryKey: ['occupational-health', organizationId],
    queryFn: () => request<OccupationalProgram[]>('/occupational-health/programs'),
    enabled: Boolean(organizationId),
  });
  const planContext = useQuery({
    queryKey: ['operational-plan-context', organizationId],
    queryFn: () => request<PlanContext>('/operational-plans/context'),
    enabled: Boolean(organizationId),
  });
  const activePlan = useQuery({
    queryKey: ['operational-plan-active', organizationId, planContext.data?.activePlan?.planId],
    queryFn: () => request<OperationalPlan>(`/operational-plans/${planContext.data!.activePlan!.planId}`),
    enabled: Boolean(organizationId && planContext.data?.activePlan?.planId),
  });
  const activePlanItems =
    activePlan.data?.versions.find((version) => version.status === 'ACTIVE')?.items ?? [];
  const current = programs.data?.[0];
  const create = useMutation({
    mutationFn: () =>
      request<OccupationalProgram>('/occupational-health/programs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          periodStart: today(),
          periodEnd: endOfYear(),
          title,
          scopeSummary,
          coordinatorName: coordinatorName || undefined,
        }),
      }),
    onSuccess: () => {
      setErrorMessage('');
      void cache.invalidateQueries({ queryKey: ['occupational-health', organizationId] });
    },
    onError: () =>
      setErrorMessage('No se pudo registrar el programa. Revisa los datos e inténtalo de nuevo.'),
  });
  const activity = useMutation({
    mutationFn: () =>
      request<OccupationalProgram>(
        `/occupational-health/programs/${current?.id}/activities`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            componentKey: 'PREVENTIVE_COORDINATION',
            title: 'Revisión preventiva y seguimiento',
            ...(activityEvidenceUrl.trim()
              ? { evidenceType: 'EXTERNAL_LINK', evidenceUrl: activityEvidenceUrl.trim() }
              : activityEvidenceNote.trim()
                ? { evidenceType: 'NOTE', evidenceNote: activityEvidenceNote.trim() }
                : {}),
            ...(activityPlanItemId ? { linkedOperationalPlanItemId: activityPlanItemId } : {}),
          }),
        },
      ),
    onSuccess: () => {
      setActivityPlanItemId('');
      void cache.invalidateQueries({ queryKey: ['occupational-health', organizationId] });
    },
    onError: () => setErrorMessage('No se pudo registrar la actividad.'),
  });
  const complete = useMutation({
    mutationFn: (activityId: string) =>
      request(`/occupational-health/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', completedAt: new Date().toISOString() }),
      }),
    onSuccess: () =>
      void cache.invalidateQueries({ queryKey: ['occupational-health', organizationId] }),
    onError: () => setErrorMessage('No se pudo actualizar la actividad.'),
  });
  return (
    <main className="workspace-page" aria-labelledby="health-at-work-title">
      <header className="page-header">
        <p className="eyebrow">Coordinación preventiva</p>
        <h1 id="health-at-work-title">Salud en el trabajo</h1>
        <p>
          Organiza períodos, responsables, actividades preventivas y evidencias. Esta superficie no
          guarda historias clínicas ni resultados médicos individuales.
        </p>
      </header>
      <StateMessage error={programs.error} />
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {!current ? (
        <section className="card-stack" aria-labelledby="health-empty-title">
          <div className="card">
            <h2 id="health-empty-title">No hay un programa registrado para este período.</h2>
            <p>Registra la coordinación preventiva que tu organización ya realiza.</p>
            <label>
              Título
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              Alcance preventivo
              <textarea
                value={scopeSummary}
                onChange={(event) => setScopeSummary(event.target.value)}
              />
            </label>
            <label>
              Persona coordinadora (opcional)
              <input
                value={coordinatorName}
                onChange={(event) => setCoordinatorName(event.target.value)}
              />
            </label>
            <p className="field-hint">{FREE_TEXT_PRIVACY_WARNING}</p>
            <button
              className="button"
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              Crear programa
            </button>
          </div>
        </section>
      ) : (
        <section className="card-stack">
          <div className="card">
            <p className="eyebrow">Programa actual</p>
            <h2>{current.title}</h2>
            <p>
              Período: {current.periodStart.slice(0, 10)} — {current.periodEnd.slice(0, 10)}
            </p>
            <p>Estado: {current.status}</p>
            <p>{current.scopeSummary ?? 'Sin alcance descrito.'}</p>
            <p>
              {current.coordinatorName
                ? `Coordina: ${current.coordinatorName}`
                : 'Sin persona coordinadora registrada.'}
            </p>
          </div>
          <div className="card">
            <div className="split-heading">
              <h2>Actividades preventivas</h2>
              <button
                className="button secondary"
                type="button"
                onClick={() => activity.mutate()}
                disabled={activity.isPending}
              >
                Añadir actividad
              </button>
            </div>
            <label>
              Nota de evidencia de la próxima actividad (opcional)
              <input
                value={activityEvidenceNote}
                onChange={(event) => {
                  setActivityEvidenceNote(event.target.value);
                  setActivityEvidenceUrl('');
                }}
              />
            </label>
            <p className="field-hint">{FREE_TEXT_PRIVACY_WARNING}</p>
            <label>
              Enlace HTTPS de evidencia (opcional)
              <input
                type="url"
                value={activityEvidenceUrl}
                onChange={(event) => {
                  setActivityEvidenceUrl(event.target.value);
                  setActivityEvidenceNote('');
                }}
                placeholder="https://..."
              />
            </label>
            <label>
              Ítem activo del Plan Operativo (opcional)
              <select
                aria-label="Ítem del Plan Operativo"
                value={activityPlanItemId}
                onChange={(event) => setActivityPlanItemId(event.target.value)}
              >
                <option value="">Sin enlazar todavía</option>
                {activePlanItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.execution?.status ?? 'PLANNED'}
                    {item.responsible?.displayName ? ` · ${item.responsible.displayName}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {current.activities.length === 0 ? (
              <p>Aún no hay actividades registradas.</p>
            ) : (
              <ul>
                {current.activities.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <span> · {item.status}</span>
                    {item.status !== 'COMPLETED' ? (
                      <button
                        className="button link"
                        type="button"
                        onClick={() => complete.mutate(item.id)}
                      >
                        Marcar completada
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2>Evidencias y revisión</h2>
            <p>
              Vincula notas o enlaces HTTPS a cada actividad. La próxima revisión se coordina desde
              este programa y el Plan Operativo.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export function PsychosocialDashboard() {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId;
  const cache = useQueryClient();
  const [title, setTitle] = useState('Programa de prevención de riesgos psicosociales');
  const [instrumentName, setInstrumentName] = useState('');
  const [instrumentSourceType, setInstrumentSourceType] = useState('MINISTRY_QUESTIONNAIRE');
  const [targetPopulationCount, setTargetPopulationCount] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [aggregateReportUrl, setAggregateReportUrl] = useState('');
  const [planItemId, setPlanItemId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const request = <T,>(path: string, init?: RequestInit) =>
    auth.request<T>(path, init, organizationId ?? undefined);
  const programs = useQuery({
    queryKey: ['psychosocial', organizationId],
    queryFn: () => request<PsychosocialProgram[]>('/psychosocial/programs'),
    enabled: Boolean(organizationId),
  });
  const legalContext = useQuery({
    queryKey: ['psychosocial-legal-context', organizationId],
    queryFn: () => request<PsychosocialLegalContext>('/psychosocial/legal-context'),
    enabled: Boolean(organizationId),
  });
  const planContext = useQuery({
    queryKey: ['psychosocial-operational-plan-context', organizationId],
    queryFn: () => request<PlanContext>('/operational-plans/context'),
    enabled: Boolean(organizationId),
  });
  const activePlan = useQuery({
    queryKey: ['psychosocial-operational-plan-active', organizationId, planContext.data?.activePlan?.planId],
    queryFn: () => request<OperationalPlan>(`/operational-plans/${planContext.data!.activePlan!.planId}`),
    enabled: Boolean(organizationId && planContext.data?.activePlan?.planId),
  });
  const activePlanItems =
    activePlan.data?.versions.find((version) => version.status === 'ACTIVE')?.items ?? [];
  const current = programs.data?.[0];
  const create = useMutation({
    mutationFn: () =>
      request<PsychosocialProgram>('/psychosocial/programs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ periodStart: today(), periodEnd: endOfYear(), title }),
      }),
    onSuccess: () => {
      setErrorMessage('');
      void cache.invalidateQueries({ queryKey: ['psychosocial', organizationId] });
    },
    onError: () =>
      setErrorMessage(
        'No se pudo registrar el programa. Comprueba que la capacidad esté habilitada para esta organización.',
      ),
  });
  const cycle = useMutation({
    mutationFn: () =>
      request<PsychosocialProgram>(`/psychosocial/programs/${current?.id}/cycles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          instrumentName,
          instrumentSourceType,
          targetPopulationCount: targetPopulationCount ? Number(targetPopulationCount) : undefined,
          participantCount: participantCount ? Number(participantCount) : undefined,
          aggregateReportAvailable: Boolean(aggregateReportUrl.trim()),
          aggregateReportUrl: aggregateReportUrl.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      setInstrumentName('');
      void cache.invalidateQueries({ queryKey: ['psychosocial', organizationId] });
    },
    onError: () =>
      setErrorMessage(
        'No se pudo registrar el ciclo. Usa únicamente datos agregados y compatibles.',
      ),
  });
  const completeCycle = useMutation({
    mutationFn: (cycleId: string) =>
      request<PsychosocialProgram>(`/psychosocial/cycles/${cycleId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      }),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['psychosocial', organizationId] }),
    onError: () => setErrorMessage('No se pudo cerrar la evaluación. Revisa los datos agregados.'),
  });
  const linkPlanItem = useMutation({
    mutationFn: (cycleId: string) =>
      request<PsychosocialProgram>(`/psychosocial/cycles/${cycleId}/plan-item`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationalPlanItemId: planItemId.trim() }),
      }),
    onSuccess: () => {
      setPlanItemId('');
      void cache.invalidateQueries({ queryKey: ['psychosocial', organizationId] });
    },
    onError: () =>
      setErrorMessage(
        'No se pudo enlazar el ítem. Confirma que pertenece a la organización activa.',
      ),
  });
  return (
    <main className="workspace-page" aria-labelledby="psychosocial-title">
      <header className="page-header">
        <p className="eyebrow">Programa organizacional</p>
        <h1 id="psychosocial-title">Prevención de riesgos psicosociales</h1>
        <p>
          Registra períodos, instrumentos, participación agregada, informes y acciones preventivas.
          No guardamos respuestas ni puntuaciones individuales.
        </p>
      </header>
      <StateMessage error={programs.error} />
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {!current ? (
        <section className="card">
          <h2>No hay un programa registrado para este período.</h2>
          <p>Registra el programa que tu organización ya coordina.</p>
          <label>
            Título
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <button
            className="button"
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            Crear programa
          </button>
        </section>
      ) : (
        <section className="card-stack">
          <div className="card">
            <p className="eyebrow">Programa actual</p>
            <h2>{current.title}</h2>
            <p>
              Período: {current.periodStart.slice(0, 10)} — {current.periodEnd.slice(0, 10)} ·
              Estado: {current.status}
            </p>
            {legalContext.data?.status === 'VERIFIED_CONTEXT' && legalContext.data.source ? (
              <details>
                <summary>Fundamento legal relacionado</summary>
                <p>
                  {legalContext.data.source.title} · Artículos 19 y 20 de MDT-2024-196.
                  Consulta el{' '}
                  <a
                    href={legalContext.data.source.officialUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    enlace oficial
                  </a>
                  . El fundamento se muestra como contexto y no como una regla automática.
                </p>
              </details>
            ) : legalContext.data?.status === 'CONTEXT_REQUIRED' ? (
              <p role="status">{legalContext.data.explanation}</p>
            ) : legalContext.data?.status === 'JURISDICTION_NOT_SUPPORTED' ? (
              <p role="status">{legalContext.data.explanation}</p>
            ) : legalContext.data?.status === 'NO_DIRECT_LEGAL_BASIS' ? (
              <p role="status">{legalContext.data.explanation}</p>
            ) : null}
          </div>
          <div className="card">
            <h2>Evaluación del período</h2>
            <p>
              Elige un instrumento declarado por la organización. El cuestionario del Ministerio es
              opcional; otros instrumentos quedan sujetos a revisión profesional.
            </p>
            <p className="field-hint">{FREE_TEXT_PRIVACY_WARNING}</p>
            <label>
              Instrumento
              <input
                value={instrumentName}
                onChange={(event) => setInstrumentName(event.target.value)}
                placeholder="Nombre del instrumento"
              />
            </label>
            <label>
              Origen
              <select
                value={instrumentSourceType}
                onChange={(event) => setInstrumentSourceType(event.target.value)}
              >
                <option value="MINISTRY_QUESTIONNAIRE">Cuestionario del Ministerio</option>
                <option value="EXTERNAL_VALIDATED">Instrumento externo validado</option>
                <option value="OTHER_DECLARED">Otro instrumento declarado</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                Población objetivo
                <input
                  type="number"
                  min="0"
                  value={targetPopulationCount}
                  onChange={(event) => setTargetPopulationCount(event.target.value)}
                />
              </label>
              <label>
                Participación agregada
                <input
                  type="number"
                  min="0"
                  value={participantCount}
                  onChange={(event) => setParticipantCount(event.target.value)}
                />
              </label>
            </div>
            <label>
              Informe agregado externo (opcional)
              <input
                type="url"
                value={aggregateReportUrl}
                onChange={(event) => setAggregateReportUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <button
              className="button"
              type="button"
              onClick={() => cycle.mutate()}
              disabled={cycle.isPending || !instrumentName.trim()}
            >
              Registrar evaluación
            </button>
          </div>
          <div className="card">
            <h2>Ciclos e intervenciones</h2>
            {current.assessmentCycles.length === 0 ? (
              <p>No hay un ciclo registrado.</p>
            ) : (
              <ul>
                {current.assessmentCycles.map((item) => (
                  <li key={item.id}>
                    <strong>{item.instrumentName}</strong> · {item.status} ·{' '}
                    {item.participantCount ?? 0}/{item.targetPopulationCount ?? '—'} participación
                    agregada
                    {item.instrumentSourceVersion
                      ? ` · fuente oficial: ${item.instrumentSourceVersion.source.canonicalTitle}`
                      : ''}
                    {item.linkedOperationalPlanItemId ? ' · enlazado al Plan Operativo' : ''}
                    {item.aggregateReportAvailable ? ' · informe agregado disponible' : ''}
                    {item.status !== 'COMPLETED' ? (
                      <button
                        className="button link"
                        type="button"
                        onClick={() => completeCycle.mutate(item.id)}
                      >
                        Marcar realizada
                      </button>
                    ) : null}
                    {!item.linkedOperationalPlanItemId ? (
                      <>
                        <select
                          aria-label="Ítem del Plan Operativo"
                          value={planItemId}
                          onChange={(event) => setPlanItemId(event.target.value)}
                        >
                          <option value="">Selecciona una intervención existente</option>
                          {activePlanItems.map((planItem) => (
                            <option key={planItem.id} value={planItem.id}>
                              {planItem.title} · {planItem.execution?.status ?? 'PLANNED'}
                              {planItem.responsible?.displayName
                                ? ` · ${planItem.responsible.displayName}`
                                : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          className="button link"
                          type="button"
                          onClick={() => linkPlanItem.mutate(item.id)}
                          disabled={!planItemId || linkPlanItem.isPending}
                        >
                          Confirmar intervención
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p>
              Las intervenciones se confirman de forma humana en el Plan Operativo; no se crean
              automáticamente desde un resultado.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
