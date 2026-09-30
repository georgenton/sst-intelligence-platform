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
};
type PsychosocialProgram = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  legalSourceVersion?: {
    catalogVersion: number;
    source: {
      sourceKey: string;
      canonicalTitle: string;
      issuer: string;
      officialUrl: string | null;
    };
  } | null;
  assessmentCycles: PsychosocialCycle[];
};

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
  const [errorMessage, setErrorMessage] = useState('');
  const request = <T,>(path: string, init?: RequestInit) =>
    auth.request<T>(path, init, organizationId ?? undefined);
  const programs = useQuery({
    queryKey: ['occupational-health', organizationId],
    queryFn: () => request<OccupationalProgram[]>('/occupational-health/programs'),
    enabled: Boolean(organizationId),
  });
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
      request<OccupationalProgram>(`/occupational-health/programs/${current?.id}/activities`, {
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
        }),
      }),
    onSuccess: () =>
      void cache.invalidateQueries({ queryKey: ['occupational-health', organizationId] }),
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
            {current.legalSourceVersion ? (
              <details>
                <summary>Fundamento legal relacionado</summary>
                <p>
                  {current.legalSourceVersion.source.canonicalTitle} · Artículo 19 de MDT-2024-196.
                  Consulta el{' '}
                  <a
                    href={current.legalSourceVersion.source.officialUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    enlace oficial
                  </a>
                  . El fundamento se muestra como contexto y no como una regla automática.
                </p>
              </details>
            ) : null}
          </div>
          <div className="card">
            <h2>Evaluación del período</h2>
            <p>
              Elige un instrumento declarado por la organización. El cuestionario del Ministerio es
              opcional; otros instrumentos quedan sujetos a revisión profesional.
            </p>
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
                        <input
                          aria-label="ID del ítem del Plan Operativo"
                          value={planItemId}
                          onChange={(event) => setPlanItemId(event.target.value)}
                          placeholder="UUID del ítem"
                        />
                        <button
                          className="button link"
                          type="button"
                          onClick={() => linkPlanItem.mutate(item.id)}
                          disabled={!planItemId.trim() || linkPlanItem.isPending}
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
