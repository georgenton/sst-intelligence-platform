'use client';

import { ApiClientError } from '@sst/api-client';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  buildSstProfilePayload,
  assessmentSnapshotPresentation,
  canManageApplicability,
  DEMO_APPLICABILITY_DISCLAIMER,
  formatApplicabilityDate,
  profileMutationError,
  summarizeDecisionStates,
  type SstProfileFormValues,
} from '@/lib/applicability-experience';
import type {
  ApplicabilityAssessmentDetailRecord,
  ApplicabilityAssessmentSummary,
  ApplicabilityProfileVersion,
  ApplicabilityRulePackOption,
} from '@/lib/applicability-types';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import {
  ApplicabilityDecisionCard,
  ApplicabilityDecisionSummary,
  ApplicabilityPageHeader,
  ApplicabilitySkeleton,
  ApplicabilityStatePanel,
  DemoApplicabilityNotice,
  ProfileSnapshotSummary,
  RulePackCard,
} from './applicability-experience-ui';
import { useAuth } from './auth-provider';

const PROFILE_FORM_DEFAULTS: SstProfileFormValues = {
  workerCount: '',
  hasChemicalProcesses: 'UNKNOWN',
  hasHighEnergyOperations: 'UNKNOWN',
};

function shouldRetryGet(failureCount: number, error: Error): boolean {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 1;
}

function useApplicabilityApi() {
  const auth = useAuth();
  const organization = useOrganization();
  const activeOrganization = organization.organizations.find(
    (candidate) => candidate.id === organization.activeId,
  );
  return {
    organizationId: organization.activeId,
    organizationName: activeOrganization?.name,
    role: activeOrganization?.memberships[0]?.role,
    accessLoading: organization.loading,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function ApplicabilityAccessGate({
  api,
  children,
}: {
  api: ReturnType<typeof useApplicabilityApi>;
  children: React.ReactNode;
}) {
  if (api.accessLoading)
    return <ApplicabilitySkeleton label="Comprobando contexto de organización" />;
  if (!api.organizationId) {
    return (
      <ApplicabilityStatePanel
        kind="info"
        title="Selecciona una organización"
        description="El contexto de organización es necesario antes de consultar perfiles y evaluaciones."
      />
    );
  }
  return children;
}

function QueryError({ retry, object }: { retry(): void; object: string }) {
  return (
    <ApplicabilityStatePanel
      kind="error"
      title={`No pudimos cargar ${object}`}
      description="Revisa tu conexión. No se modificó ningún registro."
      action={
        <button className="button secondary" type="button" onClick={retry}>
          Reintentar
        </button>
      }
    />
  );
}

export function ApplicabilityWorkspace() {
  const api = useApplicabilityApi();
  const organizationId = api.organizationId ?? 'no-organization';
  const enabled = Boolean(api.organizationId);
  const profiles = useQuery({
    queryKey: queryKeys.organization.applicabilityProfileVersions(organizationId),
    queryFn: ({ signal }) =>
      api.request<ApplicabilityProfileVersion[]>('/applicability/profile-versions', { signal }),
    enabled,
    retry: shouldRetryGet,
  });
  const packs = useQuery({
    queryKey: queryKeys.organization.applicabilityRulePacks(organizationId),
    queryFn: ({ signal }) =>
      api.request<ApplicabilityRulePackOption[]>('/applicability/rule-packs', { signal }),
    enabled,
    retry: shouldRetryGet,
  });
  const assessments = useQuery({
    queryKey: queryKeys.organization.applicabilityAssessments(organizationId),
    queryFn: ({ signal }) =>
      api.request<ApplicabilityAssessmentSummary[]>('/applicability/assessments', { signal }),
    enabled,
    retry: shouldRetryGet,
  });
  const assessmentDetails = useQueries({
    queries: (assessments.data ?? []).map((assessment) => ({
      queryKey: queryKeys.organization.applicabilityAssessment(organizationId, assessment.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.request<ApplicabilityAssessmentDetailRecord>(
          `/applicability/assessments/${assessment.id}`,
          { signal },
        ),
      enabled,
      retry: shouldRetryGet,
    })),
  });
  const canManage = canManageApplicability(api.role);
  const profileHistory = profiles.data ?? [];
  const latestProfile = profileHistory[0];

  return (
    <ApplicabilityAccessGate api={api}>
      <div className="applicability-workspace stack">
        <ApplicabilityPageHeader
          eyebrow="Configuración explicable"
          title="Aplicabilidad y configuración SST"
          description="Consulta perfiles versionados y evaluaciones determinísticas. Los resultados son históricos y no activan una configuración operativa."
          action={
            canManage ? (
              <Link className="button" href="/app/applicability/new">
                Nueva evaluación de aplicabilidad
              </Link>
            ) : undefined
          }
        />
        <DemoApplicabilityNotice disclaimer={DEMO_APPLICABILITY_DISCLAIMER} />
        {!canManage ? (
          <ApplicabilityStatePanel
            kind="info"
            title="Experiencia de solo lectura"
            description="Tu rol puede consultar perfiles, resultados y traces históricos. La API reserva la creación y evaluación para OWNER, ADMIN y SST_MANAGER."
          />
        ) : null}

        {profiles.isLoading ? (
          <ApplicabilitySkeleton label="Cargando versiones del perfil SST" />
        ) : profiles.isError ? (
          <QueryError object="las versiones del perfil SST" retry={() => void profiles.refetch()} />
        ) : latestProfile ? (
          <>
            <ProfileSnapshotSummary
              snapshot={latestProfile.snapshot}
              version={latestProfile.version}
              createdAt={latestProfile.createdAt}
              createdBy={latestProfile.createdBy?.displayName}
              heading="Última versión del perfil SST"
            />
            <section
              className="applicability-workspace-section"
              aria-labelledby="previous-profiles-title"
            >
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Historial append-only</p>
                  <h2 id="previous-profiles-title">Versiones anteriores</h2>
                </div>
                <span>{Math.max(profileHistory.length - 1, 0)} anteriores</span>
              </div>
              {profileHistory.length === 1 ? (
                <p className="applicability-muted">Todavía no existen versiones anteriores.</p>
              ) : (
                <div className="applicability-profile-history">
                  {profileHistory.slice(1).map((profile) => (
                    <article key={profile.id}>
                      <div>
                        <strong>Versión {profile.version}</strong>
                        <span>{formatApplicabilityDate(profile.createdAt)}</span>
                      </div>
                      <dl>
                        <div>
                          <dt>Personas</dt>
                          <dd>{profile.snapshot.organization.workerCount ?? 'Sin información'}</dd>
                        </div>
                        <div>
                          <dt>Procesos químicos</dt>
                          <dd>
                            {profile.snapshot.operations.hasChemicalProcesses === undefined
                              ? 'Sin información'
                              : profile.snapshot.operations.hasChemicalProcesses
                                ? 'Sí'
                                : 'No'}
                          </dd>
                        </div>
                        <div>
                          <dt>Alta energía</dt>
                          <dd>
                            {profile.snapshot.operations.hasHighEnergyOperations === undefined
                              ? 'Sin información'
                              : profile.snapshot.operations.hasHighEnergyOperations
                                ? 'Sí'
                                : 'No'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <ApplicabilityStatePanel
            kind="empty"
            title="Todavía no existe un perfil SST versionado"
            description="Crea una primera versión para capturar datos derivados por el servidor y hechos administrativos explícitos."
            action={
              canManage ? (
                <Link className="button" href="/app/applicability/new">
                  Crear primera versión
                </Link>
              ) : undefined
            }
          />
        )}

        <section className="applicability-workspace-section" aria-labelledby="active-packs-title">
          <div className="applicability-section-heading">
            <div>
              <p className="applicability-kicker">Catálogo del servidor</p>
              <h2 id="active-packs-title">Motores de reglas activos</h2>
            </div>
            {packs.data ? <span>{packs.data.length} activos</span> : null}
          </div>
          {packs.isLoading ? (
            <ApplicabilitySkeleton label="Cargando motores de reglas" />
          ) : packs.isError ? (
            <QueryError object="los motores de reglas" retry={() => void packs.refetch()} />
          ) : packs.data?.length ? (
            <div className="applicability-rule-pack-grid">
              {packs.data.map((pack) => (
                <RulePackCard key={pack.id} pack={pack} />
              ))}
            </div>
          ) : (
            <ApplicabilityStatePanel
              kind="empty"
              title="No hay motores de reglas activos disponibles"
              description="Sin un motor activo no puede ejecutarse una evaluación. Esto no implica ausencia de requisitos ni aplicabilidad."
            />
          )}
        </section>

        <section
          className="applicability-workspace-section"
          aria-labelledby="assessment-history-title"
        >
          <div className="applicability-section-heading">
            <div>
              <p className="applicability-kicker">Resultados inmutables</p>
              <h2 id="assessment-history-title">Historial de evaluaciones</h2>
            </div>
            {assessments.data ? <span>{assessments.data.length} evaluaciones</span> : null}
          </div>
          {assessments.isLoading ? (
            <ApplicabilitySkeleton label="Cargando evaluaciones históricas" />
          ) : assessments.isError ? (
            <QueryError
              object="el historial de evaluaciones"
              retry={() => void assessments.refetch()}
            />
          ) : assessments.data?.length ? (
            <div className="applicability-assessment-history">
              {assessments.data.map((assessment, index) => {
                const detail = assessmentDetails[index];
                const counts = detail?.data
                  ? summarizeDecisionStates(detail.data.decisions)
                  : undefined;
                return (
                  <Link href={`/app/applicability/${assessment.id}`} key={assessment.id}>
                    <div className="applicability-assessment-history__identity">
                      <strong>
                        Evaluación del {formatApplicabilityDate(assessment.completedAt)}
                      </strong>
                      <span>
                        Perfil v{assessment.profileVersion.version} ·{' '}
                        {assessment.rulePackVersion.key} v{assessment.rulePackVersion.version}
                      </span>
                    </div>
                    <div className="applicability-assessment-history__states">
                      {detail?.isLoading ? <span>Cargando decisiones…</span> : null}
                      {detail?.isError ? <span>No se pudo cargar el desglose</span> : null}
                      {counts
                        ? Object.entries(counts).map(([state, count]) => (
                            <span key={state}>
                              {count} {state}
                            </span>
                          ))
                        : null}
                    </div>
                    <span
                      className="applicability-source-badge"
                      data-demo={assessment.rulePackVersion.isDemo}
                    >
                      {assessment.rulePackVersion.isDemo ? 'DEMO' : 'FUENTE'}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <ApplicabilityStatePanel
              kind="empty"
              title="Aún no se han ejecutado evaluaciones de aplicabilidad"
              description="Un perfil por sí solo no produce resultados. La evaluación requiere una acción explícita posterior."
              action={
                canManage ? (
                  <Link className="button" href="/app/applicability/new">
                    Nueva evaluación
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>
      </div>
    </ApplicabilityAccessGate>
  );
}

function JourneyProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ['Perfil SST', 'Confirmar versión', 'Motor de reglas', 'Evaluar'];
  return (
    <nav className="applicability-journey-progress" aria-label="Progreso de la evaluación">
      <ol>
        {labels.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3 | 4;
          return (
            <li
              key={label}
              aria-current={number === step ? 'step' : undefined}
              data-complete={number < step}
            >
              <span>{number}</span>
              {label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ApplicabilityNewJourney() {
  const api = useApplicabilityApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId ?? 'no-organization';
  const canManage = canManageApplicability(api.role);
  const [createdProfile, setCreatedProfile] = useState<ApplicabilityProfileVersion>();
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [selectedRulePackId, setSelectedRulePackId] = useState('');
  const [rulePackConfirmed, setRulePackConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SstProfileFormValues>({ defaultValues: PROFILE_FORM_DEFAULTS });
  const packs = useQuery({
    queryKey: queryKeys.organization.applicabilityRulePacks(organizationId),
    queryFn: ({ signal }) =>
      api.request<ApplicabilityRulePackOption[]>('/applicability/rule-packs', { signal }),
    enabled: Boolean(api.organizationId),
    retry: shouldRetryGet,
  });

  useEffect(() => {
    reset(PROFILE_FORM_DEFAULTS);
    setCreatedProfile(undefined);
    setProfileConfirmed(false);
    setSelectedRulePackId('');
    setRulePackConfirmed(false);
    setStatusMessage('');
  }, [api.organizationId, reset]);

  const createProfile = useMutation({
    mutationFn: (values: SstProfileFormValues) =>
      api.request<ApplicabilityProfileVersion>('/applicability/profile-versions', {
        method: 'POST',
        body: JSON.stringify(buildSstProfilePayload(values)),
      }),
    onSuccess: async (profile) => {
      setCreatedProfile(profile);
      setStatusMessage(
        `Versión ${profile.version} creada. Todavía no se ha ejecutado una evaluación.`,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.applicabilityProfileVersions(organizationId),
      });
    },
  });
  const evaluate = useMutation({
    mutationFn: ({
      profileVersionId,
      rulePackVersionId,
    }: {
      profileVersionId: string;
      rulePackVersionId: string;
    }) =>
      api.request<ApplicabilityAssessmentDetailRecord>('/applicability/assessments', {
        method: 'POST',
        body: JSON.stringify({ profileVersionId, rulePackVersionId }),
      }),
    onSuccess: async (assessment) => {
      queryClient.setQueryData(
        queryKeys.organization.applicabilityAssessment(organizationId, assessment.id),
        assessment,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.applicabilityAssessments(organizationId),
      });
      router.push(`/app/applicability/${assessment.id}`);
    },
  });

  const selectedPack = packs.data?.find((pack) => pack.id === selectedRulePackId);
  const step: 1 | 2 | 3 | 4 = !createdProfile
    ? 1
    : !profileConfirmed
      ? 2
      : !rulePackConfirmed
        ? 3
        : 4;

  return (
    <ApplicabilityAccessGate api={api}>
      <div className="applicability-new-journey stack">
        <ApplicabilityPageHeader
          eyebrow="Nueva evaluación"
          title="Crear una versión y evaluar"
          description="La versión del perfil y la evaluación son operaciones separadas. Ninguna decisión se calcula en el navegador."
          action={
            <Link className="button secondary" href="/app/applicability">
              Volver al historial
            </Link>
          }
        />
        <DemoApplicabilityNotice disclaimer={DEMO_APPLICABILITY_DISCLAIMER} />
        {!canManage ? (
          <ApplicabilityStatePanel
            kind="info"
            title="Tu rol tiene acceso de solo lectura"
            description="OWNER, ADMIN y SST_MANAGER pueden crear versiones y ejecutar evaluaciones. Consulta el historial sin modificarlo."
            action={
              <Link className="button secondary" href="/app/applicability">
                Abrir historial
              </Link>
            }
          />
        ) : (
          <>
            <JourneyProgress step={step} />
            <p className="applicability-sr-only" role="status" aria-live="polite">
              {statusMessage}
            </p>
            {step === 1 ? (
              <section className="applicability-form-panel" aria-labelledby="profile-form-title">
                <div className="applicability-section-heading">
                  <div>
                    <p className="applicability-kicker">Paso 1 de 4</p>
                    <h2 id="profile-form-title">Perfil SST</h2>
                  </div>
                </div>
                <p className="applicability-derived-copy">
                  País, sector y centros de trabajo serán capturados automáticamente por el servidor
                  al crear esta versión.
                </p>
                <form
                  className="applicability-profile-form"
                  onSubmit={handleSubmit((values) => createProfile.mutate(values))}
                  noValidate
                >
                  <div className="applicability-field">
                    <label htmlFor="applicability-worker-count">
                      Personas trabajadoras · opcional
                    </label>
                    <input
                      id="applicability-worker-count"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="10000000"
                      aria-describedby={
                        errors.workerCount
                          ? 'applicability-worker-count-error'
                          : 'applicability-worker-count-help'
                      }
                      {...register('workerCount', {
                        validate: (value) =>
                          value.trim() === '' ||
                          (/^\d+$/.test(value) &&
                            Number(value) >= 1 &&
                            Number(value) <= 10_000_000) ||
                          'Ingresa un entero entre 1 y 10.000.000, o deja el campo vacío.',
                      })}
                    />
                    <small id="applicability-worker-count-help">
                      Vacío significa “Sin información”; nunca se envía como cero.
                    </small>
                    {errors.workerCount ? (
                      <span id="applicability-worker-count-error" role="alert">
                        {errors.workerCount.message}
                      </span>
                    ) : null}
                  </div>
                  <TriStateFieldset
                    legend="¿Existen procesos químicos?"
                    name="hasChemicalProcesses"
                    register={register}
                  />
                  <TriStateFieldset
                    legend="¿Existen operaciones de alta energía?"
                    name="hasHighEnergyOperations"
                    register={register}
                  />
                  {createProfile.isError ? (
                    <p className="applicability-mutation-error" role="alert">
                      {profileMutationError(createProfile.error)}
                    </p>
                  ) : null}
                  <div className="applicability-form-actions">
                    <button className="button" type="submit" disabled={createProfile.isPending}>
                      {createProfile.isPending ? 'Creando versión…' : 'Crear versión del perfil'}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
            {step === 2 && createdProfile ? (
              <div className="stack">
                <ApplicabilityStatePanel
                  kind="success"
                  title="Versión creada"
                  description={`La versión ${createdProfile.version} fue persistida. Todavía no existe una evaluación para este flujo.`}
                />
                <ProfileSnapshotSummary
                  snapshot={createdProfile.snapshot}
                  version={createdProfile.version}
                  createdAt={createdProfile.createdAt}
                  heading="Confirma la versión persistida"
                />
                <div className="applicability-form-actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() => setProfileConfirmed(true)}
                  >
                    Confirmar versión
                  </button>
                </div>
              </div>
            ) : null}
            {step === 3 && createdProfile ? (
              <section
                className="applicability-form-panel"
                aria-labelledby="rule-pack-selection-title"
              >
                <div className="applicability-section-heading">
                  <div>
                    <p className="applicability-kicker">Paso 3 de 4</p>
                    <h2 id="rule-pack-selection-title">Motor de reglas</h2>
                  </div>
                </div>
                {packs.isLoading ? (
                  <ApplicabilitySkeleton label="Cargando motores de reglas" />
                ) : null}
                {packs.isError ? (
                  <QueryError object="los motores de reglas" retry={() => void packs.refetch()} />
                ) : null}
                {packs.data?.length === 0 ? (
                  <ApplicabilityStatePanel
                    kind="empty"
                    title="No hay motores de reglas activos disponibles"
                    description="La versión del perfil permanece guardada y puede usarse cuando exista un motor activo."
                  />
                ) : null}
                {packs.data?.length ? (
                  <fieldset className="applicability-rule-pack-fieldset">
                    <legend>Selecciona explícitamente una versión activa</legend>
                    <div className="applicability-rule-pack-grid">
                      {packs.data.map((pack) => (
                        <RulePackCard
                          key={pack.id}
                          pack={pack}
                          selectable
                          selected={selectedRulePackId === pack.id}
                          onSelect={() => setSelectedRulePackId(pack.id)}
                        />
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                <div className="applicability-form-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setProfileConfirmed(false)}
                  >
                    Revisar versión
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={!selectedPack}
                    onClick={() => setRulePackConfirmed(true)}
                  >
                    Confirmar motor
                  </button>
                </div>
              </section>
            ) : null}
            {step === 4 && createdProfile && selectedPack ? (
              <section
                className="applicability-evaluation-confirmation"
                aria-labelledby="evaluation-confirmation-title"
              >
                <div className="applicability-section-heading">
                  <div>
                    <p className="applicability-kicker">Paso 4 de 4</p>
                    <h2 id="evaluation-confirmation-title">Evaluar</h2>
                  </div>
                </div>
                <dl className="applicability-confirmation-grid">
                  <div>
                    <dt>Perfil</dt>
                    <dd>Versión {createdProfile.version}</dd>
                  </div>
                  <div>
                    <dt>Motor</dt>
                    <dd>{selectedPack.name}</dd>
                  </div>
                  <div>
                    <dt>Versión del motor</dt>
                    <dd>
                      <code>{selectedPack.version}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Fuente</dt>
                    <dd>{selectedPack.sourceType}</dd>
                  </div>
                </dl>
                <DemoApplicabilityNotice disclaimer={selectedPack.disclaimer} />
                <p>
                  Esta acción creará un resultado histórico nuevo. No activa módulos, programas ni
                  una configuración operativa.
                </p>
                {evaluate.isError ? (
                  <p className="applicability-mutation-error" role="alert">
                    {profileMutationError(evaluate.error)}
                  </p>
                ) : null}
                <div className="applicability-form-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setRulePackConfirmed(false)}
                  >
                    Cambiar motor
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={evaluate.isPending}
                    onClick={() =>
                      evaluate.mutate({
                        profileVersionId: createdProfile.id,
                        rulePackVersionId: selectedPack.id,
                      })
                    }
                  >
                    {evaluate.isPending ? 'Ejecutando evaluación…' : 'Evaluar configuración SST'}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </ApplicabilityAccessGate>
  );
}

function TriStateFieldset({
  legend,
  name,
  register,
}: {
  legend: string;
  name: 'hasChemicalProcesses' | 'hasHighEnergyOperations';
  register: ReturnType<typeof useForm<SstProfileFormValues>>['register'];
}) {
  return (
    <fieldset className="applicability-tristate">
      <legend>{legend}</legend>
      <p>“No tengo información” omite el dato; no equivale a “No”.</p>
      <div>
        <label>
          <input type="radio" value="YES" {...register(name)} /> Sí
        </label>
        <label>
          <input type="radio" value="NO" {...register(name)} /> No
        </label>
        <label>
          <input type="radio" value="UNKNOWN" {...register(name)} /> No tengo información
        </label>
      </div>
    </fieldset>
  );
}

export function ApplicabilityAssessmentDetail({ assessmentId }: { assessmentId: string }) {
  const api = useApplicabilityApi();
  const organizationId = api.organizationId ?? 'no-organization';
  const assessment = useQuery({
    queryKey: queryKeys.organization.applicabilityAssessment(organizationId, assessmentId),
    queryFn: ({ signal }) =>
      api.request<ApplicabilityAssessmentDetailRecord>(
        `/applicability/assessments/${assessmentId}`,
        { signal },
      ),
    enabled: Boolean(api.organizationId),
    retry: shouldRetryGet,
  });
  const historical = assessment.data ? assessmentSnapshotPresentation(assessment.data) : undefined;

  return (
    <ApplicabilityAccessGate api={api}>
      {assessment.isLoading ? <ApplicabilitySkeleton label="Cargando evaluación y trace" /> : null}
      {assessment.isError ? (
        <QueryError object="la evaluación" retry={() => void assessment.refetch()} />
      ) : null}
      {assessment.data && historical ? (
        <div className="applicability-assessment-detail stack">
          <ApplicabilityPageHeader
            eyebrow="Resultado histórico"
            title="Evaluación de aplicabilidad"
            description="Resultado determinístico persistido. El detalle usa los snapshots guardados al ejecutar la evaluación."
            action={
              <Link className="button secondary" href="/app/applicability">
                Volver al historial
              </Link>
            }
          />
          <DemoApplicabilityNotice disclaimer={historical.rulePack.disclaimer} />
          <section
            className="applicability-provenance"
            aria-labelledby="assessment-provenance-title"
          >
            <div className="applicability-section-heading">
              <div>
                <p className="applicability-kicker">Proveniencia persistida</p>
                <h2 id="assessment-provenance-title">Contexto de la evaluación</h2>
              </div>
              <span>{formatApplicabilityDate(assessment.data.completedAt)}</span>
            </div>
            <dl className="applicability-confirmation-grid">
              <div>
                <dt>Perfil</dt>
                <dd>Versión {assessment.data.profileVersion.version}</dd>
              </div>
              <div>
                <dt>Motor</dt>
                <dd>{historical.rulePack.name}</dd>
              </div>
              <div>
                <dt>Clave / versión</dt>
                <dd>
                  <code>
                    {historical.rulePack.key} · {historical.rulePack.version}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Motor determinístico</dt>
                <dd>
                  <code>{assessment.data.engineVersion}</code>
                </dd>
              </div>
              <div>
                <dt>Fuente</dt>
                <dd>{historical.rulePack.sourceType}</dd>
              </div>
              <div>
                <dt>Carácter regulatorio</dt>
                <dd>{historical.rulePack.regulatory ? 'Sí' : 'No'}</dd>
              </div>
              <div>
                <dt>Creada por</dt>
                <dd>{assessment.data.createdBy.displayName}</dd>
              </div>
              <div>
                <dt>ID histórico</dt>
                <dd>
                  <code>{assessment.data.id}</code>
                </dd>
              </div>
            </dl>
          </section>
          <ProfileSnapshotSummary
            snapshot={historical.profile}
            version={assessment.data.profileVersion.version}
            createdAt={assessment.data.createdAt}
            heading="Perfil usado por esta evaluación"
          />
          <ApplicabilityDecisionSummary decisions={assessment.data.decisions} />
          <section className="applicability-decisions" aria-labelledby="assessment-decisions-title">
            <div className="applicability-section-heading">
              <div>
                <p className="applicability-kicker">Decisiones del servidor</p>
                <h2 id="assessment-decisions-title">Diagnóstico de configuración demostrativa</h2>
              </div>
              <span>{assessment.data.decisions.length} resultados</span>
            </div>
            <div className="applicability-decision-list">
              {assessment.data.decisions.map((decision) => (
                <ApplicabilityDecisionCard key={decision.id} decision={decision} />
              ))}
            </div>
          </section>
          <div className="applicability-detail-actions">
            <Link className="button secondary" href="/app/applicability">
              Ver historial
            </Link>
            {canManageApplicability(api.role) ? (
              <Link className="button" href="/app/applicability/new">
                Nueva evaluación
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </ApplicabilityAccessGate>
  );
}
