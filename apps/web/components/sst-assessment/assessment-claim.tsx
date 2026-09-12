'use client';

import { ApiClientError } from '@sst/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import {
  canCreateClaimCompany,
  claimCompanyActivity,
  claimDestinationTarget,
  initialClaimDestination,
  reduceClaimDestination,
} from '@/lib/sst-assessment-claim';
import {
  assessmentErrorMessage,
  assessmentFactValue,
  assessmentReconciliationDetails,
} from '@/lib/sst-assessment-presentation';
import {
  clearPublicAssessmentSession,
  forgetAssessmentTargetOrganization,
  loadPublicAssessmentSession,
  rememberAssessmentTargetOrganization,
} from '@/lib/sst-assessment-session-storage';
import { createPublicAssessmentTransport } from '@/lib/sst-assessment-transport';
import type { AssessmentSession } from '@/lib/sst-assessment-types';
import { useAuth } from '../auth-provider';
import { useOrganization } from '../app-shell';
import { AssessmentShell, AssessmentSkeleton } from './assessment-shell';

type WorkCenter = { id: string; name: string; city?: string; isActive: boolean };
type OrganizationDetails = { id: string; name: string; country: string; sector?: string };
type CenterDraft = { name: string; city: string };

function knownString(session: AssessmentSession, factKey: string) {
  const fact = session.snapshot.facts.find(
    (item) => item.scopeKey === 'organization' && item.factKey === factKey,
  );
  return fact?.answerState === 'KNOWN' && typeof fact.value === 'string' ? fact.value : '';
}

function ClaimCenterConfiguration({
  count,
  centers,
  busy,
  onSave,
}: {
  count: number;
  centers: WorkCenter[];
  busy: boolean;
  onSave(drafts: CenterDraft[]): void;
}) {
  const [drafts, setDrafts] = useState<CenterDraft[]>(() =>
    Array.from({ length: count }, (_, index) => ({
      name: centers[index]?.name ?? `Centro ${index + 1}`,
      city: centers[index]?.city ?? '',
    })),
  );
  return (
    <section className="assessment-preflight-card">
      <h2>Configura los centros de trabajo</h2>
      <p>
        La evaluación contiene {count} {count === 1 ? 'centro' : 'centros'}. Configuraremos la
        empresa nueva con esa topología antes del vínculo.
      </p>
      {drafts.map((draft, index) => (
        <div className="assessment-inline-form" key={index}>
          <label>
            <span>Centro {index + 1}</span>
            <input
              value={draft.name}
              onChange={(event) =>
                setDrafts((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <label>
            <span>Ciudad · opcional</span>
            <input
              value={draft.city}
              onChange={(event) =>
                setDrafts((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, city: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
        </div>
      ))}
      <button
        className="button"
        type="button"
        disabled={busy || drafts.some(({ name }) => name.trim().length < 2)}
        onClick={() => onSave(drafts)}
      >
        {busy ? 'Guardando centros…' : 'Guardar centros y continuar'}
      </button>
    </section>
  );
}

export function AssessmentClaim() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const search = useSearchParams();
  const sessionId = search.get('assessment');
  const [record, setRecord] = useState<ReturnType<typeof loadPublicAssessmentSession>>();
  const [destination, dispatchDestination] = useReducer(
    reduceClaimDestination,
    initialClaimDestination,
  );
  const [companyName, setCompanyName] = useState('');
  const [companySector, setCompanySector] = useState('');
  const [mappings, setMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    const loaded = loadPublicAssessmentSession(window.localStorage, sessionId);
    setRecord(loaded);
    if (loaded?.targetOrganizationId && loaded.targetOrganizationMode === 'NEW') {
      dispatchDestination({ type: 'company-created', organizationId: loaded.targetOrganizationId });
    } else if (loaded?.targetOrganizationId && loaded.targetOrganizationMode === 'EXISTING') {
      dispatchDestination({
        type: 'choose-existing',
        organizationId: loaded.targetOrganizationId,
      });
    }
  }, [sessionId]);
  const transport = useMemo(
    () => (record ? createPublicAssessmentTransport(record.sessionId, record.publicToken) : null),
    [record],
  );
  const assessment = useQuery({
    queryKey: queryKeys.public.sstAssessment.session(record?.sessionId ?? 'inactive'),
    queryFn: () => transport!.get(),
    enabled: Boolean(transport),
    retry: false,
  });
  const target = claimDestinationTarget(destination);
  const completeClaim = useCallback(
    async (claimed: AssessmentSession, targetOrganizationId = target) => {
      if (!record || !targetOrganizationId) return;
      clearPublicAssessmentSession(window.localStorage, record.sessionId);
      queryClient.removeQueries({
        queryKey: queryKeys.public.sstAssessment.session(record.sessionId),
      });
      queryClient.setQueryData(
        queryKeys.organization.sstAssessmentSession(targetOrganizationId, claimed.id),
        claimed,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.workCenters(targetOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.sstAssessmentSetup(targetOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organization.sstAssessmentHistory(targetOrganizationId),
        }),
      ]);
      router.replace(`/app/evaluation/${claimed.id}`);
    },
    [queryClient, record, router, target],
  );
  const ambiguousClaim =
    assessment.error instanceof ApiClientError &&
    assessment.error.payload.code === 'SST_ASSESSMENT_TOKEN_INVALID';
  const recoverClaim = Boolean(
    ambiguousClaim && record?.targetOrganizationId && target && auth.user && !auth.loading,
  );
  const recoveredClaim = useQuery({
    queryKey: queryKeys.organization.sstAssessmentSession(
      target ?? 'inactive',
      record?.sessionId ?? 'none',
    ),
    queryFn: ({ signal }) =>
      auth.request<AssessmentSession>(
        `/sst-assessment/sessions/${record!.sessionId}`,
        { signal },
        target!,
      ),
    enabled: recoverClaim,
    retry: false,
  });
  useEffect(() => {
    if (recoveredClaim.data && target) void completeClaim(recoveredClaim.data, target);
  }, [completeClaim, recoveredClaim.data, target]);
  const details = useQuery({
    queryKey: queryKeys.organization.details(target ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<OrganizationDetails>(`/organizations/${target}`, { signal }, target!),
    enabled: Boolean(target),
  });
  const centers = useQuery({
    queryKey: queryKeys.organization.workCenters(target ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<WorkCenter[]>(`/organizations/${target}/work-centers`, { signal }, target!),
    enabled: Boolean(target),
  });
  const createCompany = useMutation({
    mutationFn: async () => {
      const country = knownString(assessment.data!, 'organization.country');
      const sector = claimCompanyActivity(
        knownString(assessment.data!, 'organization.sector'),
        companySector,
      );
      if (!sector) throw new Error('La actividad principal es necesaria para crear la empresa.');
      return auth.request<{ id: string }>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: companyName, country, sector }),
      });
    },
    onSuccess: async (created) => {
      rememberAssessmentTargetOrganization(
        window.localStorage,
        record!.sessionId,
        created.id,
        'NEW',
      );
      dispatchDestination({ type: 'company-created', organizationId: created.id });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.user.organizations(auth.user!.id),
      });
      await organization.setActiveId(created.id, 'Empresa creada. Continuemos con sus centros.');
    },
  });
  const claimNewOrganization = useMutation({
    mutationFn: (drafts: CenterDraft[]) =>
      auth.request<AssessmentSession>(
        `/sst-assessment/public/sessions/${record!.sessionId}/claim-new-organization`,
        {
          method: 'POST',
          body: JSON.stringify({
            publicToken: record!.publicToken,
            centers: centerScopes.map((scope, index) => ({
              scopeKey: scope.scopeKey,
              name: drafts[index]!.name,
              city: drafts[index]!.city || undefined,
            })),
          }),
        },
        target!,
      ),
    onSuccess: (claimed) => completeClaim(claimed),
  });
  const claim = useMutation({
    mutationFn: () =>
      auth.request<AssessmentSession>(
        `/sst-assessment/public/sessions/${record!.sessionId}/claim`,
        {
          method: 'POST',
          body: JSON.stringify({
            publicToken: record!.publicToken,
            scopeMappings: Object.entries(mappings).map(([scopeKey, workCenterId]) => ({
              scopeKey,
              workCenterId,
            })),
          }),
        },
        target!,
      ),
    onSuccess: (claimed) => completeClaim(claimed),
  });

  if (record === undefined || assessment.isLoading || (recoverClaim && !recoveredClaim.isError))
    return <AssessmentSkeleton />;
  if (!sessionId || !record || assessment.isError || !assessment.data)
    return (
      <AssessmentShell
        title="No pudimos recuperar esta evaluación"
        description="El token no viaja en la URL. Vuelve al mismo navegador donde terminaste la evaluación o inicia una nueva."
      >
        <button
          className="button"
          type="button"
          onClick={() => router.replace('/app/setup/new-company')}
        >
          Iniciar una nueva evaluación
        </button>
      </AssessmentShell>
    );
  const session = assessment.data;
  const centerScopes = session.snapshot.scopes.filter(({ kind }) => kind === 'WORK_CENTER');
  const activeCenters = centers.data?.filter(({ isActive }) => isActive) ?? [];
  const selectedTarget = organization.organizations.find(({ id }) => id === target);
  const assessmentSector = knownString(session, 'organization.sector');
  const topologyReady = Boolean(
    target && centers.isSuccess && activeCenters.length === centerScopes.length,
  );
  const mappingReady = topologyReady && destination.mode === 'EXISTING';
  const allMapped =
    centerScopes.every(({ scopeKey }) => mappings[scopeKey]) &&
    new Set(Object.values(mappings)).size === centerScopes.length;
  const mutationError = createCompany.error ?? claimNewOrganization.error ?? claim.error;
  const reconciliation = assessmentReconciliationDetails(mutationError);
  const message = mutationError && !reconciliation ? assessmentErrorMessage(mutationError) : '';

  return (
    <AssessmentShell
      title="Guarda este diagnóstico en tu empresa"
      description="El vínculo es explícito: primero eliges o creas la empresa y después confirmas la correspondencia de cada centro."
    >
      <section className="assessment-preflight-card">
        <h2>Diagnóstico recuperado</h2>
        <p>
          {session.result?.summary.title ?? 'Evaluación SST finalizada'} · {centerScopes.length}{' '}
          {centerScopes.length === 1 ? 'centro evaluado' : 'centros evaluados'}.
        </p>
      </section>
      {destination.mode === 'UNDECIDED' ? (
        <section className="assessment-preflight-card">
          <h2>Elige dónde guardarlo</h2>
          {organization.organizations.map((item) => (
            <button
              className="assessment-company-option"
              type="button"
              key={item.id}
              onClick={() => {
                dispatchDestination({ type: 'choose-existing', organizationId: item.id });
                rememberAssessmentTargetOrganization(
                  window.localStorage,
                  record.sessionId,
                  item.id,
                  'EXISTING',
                );
                void organization.setActiveId(item.id);
              }}
            >
              <strong>{item.name}</strong>
              <span>
                {item.id === organization.activeId ? 'Empresa activa · ' : ''}Vincular a esta
                empresa
              </span>
            </button>
          ))}
          <button
            className="assessment-company-option"
            type="button"
            onClick={() => {
              dispatchDestination({ type: 'choose-new' });
              setMappings({});
            }}
          >
            <strong>Crear nueva empresa</strong>
            <span>Guardar el diagnóstico en una empresa nueva</span>
          </button>
        </section>
      ) : null}
      {destination.mode === 'NEW' && !destination.createdOrganizationId ? (
        <section className="assessment-preflight-card">
          <h2>Crea la empresa</h2>
          <div className="assessment-inline-form">
            <label>
              <span>Nombre de empresa</span>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            </label>
            {assessmentSector ? (
              <p>
                <span>Actividad principal</span>
                <strong>{assessmentSector}</strong>
              </p>
            ) : (
              <label>
                <span>Actividad principal</span>
                <input
                  value={companySector}
                  placeholder="Ej. manufactura de alimentos"
                  onChange={(event) => setCompanySector(event.target.value)}
                />
              </label>
            )}
          </div>
          <button
            className="button"
            type="button"
            disabled={
              !canCreateClaimCompany(companyName, assessmentSector, companySector) ||
              createCompany.isPending
            }
            onClick={() => createCompany.mutate()}
          >
            {createCompany.isPending ? 'Creando empresa…' : 'Crear empresa'}
          </button>
          <button
            className="assessment-skip"
            type="button"
            onClick={() => dispatchDestination({ type: 'reset' })}
          >
            Volver a elegir destino
          </button>
        </section>
      ) : null}
      {target ? (
        <section className="assessment-preflight-card">
          <h2>Empresa de destino</h2>
          <p>
            <strong>{selectedTarget?.name ?? details.data?.name ?? 'Empresa seleccionada'}</strong>
          </p>
          <button
            className="assessment-skip"
            type="button"
            onClick={() => {
              forgetAssessmentTargetOrganization(window.localStorage, record.sessionId);
              dispatchDestination({ type: 'reset' });
              setMappings({});
              createCompany.reset();
              claimNewOrganization.reset();
              claim.reset();
            }}
          >
            Elegir otra empresa
          </button>
        </section>
      ) : null}
      {target && destination.mode === 'NEW' && centers.isSuccess ? (
        <ClaimCenterConfiguration
          count={centerScopes.length}
          centers={activeCenters}
          busy={claimNewOrganization.isPending}
          onSave={(drafts) => claimNewOrganization.mutate(drafts)}
        />
      ) : null}
      {target && destination.mode === 'EXISTING' && centers.isSuccess && !topologyReady ? (
        <section className="assessment-preflight-card" role="status">
          <h2>Revisa el alcance de los centros</h2>
          <p>
            Esta evaluación incluye {centerScopes.length}{' '}
            {centerScopes.length === 1 ? 'centro' : 'centros'}, pero{' '}
            {selectedTarget?.name ?? 'tu empresa'} tiene {activeCenters.length}{' '}
            {activeCenters.length === 1 ? 'centro activo' : 'centros activos'}. No modificaremos sus
            centros para forzar el vínculo.
          </p>
          <div className="assessment-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => router.push('/app/organizations')}
            >
              Revisar mi empresa
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => router.push('/app/evaluation')}
            >
              Iniciar una evaluación con el alcance actual
            </button>
          </div>
        </section>
      ) : null}
      {mappingReady ? (
        <section className="assessment-preflight-card">
          <h2>Confirma la correspondencia</h2>
          <p>Cada centro evaluado debe vincularse una sola vez a un centro activo de la empresa.</p>
          {centerScopes.map((scope) => (
            <label className="field" key={scope.scopeKey}>
              <span>{scope.displayName}</span>
              <select
                value={mappings[scope.scopeKey] ?? ''}
                onChange={(event) =>
                  setMappings((current) => ({ ...current, [scope.scopeKey]: event.target.value }))
                }
              >
                <option value="">Selecciona un centro</option>
                {activeCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                    {center.city ? ` · ${center.city}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            className="button"
            type="button"
            disabled={!allMapped || claim.isPending}
            onClick={() => claim.mutate()}
          >
            {claim.isPending ? 'Vinculando diagnóstico…' : 'Confirmar y vincular diagnóstico'}
          </button>
        </section>
      ) : null}
      {reconciliation && target ? (
        <section className="assessment-preflight-card" role="alert">
          <h2>Necesitamos revisar una diferencia antes de vincular</h2>
          <p>
            Tu diagnóstico y la información actual de esta empresa no coinciden en algunos puntos.
            No cambiaremos ninguno automáticamente.
          </p>
          <ul>
            {reconciliation.categories.map((category) => (
              <li key={category}>{category}</li>
            ))}
          </ul>
          <div className="assessment-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                forgetAssessmentTargetOrganization(window.localStorage, record.sessionId);
                dispatchDestination({ type: 'reset' });
                setMappings({});
                createCompany.reset();
                claimNewOrganization.reset();
                claim.reset();
              }}
            >
              Elegir otra empresa
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => router.push('/app/organizations')}
            >
              Revisar empresa
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                forgetAssessmentTargetOrganization(window.localStorage, record.sessionId);
                router.push('/app/evaluation');
              }}
            >
              Evaluar esta empresa con su información actual
            </button>
          </div>
        </section>
      ) : null}
      {message ? (
        <p className="field-error" role="alert">
          {message}
        </p>
      ) : null}
      <details>
        <summary>Información confirmada</summary>
        {session.snapshot.facts.slice(0, 8).map((fact) => (
          <p key={`${fact.scopeKey}:${fact.factKey}`}>{assessmentFactValue(fact)}</p>
        ))}
      </details>
    </AssessmentShell>
  );
}
