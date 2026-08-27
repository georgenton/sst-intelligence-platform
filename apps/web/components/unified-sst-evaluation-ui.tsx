'use client';

import { ApiClientError } from '@sst/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import type { ApplicabilityProfileVersion } from '@/lib/applicability-types';
import {
  applicabilityStateLabels,
  humanOrganizationImplementationStatusLabel,
} from '@/lib/human-lexicon';
import { useOrganization } from './app-shell';
import {
  ApplicabilityPageHeader,
  ApplicabilitySkeleton,
  ApplicabilityStatePanel,
} from './applicability-experience-ui';
import { useAuth } from './auth-provider';

type UnifiedEvaluationListItem = {
  id: string;
  status: string;
  createdAt: string;
  evaluatedAt: string | null;
  profileVersionId: string;
  _count: { items: number };
};

type UnifiedEvaluationDetail = UnifiedEvaluationListItem & {
  contextSnapshot: {
    inputHash: string;
    outputHash: string;
    facts: Array<{ factKey: string; value: unknown }>;
    questions: unknown[];
    boundary: string;
  };
  items: Array<{
    id: string;
    proposedState: string;
    whyMatched: string;
    organizationFacts: Array<{ factKey: string; value: unknown }>;
    predicateTrace: unknown;
    currentStateSnapshot: { status?: string } | null;
    organizationEvidence: Array<{ type: string; note?: string | null }>;
    riskReferences: Array<{ assessmentId: string; title: string; status: string }>;
    professionalReviewRequired: boolean;
    requirement: { id: string; requirementKey: string; title: string; description: string };
    ruleDraft: { id: string; revision: number; ruleDefinition: { ruleKey: string } };
    unit: {
      id: string;
      identifier: string;
      locator: string;
      sourceVersion: {
        vigenciaReviewStatus: string;
        artifactVerificationStatus: string;
        officialUrl: string | null;
        source: { sourceKey: string; canonicalTitle: string; referenceNumber: string };
      };
    };
  }>;
};

function useUnifiedApi() {
  const auth = useAuth();
  const organization = useOrganization();
  const active = organization.organizations.find(({ id }) => id === organization.activeId);
  return {
    organizationId: organization.activeId,
    role: active?.memberships[0]?.role,
    loading: organization.loading,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

const REVIEW_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

function CandidateReviewForm({
  api,
  item,
}: {
  api: ReturnType<typeof useUnifiedApi>;
  item: UnifiedEvaluationDetail['items'][number];
}) {
  const [decision, setDecision] = useState('APPROVED');
  const [comment, setComment] = useState('');
  const review = useMutation({
    mutationFn: () =>
      api.request(`/unified-sst-evaluations/expert-workspace/${item.ruleDraft.id}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          evaluationItemId: item.id,
          decision,
          comment: comment || undefined,
        }),
      }),
  });
  if (!api.role || !REVIEW_ROLES.has(api.role))
    return <p>La revisión profesional V1 corresponde a Owner, Admin o Responsable SST.</p>;
  return (
    <div className="technical-form-panel">
      <h3>Revisión profesional de la interpretación</h3>
      <label>
        Decisión
        <select value={decision} onChange={(event) => setDecision(event.target.value)}>
          <option value="APPROVED">Aprobar interpretación</option>
          <option value="CHANGES_REQUESTED">Solicitar cambios</option>
          <option value="LEGAL_REVIEW_REQUIRED">Requiere revisión legal</option>
          <option value="REJECTED">Rechazar interpretación</option>
        </select>
      </label>
      <label>
        Comentario
        <textarea
          value={comment}
          maxLength={2000}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      <button
        className="button"
        type="button"
        disabled={review.isPending}
        onClick={() => review.mutate()}
      >
        {review.isPending ? 'Registrando…' : 'Registrar revisión'}
      </button>
      {review.isSuccess ? (
        <p role="status">Revisión registrada. La regla no fue publicada.</p>
      ) : null}
      {review.isError ? <p role="alert">No fue posible registrar la revisión.</p> : null}
    </div>
  );
}

function CandidateOrganizationContextForm({
  api,
  evaluationId,
  item,
  onSaved,
}: {
  api: ReturnType<typeof useUnifiedApi>;
  evaluationId: string;
  item: UnifiedEvaluationDetail['items'][number];
  onSaved(): void;
}) {
  const [status, setStatus] = useState(item.currentStateSnapshot?.status ?? 'UNKNOWN');
  const [evidenceNote, setEvidenceNote] = useState('');
  const currentState = useMutation({
    mutationFn: () =>
      api.request(`/unified-sst-evaluations/${evaluationId}/items/${item.id}/current-state`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: onSaved,
  });
  const evidence = useMutation({
    mutationFn: () =>
      api.request(
        `/unified-sst-evaluations/${evaluationId}/items/${item.id}/organization-evidence`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'NOTE', note: evidenceNote }),
        },
      ),
    onSuccess: () => {
      setEvidenceNote('');
      onSaved();
    },
  });
  return (
    <section className="technical-form-panel" aria-label="Estado y evidencia de la organización">
      <h3>Estado y evidencia de la organización</h3>
      <p>Estos datos pertenecen a la empresa y se mantienen separados del texto oficial.</p>
      <label>
        Estado declarado
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="UNKNOWN">Sin información</option>
          <option value="NOT_IMPLEMENTED">No implementado</option>
          <option value="PLANNED">Planificado</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="PARTIALLY_IMPLEMENTED">Parcialmente implementado</option>
          <option value="IMPLEMENTED">Implementado</option>
        </select>
      </label>
      <button
        className="button secondary"
        type="button"
        disabled={currentState.isPending}
        onClick={() => currentState.mutate()}
      >
        Guardar estado declarado
      </button>
      <label>
        Nota de evidencia organizacional
        <textarea
          value={evidenceNote}
          maxLength={1000}
          onChange={(event) => setEvidenceNote(event.target.value)}
        />
      </label>
      <button
        className="button secondary"
        type="button"
        disabled={!evidenceNote.trim() || evidence.isPending}
        onClick={() => evidence.mutate()}
      >
        Añadir evidencia organizacional
      </button>
      {currentState.isSuccess || evidence.isSuccess ? (
        <p role="status">Contexto de la organización actualizado.</p>
      ) : null}
      {currentState.isError || evidence.isError ? (
        <p role="alert">No fue posible actualizar el contexto.</p>
      ) : null}
    </section>
  );
}

function queryRetry(failureCount: number, error: Error) {
  return !(error instanceof ApiClientError && error.status < 500) && failureCount < 1;
}

function EvaluationAccess({ children }: { children: React.ReactNode }) {
  const organization = useOrganization();
  if (organization.loading) return <ApplicabilitySkeleton label="Preparando Evaluación SST" />;
  if (!organization.activeId)
    return (
      <ApplicabilityStatePanel
        kind="info"
        title="Selecciona una organización"
        description="La evaluación usa exclusivamente el perfil y la evidencia de la organización activa."
      />
    );
  return children;
}

export function UnifiedSstEvaluationWorkspace() {
  const api = useUnifiedApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId ?? 'inactive';
  const [profileVersionId, setProfileVersionId] = useState('');
  const profiles = useQuery({
    queryKey: queryKeys.organization.applicabilityProfileVersions(organizationId),
    queryFn: ({ signal }) =>
      api.request<ApplicabilityProfileVersion[]>('/applicability/profile-versions', { signal }),
    enabled: Boolean(api.organizationId),
    retry: queryRetry,
  });
  const evaluations = useQuery({
    queryKey: queryKeys.organization.unifiedSstEvaluations(organizationId),
    queryFn: ({ signal }) =>
      api.request<UnifiedEvaluationListItem[]>('/unified-sst-evaluations', { signal }),
    enabled: Boolean(api.organizationId),
    retry: queryRetry,
  });
  const create = useMutation({
    mutationFn: () =>
      api.request<UnifiedEvaluationDetail>('/unified-sst-evaluations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileVersionId }),
      }),
    onSuccess: async (evaluation) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.unifiedSstEvaluations(organizationId),
      });
      router.push(`/app/evaluation/${evaluation.id}`);
    },
  });
  const error = profiles.error ?? evaluations.error;
  return (
    <EvaluationAccess>
      <div className="regulatory-source-page stack">
        <ApplicabilityPageHeader
          eyebrow="Orquestación SST"
          title="Evaluación SST"
          description="Un recorrido único que coordina perfil, aplicabilidad regulatoria, estado declarado, evidencia y valoración de riesgos."
          action={
            <div className="regulatory-header-actions">
              <Link className="button secondary" href="/app/evaluation/expert-review">
                Revisión experta
              </Link>
              <Link className="button secondary" href="/app/applicability/sources">
                Biblioteca normativa
              </Link>
            </div>
          }
        />
        <aside className="regulatory-boundary-notice" role="note">
          <strong>Interpretación propuesta</strong>
          <p>
            Los resultados candidatos requieren revisión profesional y no son una declaración de
            cumplimiento o incumplimiento legal.
          </p>
        </aside>
        {profiles.isLoading || evaluations.isLoading ? (
          <ApplicabilitySkeleton label="Cargando contexto de evaluación" />
        ) : error ? (
          <ApplicabilityStatePanel
            kind="error"
            title="No pudimos cargar la evaluación"
            description="La API no devolvió el contexto solicitado. No se muestran datos conservados de otra organización."
          />
        ) : (
          <>
            <section
              className="technical-form-panel"
              aria-labelledby="new-unified-evaluation-title"
            >
              <p className="applicability-kicker">Nueva ejecución histórica</p>
              <h2 id="new-unified-evaluation-title">Evaluar un perfil SST</h2>
              {profiles.data?.length ? (
                <div className="technical-field">
                  <label htmlFor="unified-profile">Versión del perfil</label>
                  <select
                    id="unified-profile"
                    value={profileVersionId}
                    onChange={(event) => setProfileVersionId(event.target.value)}
                  >
                    <option value="">Selecciona una versión</option>
                    {profiles.data.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        Versión {profile.version}
                      </option>
                    ))}
                  </select>
                  <button
                    className="button"
                    type="button"
                    disabled={!profileVersionId || create.isPending}
                    onClick={() => create.mutate()}
                  >
                    {create.isPending ? 'Evaluando…' : 'Ejecutar Evaluación SST'}
                  </button>
                  {create.isError ? (
                    <p role="alert">No fue posible ejecutar esta evaluación.</p>
                  ) : null}
                </div>
              ) : (
                <ApplicabilityStatePanel
                  kind="empty"
                  title="Primero crea un perfil SST"
                  description="La orquestación necesita una versión explícita y no usa datos implícitos."
                  action={
                    <Link className="button" href="/app/applicability/new">
                      Crear perfil SST
                    </Link>
                  }
                />
              )}
            </section>
            <section aria-labelledby="unified-history-title">
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Historial tenant-private</p>
                  <h2 id="unified-history-title">Evaluaciones anteriores</h2>
                </div>
                <span>{evaluations.data?.length ?? 0}</span>
              </div>
              {evaluations.data?.length ? (
                <div className="regulatory-content-list">
                  {evaluations.data.map((evaluation) => (
                    <article className="regulatory-content-card" key={evaluation.id}>
                      <span className="regulatory-status">
                        {evaluation.status === 'REVIEW_PENDING' ? 'Revisión pendiente' : 'Evaluada'}
                      </span>
                      <h3>{evaluation._count.items} interpretaciones propuestas</h3>
                      <p>Perfil fijado: {evaluation.profileVersionId}</p>
                      <Link href={`/app/evaluation/${evaluation.id}`}>Abrir resultado</Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No existen evaluaciones unificadas todavía.</p>
              )}
            </section>
          </>
        )}
      </div>
    </EvaluationAccess>
  );
}

export function UnifiedSstEvaluationDetailView({ evaluationId }: { evaluationId: string }) {
  const api = useUnifiedApi();
  const organizationId = api.organizationId ?? 'inactive';
  const evaluation = useQuery({
    queryKey: queryKeys.organization.unifiedSstEvaluation(organizationId, evaluationId),
    queryFn: ({ signal }) =>
      api.request<UnifiedEvaluationDetail>(`/unified-sst-evaluations/${evaluationId}`, { signal }),
    enabled: Boolean(api.organizationId),
    retry: queryRetry,
  });
  return (
    <EvaluationAccess>
      {evaluation.isLoading ? (
        <ApplicabilitySkeleton label="Cargando resultado SST" />
      ) : evaluation.isError ? (
        <ApplicabilityStatePanel
          kind="error"
          title="No pudimos cargar el resultado"
          description="Comprueba tu organización activa y vuelve a intentarlo."
        />
      ) : evaluation.data ? (
        <div className="regulatory-source-page stack">
          <ApplicabilityPageHeader
            eyebrow="Evaluación SST · interpretación propuesta"
            title="Prioridades y fundamento"
            description="Cada resultado conserva la versión del perfil, el rastro determinístico y el artículo oficial exacto."
            action={
              <Link className="button secondary" href="/app/evaluation">
                Volver a Evaluación SST
              </Link>
            }
          />
          <aside className="regulatory-boundary-notice" role="note">
            <strong>Revisión profesional pendiente</strong>
            <p>Este resultado candidato no afirma cumplimiento ni incumplimiento legal.</p>
          </aside>
          {evaluation.data.items.map((item) => (
            <article className="regulatory-source-identity" key={item.id}>
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Interpretación propuesta</p>
                  <h2>{item.requirement.title}</h2>
                </div>
                <span className="regulatory-status">
                  {applicabilityStateLabels[item.proposedState] ?? 'Estado propuesto'}
                </span>
              </div>
              <dl>
                <div>
                  <dt>¿Qué identificamos?</dt>
                  <dd>{item.requirement.description}</dd>
                </div>
                <div>
                  <dt>¿Por qué?</dt>
                  <dd>{item.whyMatched}</dd>
                </div>
                <div>
                  <dt>Norma relacionada</dt>
                  <dd>
                    {item.unit.sourceVersion.source.referenceNumber} · {item.unit.identifier}
                  </dd>
                </div>
                <div>
                  <dt>Estado declarado</dt>
                  <dd>
                    {humanOrganizationImplementationStatusLabel(item.currentStateSnapshot?.status)}
                  </dd>
                </div>
                <div>
                  <dt>Evidencia de la organización</dt>
                  <dd>
                    {item.organizationEvidence.length
                      ? `${item.organizationEvidence.length} referencia(s) registrada(s)`
                      : 'Sin evidencia registrada'}
                  </dd>
                </div>
                <div>
                  <dt>Revisión profesional</dt>
                  <dd>{item.professionalReviewRequired ? 'Requerida' : 'No requerida'}</dd>
                </div>
                <div>
                  <dt>Acción siguiente</dt>
                  <dd>
                    Revisar el fundamento, completar estado y vincular evidencia o riesgo cuando
                    corresponda.
                  </dd>
                </div>
              </dl>
              <div className="regulatory-header-actions">
                <Link
                  className="button"
                  href={`/app/applicability/sources/${encodeURIComponent(item.unit.sourceVersion.source.sourceKey)}/units/${item.unit.id}`}
                >
                  Ver fundamento normativo
                </Link>
                <Link className="button secondary" href="/app/technical-risk/new">
                  Vincular una nueva valoración de riesgo
                </Link>
              </div>
              <CandidateOrganizationContextForm
                api={api}
                evaluationId={evaluationId}
                item={item}
                onSaved={() => void evaluation.refetch()}
              />
              <CandidateReviewForm api={api} item={item} />
            </article>
          ))}
        </div>
      ) : null}
    </EvaluationAccess>
  );
}

type ExpertDraft = {
  id: string;
  revision: number;
  status: string;
  ruleKey: string;
  candidateLabel: string;
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    exactArticles: Array<{
      id: string;
      identifier: string;
      locator: string;
      officialText: string;
      sourceKey: string;
      sourceTitle: string;
    }>;
  }>;
  publicationBoundary: string;
};

export function UnifiedExpertReviewWorkspace() {
  const api = useUnifiedApi();
  const drafts = useQuery({
    queryKey: ['organization', api.organizationId ?? 'inactive', 'unified-sst', 'expert-workspace'],
    queryFn: ({ signal }) =>
      api.request<ExpertDraft[]>('/unified-sst-evaluations/expert-workspace', { signal }),
    enabled: Boolean(api.organizationId),
    retry: queryRetry,
  });
  return (
    <EvaluationAccess>
      <div className="regulatory-source-page stack">
        <ApplicabilityPageHeader
          eyebrow="Revisión regulatoria controlada"
          title="Interpretaciones propuestas"
          description="Contrasta cada propuesta con el artículo oficial exacto. Revisar no publica una regla."
          action={
            <Link className="button secondary" href="/app/evaluation">
              Volver a Evaluación SST
            </Link>
          }
        />
        <aside className="regulatory-boundary-notice" role="note">
          <strong>Revisión profesional pendiente</strong>
          <p>Las propuestas no se presentan como aplicabilidad legal final.</p>
        </aside>
        {drafts.isLoading ? (
          <ApplicabilitySkeleton label="Cargando propuestas" />
        ) : drafts.isError ? (
          <ApplicabilityStatePanel
            kind="error"
            title="No pudimos cargar las propuestas"
            description="La API no devolvió el workspace de revisión."
          />
        ) : (
          drafts.data?.map((draft) => (
            <article className="regulatory-source-identity" key={draft.id}>
              <p className="applicability-kicker">{draft.candidateLabel}</p>
              <h2>{draft.requirements[0]?.title ?? draft.ruleKey}</h2>
              <p>{draft.requirements[0]?.description}</p>
              {draft.requirements
                .flatMap(({ exactArticles }) => exactArticles)
                .map((article) => (
                  <div className="regulatory-content-card" key={article.id}>
                    <strong>
                      {article.sourceTitle} · {article.identifier}
                    </strong>
                    <p>{article.locator}</p>
                    <p>{article.officialText}</p>
                    <Link
                      href={`/app/applicability/sources/${article.sourceKey}/units/${article.id}`}
                    >
                      Abrir artículo oficial
                    </Link>
                  </div>
                ))}
              <small>Regla candidata v{draft.revision} · revisar no publica</small>
            </article>
          ))
        )}
      </div>
    </EvaluationAccess>
  );
}
