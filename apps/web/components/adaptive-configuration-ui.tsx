'use client';

import { ApiClientError } from '@sst/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  ADAPTIVE_DEMO_NOTICE,
  adaptiveCurrentStateOptions,
  adaptiveDepthLabel,
  adaptiveMutationMessage,
  adaptiveSessionStatusLabel,
  adaptiveStateLabel,
  canManageAdaptiveConfiguration,
} from '@/lib/adaptive-configuration-experience';
import type {
  AdaptivePackOption,
  AdaptiveProposal,
  AdaptiveProposalItem,
  AdaptiveQuestion,
  AdaptiveSessionDetail,
  AdaptiveSessionSummary,
} from '@/lib/adaptive-configuration-types';
import type { ApplicabilityProfileVersion } from '@/lib/applicability-types';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import {
  ApplicabilityPageHeader,
  ApplicabilitySkeleton,
  ApplicabilityStatePanel,
} from './applicability-experience-ui';
import { useAuth } from './auth-provider';

function shouldRetry(failureCount: number, error: Error) {
  return !(error instanceof ApiClientError && error.status < 500) && failureCount < 1;
}

function useAdaptiveApi() {
  const auth = useAuth();
  const organization = useOrganization();
  const active = organization.organizations.find(({ id }) => id === organization.activeId);
  return {
    organizationId: organization.activeId,
    loading: organization.loading,
    role: active?.memberships[0]?.role,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function AdaptiveNotice() {
  return (
    <aside className="adaptive-demo-notice" aria-label="Límite de demostración">
      <strong>Motor determinístico DEMO</strong>
      <p>{ADAPTIVE_DEMO_NOTICE}</p>
    </aside>
  );
}

const strategicPriorityOptions = [
  ['PEOPLE_AND_HEALTH', 'Personas y salud'],
  ['PRODUCTIVE_CONTINUITY', 'Continuidad productiva'],
  ['BUSINESS_CONTINUITY', 'Continuidad del negocio'],
  ['MACHINERY_AND_INFRASTRUCTURE', 'Maquinaria e infraestructura'],
  ['FINANCIAL_IMPACT', 'Impacto financiero'],
  ['REPUTATION', 'Reputación'],
  ['CONTRACTORS_AND_SUPPLY_CHAIN', 'Contratistas y cadena de suministro'],
  ['PRODUCT_OR_SERVICE_QUALITY', 'Calidad del producto o servicio'],
] as const;

function AdaptiveAccess({ children }: { children: React.ReactNode }) {
  const api = useAdaptiveApi();
  if (api.loading) return <ApplicabilitySkeleton label="Comprobando organización activa" />;
  if (!api.organizationId)
    return (
      <ApplicabilityStatePanel
        kind="info"
        title="Selecciona una organización"
        description="La configuración dinámica necesita un contexto de organización validado."
      />
    );
  return children;
}

export function AdaptiveConfigurationWorkspace() {
  const api = useAdaptiveApi();
  const organizationId = api.organizationId ?? 'no-organization';
  const enabled = Boolean(api.organizationId);
  const sessions = useQuery({
    queryKey: queryKeys.organization.adaptiveSessions(organizationId),
    queryFn: ({ signal }) =>
      api.request<AdaptiveSessionSummary[]>('/adaptive-configuration/sessions', { signal }),
    enabled,
    retry: shouldRetry,
  });
  const canManage = canManageAdaptiveConfiguration(api.role);

  return (
    <AdaptiveAccess>
      <div className="adaptive-workspace stack">
        <ApplicabilityPageHeader
          eyebrow="Configuración SST · capa adaptativa"
          title="Configuración dinámica"
          description="Genera preguntas según decisiones aún no resueltas y conserva cada propuesta histórica."
          action={
            <div className="applicability-detail-actions">
              <Link className="button secondary" href="/app/applicability">
                Volver a Configuración SST
              </Link>
              {canManage ? (
                <Link className="button" href="/app/applicability/adaptive/new">
                  Nueva sesión dinámica
                </Link>
              ) : null}
            </div>
          }
        />
        <AdaptiveNotice />
        {!canManage ? (
          <ApplicabilityStatePanel
            kind="info"
            title="Consulta de solo lectura"
            description="Tu membresía puede revisar sesiones y propuestas. Solo Propietarios, Administradores y Responsables SST pueden modificarlas."
          />
        ) : null}
        <section className="adaptive-section" aria-labelledby="adaptive-history-title">
          <div className="adaptive-section-heading">
            <div>
              <p className="applicability-kicker">Historial privado de la organización</p>
              <h2 id="adaptive-history-title">Sesiones anteriores</h2>
            </div>
            {sessions.data ? <span>{sessions.data.length} sesiones</span> : null}
          </div>
          {sessions.isLoading ? (
            <ApplicabilitySkeleton label="Cargando sesiones dinámicas" />
          ) : sessions.isError ? (
            <ApplicabilityStatePanel
              kind="error"
              title="No pudimos cargar las sesiones"
              description="No mostramos un estado vacío cuando existe un error."
              action={
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void sessions.refetch()}
                >
                  Reintentar
                </button>
              }
            />
          ) : sessions.data?.length ? (
            <div className="adaptive-session-list">
              {sessions.data.map((session) => {
                const latest = session.runs[0];
                return (
                  <article className="adaptive-session-card" key={session.id}>
                    <div>
                      <span className="status-badge">
                        {adaptiveSessionStatusLabel[session.status]}
                      </span>
                      <h3>{session.rulePackVersion.packDefinition.name}</h3>
                      <p>Información de la organización · marco de evaluación</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Preguntas pendientes</dt>
                        <dd>{latest?._count.questions ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Propuesta</dt>
                        <dd>
                          {latest?.proposal
                            ? `v${latest.proposal.proposalVersion}`
                            : 'Aún no disponible'}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      className="button secondary"
                      href={`/app/applicability/adaptive/${session.id}`}
                    >
                      Abrir sesión
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <ApplicabilityStatePanel
              kind="empty"
              title="Todavía no hay sesiones dinámicas"
              description="Usaremos la información disponible y preguntaremos solo lo necesario para preparar una propuesta."
              action={
                canManage ? (
                  <Link className="button" href="/app/applicability/adaptive/new">
                    Iniciar primera sesión
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>
      </div>
    </AdaptiveAccess>
  );
}

export function AdaptiveConfigurationNewSession() {
  const api = useAdaptiveApi();
  const router = useRouter();
  const organizationId = api.organizationId ?? 'no-organization';
  const enabled = Boolean(api.organizationId);
  const [profileVersionId, setProfileVersionId] = useState('');
  const [packVersionId, setPackVersionId] = useState('');
  const [strategicPriorities, setStrategicPriorities] = useState<string[]>([]);
  const profiles = useQuery({
    queryKey: queryKeys.organization.applicabilityProfileVersions(organizationId),
    queryFn: ({ signal }) =>
      api.request<ApplicabilityProfileVersion[]>('/applicability/profile-versions', { signal }),
    enabled,
    retry: shouldRetry,
  });
  const packs = useQuery({
    queryKey: queryKeys.organization.adaptiveRulePacks(organizationId),
    queryFn: ({ signal }) =>
      api.request<AdaptivePackOption[]>('/adaptive-configuration/rule-packs', { signal }),
    enabled,
    retry: shouldRetry,
  });
  const selectedProfile = profiles.data?.find(({ id }) => id === profileVersionId);
  const selectedPack = packs.data?.find(({ id }) => id === packVersionId);
  const create = useMutation({
    mutationFn: () =>
      api.request<AdaptiveSessionDetail>('/adaptive-configuration/sessions', {
        method: 'POST',
        body: JSON.stringify({
          profileVersionId,
          rulePackVersionId: packVersionId,
          strategicPriorities,
        }),
      }),
    onSuccess: (session) => router.push(`/app/applicability/adaptive/${session.id}`),
  });

  if (!canManageAdaptiveConfiguration(api.role) && !api.loading)
    return (
      <ApplicabilityStatePanel
        kind="error"
        title="No tienes permiso para iniciar una sesión"
        description="Esta acción está disponible para Propietario, Administrador y Responsable SST."
      />
    );

  return (
    <AdaptiveAccess>
      <div className="adaptive-workspace stack">
        <ApplicabilityPageHeader
          eyebrow="Nueva sesión adaptativa"
          title="Preparar configuración dinámica"
          description="Usaremos la información que ya conocemos y te preguntaremos solo lo necesario para preparar una propuesta."
          action={
            <Link className="button secondary" href="/app/applicability/adaptive">
              Cancelar
            </Link>
          }
        />
        <AdaptiveNotice />
        {profiles.isError || packs.isError ? (
          <ApplicabilityStatePanel
            kind="error"
            title="No pudimos cargar las referencias"
            description="Reintenta antes de iniciar. No se creó ninguna sesión."
          />
        ) : (
          <form
            className="adaptive-start-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (profileVersionId && packVersionId) create.mutate();
            }}
          >
            <fieldset>
              <legend>1. Información de la organización</legend>
              <label htmlFor="adaptive-profile">Información registrada</label>
              <select
                id="adaptive-profile"
                required
                value={profileVersionId}
                onChange={(event) => setProfileVersionId(event.target.value)}
              >
                <option value="">Selecciona una versión</option>
                {profiles.data?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    Información registrada · versión {profile.version}
                  </option>
                ))}
              </select>
              {selectedProfile ? (
                <p>
                  {selectedProfile.snapshot.organization.workCenterCount} centros incluidos según la
                  información seleccionada; se validará que sigan disponibles.
                </p>
              ) : null}
            </fieldset>
            <fieldset>
              <legend>2. Marco de evaluación</legend>
              <label htmlFor="adaptive-pack">Marco disponible</label>
              <select
                id="adaptive-pack"
                required
                value={packVersionId}
                onChange={(event) => setPackVersionId(event.target.value)}
              >
                <option value="">Selecciona un marco</option>
                {packs.data?.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.packDefinition.name} · v{pack.version}
                  </option>
                ))}
              </select>
              {selectedPack ? <p>{selectedPack.disclaimer}</p> : null}
            </fieldset>
            <fieldset>
              <legend>3. Prioridades estratégicas · opcional</legend>
              <p>
                Se conservan como contexto declarado. En V1 no cambian la aplicabilidad ni la
                profundidad mínima de la propuesta.
              </p>
              <div className="checkbox-grid">
                {strategicPriorityOptions.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      value={value}
                      checked={strategicPriorities.includes(value)}
                      onChange={(event) =>
                        setStrategicPriorities((current) =>
                          event.target.checked
                            ? [...current, value]
                            : current.filter((item) => item !== value),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {create.isError ? (
              <p className="field-error" role="alert">
                {adaptiveMutationMessage(create.error)}
              </p>
            ) : null}
            <button
              className="button"
              type="submit"
              disabled={!profileVersionId || !packVersionId || create.isPending}
            >
              {create.isPending ? 'Iniciando sesión…' : 'Iniciar sesión dinámica'}
            </button>
          </form>
        )}
      </div>
    </AdaptiveAccess>
  );
}

function questionInput(
  question: AdaptiveQuestion,
  value: string,
  setValue: (value: string) => void,
) {
  const common = {
    id: `question-${question.id}`,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValue(event.target.value),
  };
  if (question.factVersion.valueType === 'BOOLEAN') {
    return (
      <select {...common}>
        <option value="">No tengo información</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (question.factVersion.valueType === 'SINGLE_CHOICE') {
    return (
      <select {...common}>
        <option value="">No tengo información</option>
        {question.answerChoices.map((choice) => (
          <option key={choice} value={choice}>
            {choice.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      {...common}
      type={
        question.factVersion.valueType === 'INTEGER' || question.factVersion.valueType === 'DECIMAL'
          ? 'number'
          : 'text'
      }
      maxLength={question.factVersion.valueType === 'SHORT_TEXT' ? 300 : undefined}
      placeholder="No tengo información"
    />
  );
}

function normalizeQuestionValue(question: AdaptiveQuestion, raw: string): unknown {
  if (question.factVersion.valueType === 'BOOLEAN') return raw === 'true';
  if (question.factVersion.valueType === 'INTEGER' || question.factVersion.valueType === 'DECIMAL')
    return Number(raw);
  return raw;
}

export function AdaptiveConfigurationSessionView({ sessionId }: { sessionId: string }) {
  const api = useAdaptiveApi();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId ?? 'no-organization';
  const enabled = Boolean(api.organizationId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const session = useQuery({
    queryKey: queryKeys.organization.adaptiveSession(organizationId, sessionId),
    queryFn: ({ signal }) =>
      api.request<AdaptiveSessionDetail>(`/adaptive-configuration/sessions/${sessionId}`, {
        signal,
      }),
    enabled,
    retry: shouldRetry,
  });
  const latest = session.data?.runs[0];
  const proposalId = latest?.proposal?.id;
  const proposal = useQuery({
    queryKey: queryKeys.organization.adaptiveProposal(organizationId, proposalId ?? 'no-proposal'),
    queryFn: ({ signal }) =>
      api.request<AdaptiveProposal>(`/adaptive-configuration/proposals/${proposalId}`, { signal }),
    enabled: enabled && Boolean(proposalId),
    retry: shouldRetry,
  });
  const canManage = canManageAdaptiveConfiguration(api.role);
  const saveAndEvaluate = useMutation({
    mutationFn: async () => {
      if (!session.data) throw new Error('La sesión todavía no está disponible.');
      const payload = (latest?.questions ?? []).flatMap((question) => {
        const raw = answers[question.id]?.trim();
        return raw
          ? [
              {
                scopeId: question.scope.id,
                factVersionId: question.factVersion.id,
                value: normalizeQuestionValue(question, raw),
              },
            ]
          : [];
      });
      if (payload.length === 0)
        throw new Error('Responde al menos una pregunta antes de continuar.');
      const saved = await api.request<{ sessionRevision: number }>(
        `/adaptive-configuration/sessions/${sessionId}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({
            expectedSessionRevision: session.data.sessionRevision,
            answers: payload,
          }),
        },
      );
      return api.request(`/adaptive-configuration/sessions/${sessionId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ expectedSessionRevision: saved.sessionRevision }),
      });
    },
    onSuccess: async () => {
      setAnswers({});
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.adaptiveSession(organizationId, sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.adaptiveSessions(organizationId),
        }),
      ]);
    },
    onError: (error) => setFormError(adaptiveMutationMessage(error)),
  });
  const finalize = useMutation({
    mutationFn: () =>
      api.request(`/adaptive-configuration/sessions/${sessionId}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ expectedSessionRevision: session.data!.sessionRevision }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.adaptiveSession(organizationId, sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.adaptiveSessions(organizationId),
        }),
      ]);
    },
  });
  const questionGroups = useMemo(() => {
    const groups = new Map<string, AdaptiveQuestion[]>();
    for (const question of latest?.questions ?? []) {
      groups.set(question.scope.id, [...(groups.get(question.scope.id) ?? []), question]);
    }
    return [...groups.values()];
  }, [latest?.questions]);

  if (session.isLoading) return <ApplicabilitySkeleton label="Cargando sesión dinámica" />;
  if (session.isError)
    return (
      <ApplicabilityStatePanel
        kind="error"
        title="No pudimos abrir la sesión"
        description="Comprueba tu acceso y vuelve a intentarlo."
      />
    );
  if (!session.data) return null;

  return (
    <AdaptiveAccess>
      <div className="adaptive-workspace stack">
        <ApplicabilityPageHeader
          eyebrow="Configuración SST"
          title="Configuración dinámica"
          description="Las preguntas y la propuesta se adaptan a la información vigente de la organización."
          action={
            <Link className="button secondary" href="/app/applicability/adaptive">
              Volver al historial
            </Link>
          }
        />
        <AdaptiveNotice />
        <div className="adaptive-session-summary" role="status">
          <strong>{adaptiveSessionStatusLabel[session.data.status]}</strong>
          <span>{latest?.questions.length ?? 0} preguntas pendientes</span>
          <span>{latest ? 'Información evaluada' : 'Evaluación pendiente'}</span>
        </div>
        {questionGroups.length ? (
          <form
            className="adaptive-question-flow"
            aria-describedby="adaptive-evaluation-status"
            onSubmit={(event) => {
              event.preventDefault();
              saveAndEvaluate.mutate();
            }}
          >
            <h2>Preguntas relevantes</h2>
            <p>Las preguntas cambian según lo que vayamos conociendo de tu organización.</p>
            {questionGroups.map((questions) => (
              <fieldset key={questions[0]!.scope.id}>
                <legend>
                  {questions[0]!.scope.kind === 'ORGANIZATION'
                    ? 'Organización'
                    : questions[0]!.scope.displayNameSnapshot}
                </legend>
                {questions.map((question) => (
                  <article className="adaptive-question-card" key={question.id}>
                    <label htmlFor={`question-${question.id}`}>{question.questionText}</label>
                    <p>{question.helpText}</p>
                    {questionInput(question, answers[question.id] ?? '', (value) =>
                      setAnswers((current) => ({ ...current, [question.id]: value })),
                    )}
                    <details>
                      <summary>¿Por qué te preguntamos esto?</summary>
                      <p>{question.whyAsked}</p>
                    </details>
                  </article>
                ))}
              </fieldset>
            ))}
            <div id="adaptive-evaluation-status" aria-live="polite">
              {saveAndEvaluate.isPending ? 'Guardando respuestas y reevaluando…' : null}
              {formError ? (
                <p className="field-error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>
            {canManage ? (
              <button className="button" type="submit" disabled={saveAndEvaluate.isPending}>
                Guardar y reevaluar
              </button>
            ) : null}
          </form>
        ) : (
          <ApplicabilityStatePanel
            kind="success"
            title="Ya tenemos suficiente información para generar una propuesta"
            description="La propuesta sigue siendo DEMO y no activa módulos, programas ni obligaciones."
          />
        )}
        {proposal.isLoading ? <ApplicabilitySkeleton label="Cargando propuesta" /> : null}
        {proposal.isError ? (
          <ApplicabilityStatePanel
            kind="error"
            title="No pudimos cargar la propuesta"
            description="La sesión permanece intacta."
          />
        ) : null}
        {proposal.data ? (
          <AdaptiveProposalView
            proposal={proposal.data}
            preliminary={questionGroups.length > 0}
            canManage={canManage}
            refresh={() =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.organization.adaptiveProposal(
                  organizationId,
                  proposal.data!.id,
                ),
              })
            }
            request={api.request}
          />
        ) : null}
        {session.data.status === 'READY_TO_PROPOSE' && canManage ? (
          <button
            className="button"
            type="button"
            disabled={finalize.isPending}
            onClick={() => finalize.mutate()}
          >
            {finalize.isPending ? 'Finalizando…' : 'Finalizar propuesta de configuración'}
          </button>
        ) : null}
        {finalize.isError ? (
          <p className="field-error" role="alert">
            {adaptiveMutationMessage(finalize.error)}
          </p>
        ) : null}
      </div>
    </AdaptiveAccess>
  );
}

function AdaptiveProposalView({
  proposal,
  preliminary,
  canManage,
  refresh,
  request,
}: {
  proposal: AdaptiveProposal;
  preliminary: boolean;
  canManage: boolean;
  refresh(): Promise<unknown>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const grouped = new Map<string, AdaptiveProposalItem[]>();
  for (const item of proposal.items)
    grouped.set(item.scope.id, [...(grouped.get(item.scope.id) ?? []), item]);
  return (
    <section className="adaptive-proposal" aria-labelledby="adaptive-proposal-title">
      <div className="adaptive-section-heading">
        <div>
          <p className="applicability-kicker">Configuración sugerida</p>
          <h2 id="adaptive-proposal-title">
            {preliminary ? 'Propuesta preliminar' : 'Propuesta de configuración'}
          </h2>
        </div>
        <span>{proposal.items.length} elementos</span>
      </div>
      <p>
        Esta propuesta no activa una configuración y no calcula puntuaciones de cumplimiento,
        madurez o brecha.
      </p>
      {[...grouped.values()].map((items) => (
        <section
          className="adaptive-proposal-scope"
          key={items[0]!.scope.id}
          aria-labelledby={`scope-${items[0]!.scope.id}`}
        >
          <h3 id={`scope-${items[0]!.scope.id}`}>
            {items[0]!.scope.kind === 'ORGANIZATION'
              ? 'Organización'
              : items[0]!.scope.displayNameSnapshot}
          </h3>
          <div className="adaptive-proposal-grid">
            {items.map((item) => (
              <AdaptiveProposalItemCard
                key={item.id}
                item={item}
                proposalId={proposal.id}
                canManage={canManage}
                request={request}
                refresh={refresh}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function AdaptiveProposalItemCard({
  item,
  proposalId,
  canManage,
  request,
  refresh,
}: {
  item: AdaptiveProposalItem;
  proposalId: string;
  canManage: boolean;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  refresh(): Promise<unknown>;
}) {
  const [currentState, setCurrentState] = useState(item.currentState?.status ?? 'UNKNOWN');
  const [evidenceType, setEvidenceType] = useState<'NOTE' | 'EXTERNAL_LINK'>('NOTE');
  const [evidenceValue, setEvidenceValue] = useState('');
  const currentMutation = useMutation({
    mutationFn: () =>
      request(`/adaptive-configuration/proposals/${proposalId}/current-state`, {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id, status: currentState }),
      }),
    onSuccess: refresh,
  });
  const evidenceMutation = useMutation({
    mutationFn: () =>
      request(`/adaptive-configuration/proposals/${proposalId}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          itemId: item.id,
          type: evidenceType,
          ...(evidenceType === 'NOTE' ? { note: evidenceValue } : { externalUrl: evidenceValue }),
        }),
      }),
    onSuccess: async () => {
      setEvidenceValue('');
      await refresh();
    },
  });
  return (
    <article className="adaptive-proposal-item">
      <span className="status-badge">{adaptiveStateLabel[item.state] ?? item.state}</span>
      <h4>{item.targetVersion.title}</h4>
      <p>{item.targetVersion.description}</p>
      <dl>
        <div>
          <dt>Profundidad mínima DEMO</dt>
          <dd>{adaptiveDepthLabel[item.minimumDepth]}</dd>
        </div>
        <div>
          <dt>Criterio profesional</dt>
          <dd>{item.professionalReview ? 'Necesario' : 'No indicado por estas reglas DEMO'}</dd>
        </div>
      </dl>
      <p>
        <strong>Por qué:</strong> {item.reason}
      </p>
      {item.missingFacts.length ? (
        <p>
          <strong>Información pendiente:</strong> {item.missingFacts.join(', ')}
        </p>
      ) : null}
      <details>
        <summary>Ver traza técnica</summary>
        <p>Reglas versionadas: {item.ruleVersionProvenance.join(', ')}</p>
        <p>
          Requisitos regulatorios vinculados:{' '}
          {item.requirementProvenance.length
            ? item.requirementProvenance.join(', ')
            : 'Ninguno; contenido DEMO no regulatorio.'}
        </p>
        <pre>{JSON.stringify(item.trace, null, 2)}</pre>
      </details>
      <div className="adaptive-current-state">
        <strong>¿La empresa ya cuenta con esto?</strong>
        <p>Información proporcionada por la empresa; aún no ha sido verificada.</p>
        <label htmlFor={`state-${item.id}`}>{item.targetVersion.currentStateQuestion}</label>
        <select
          id={`state-${item.id}`}
          value={currentState}
          onChange={(event) => setCurrentState(event.target.value)}
          disabled={!canManage}
        >
          {adaptiveCurrentStateOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {canManage ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => currentMutation.mutate()}
            disabled={currentMutation.isPending}
          >
            Guardar estado
          </button>
        ) : null}
        {currentMutation.isError ? (
          <p className="field-error" role="alert">
            {adaptiveMutationMessage(currentMutation.error)}
          </p>
        ) : null}
        {item.currentState ? (
          <div className="adaptive-evidence-list">
            <strong>Evidencia declarada y no verificada</strong>
            {item.currentState.evidence.length ? (
              item.currentState.evidence.map((evidence) =>
                evidence.type === 'EXTERNAL_LINK' ? (
                  <a
                    key={evidence.id}
                    href={evidence.externalUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir enlace externo declarado
                  </a>
                ) : (
                  <p key={evidence.id}>{evidence.note}</p>
                ),
              )
            ) : (
              <p>Sin referencias declaradas.</p>
            )}
            {canManage ? (
              <fieldset>
                <legend>Añadir evidencia</legend>
                <p>Puedes registrar una nota o un enlace como evidencia.</p>
                <label htmlFor={`evidence-type-${item.id}`}>Tipo</label>
                <select
                  id={`evidence-type-${item.id}`}
                  value={evidenceType}
                  onChange={(event) =>
                    setEvidenceType(event.target.value as 'NOTE' | 'EXTERNAL_LINK')
                  }
                >
                  <option value="NOTE">Nota</option>
                  <option value="EXTERNAL_LINK">Enlace</option>
                </select>
                <label htmlFor={`evidence-value-${item.id}`}>
                  {evidenceType === 'NOTE' ? 'Nota' : 'Enlace'}
                </label>
                <input
                  id={`evidence-value-${item.id}`}
                  type={evidenceType === 'NOTE' ? 'text' : 'url'}
                  maxLength={1000}
                  value={evidenceValue}
                  onChange={(event) => setEvidenceValue(event.target.value)}
                />
                <button
                  className="button secondary"
                  type="button"
                  disabled={!evidenceValue.trim() || evidenceMutation.isPending}
                  onClick={() => evidenceMutation.mutate()}
                >
                  Añadir evidencia
                </button>
              </fieldset>
            ) : null}
          </div>
        ) : null}
        {evidenceMutation.isError ? (
          <p className="field-error" role="alert">
            {adaptiveMutationMessage(evidenceMutation.error)}
          </p>
        ) : null}
      </div>
    </article>
  );
}
