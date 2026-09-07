'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  InspectionPageHeader,
  InspectionSkeleton,
  InspectionState,
} from './inspection-experience-ui';
import { TechnicalDetails } from './technical-details';

type Catalog = {
  id: string;
  version: number;
  contentDigest: string;
  taxonomy: { name: string; inspectionDomain: string };
  resources: Array<{ id: string; code: string; name: string; level: string }>;
  mappingVersions: Array<{
    id: string;
    version: number;
    standardVersionId: string;
    contentDigest: string;
    mappings: Array<{ resourceId: string; criterionId: string }>;
  }>;
};
type Proposal = {
  id: string;
  status: string;
  provider: string;
  model: string;
  createdAt: string;
  resource: { name: string };
};

const proposalRoles = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
const reviewRoles = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

const levels = [
  ['MINOR', 'Recursos menores'],
  ['MAJOR', 'Instalaciones mayores'],
  ['INDUSTRIAL_SERVICE', 'Servicios industriales'],
] as const;

export function InspectionResources() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const [resourceId, setResourceId] = useState('');
  const request = <T,>(path: string, init?: RequestInit) =>
    auth.request<T>(path, init, organizationId ?? undefined);
  const catalog = useQuery({
    queryKey: queryKeys.organization.inspectionResources(
      organizationId ?? 'inactive',
      'ELECTRICAL',
      'all',
    ),
    queryFn: ({ signal }) =>
      request<Catalog | null>('/inspection-resources?domain=ELECTRICAL', { signal }),
    enabled: Boolean(organizationId),
  });
  const proposals = useQuery({
    queryKey: queryKeys.organization.inspectionResourceProposals(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => request<Proposal[]>('/inspection-resources/proposals', { signal }),
    enabled: Boolean(organizationId),
  });
  const create = useMutation({
    mutationFn: () =>
      request('/inspection-resources/proposals', {
        method: 'POST',
        body: JSON.stringify({
          resourceId,
          keywords: ['seguridad eléctrica', 'control preventivo'],
        }),
      }),
    onSuccess: async () => {
      setResourceId('');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionResourceProposals(organizationId!),
      });
    },
  });
  const refreshProposals = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.organization.inspectionResourceProposals(organizationId!),
    });
  const submit = useMutation({
    mutationFn: (proposalId: string) =>
      request(`/inspection-resources/proposals/${proposalId}/submit`, { method: 'POST' }),
    onSuccess: refreshProposals,
  });
  const review = useMutation({
    mutationFn: ({
      proposalId,
      decision,
    }: {
      proposalId: string;
      decision: 'APPROVED' | 'REJECTED';
    }) =>
      request(`/inspection-resources/proposals/${proposalId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      }),
    onSuccess: refreshProposals,
  });

  if (catalog.isLoading || proposals.isLoading)
    return <InspectionSkeleton label="Cargando alcance de recursos" />;
  if (catalog.isError || proposals.isError)
    return (
      <InspectionState
        kind="error"
        title="No pudimos cargar el alcance"
        description="Actualiza la vista e inténtalo nuevamente."
      />
    );
  if (!catalog.data)
    return (
      <InspectionState
        kind="empty"
        title="Sin taxonomía activa"
        description="No existe un alcance de recursos configurado para este dominio."
      />
    );
  const catalogData = catalog.data;

  return (
    <div className="inspection-task-page stack">
      <InspectionPageHeader
        eyebrow="Inspection Resource Scope V0"
        title="Alcance de recursos eléctricos"
        description="Selecciona qué elemento se inspecciona antes de resolver la Base, el mapping y los criterios exactos."
      />
      <Card className="inspection-summary-card" role="note">
        <strong>Resource Scope no reemplaza Estándares ni Base de inspección.</strong>
        <p>
          Esta taxonomía es sintética. Cada nueva inspección conserva la versión, el recurso y el
          mapping usados; los registros históricos no cambian.
        </p>
        <TechnicalDetails summary="Ver versión técnica">
          <p>Taxonomía v{catalogData.version}</p>
          <code>{catalogData.contentDigest}</code>
        </TechnicalDetails>
      </Card>
      {levels.map(([level, label]) => (
        <section key={level} aria-labelledby={`resource-level-${level}`}>
          <h2 id={`resource-level-${level}`}>{label}</h2>
          <div className="inspection-card-grid">
            {catalogData.resources
              .filter((resource) => resource.level === level)
              .map((resource) => {
                const criteria = new Set(
                  catalogData.mappingVersions.flatMap((mapping) =>
                    mapping.mappings
                      .filter((row) => row.resourceId === resource.id)
                      .map((row) => row.criterionId),
                  ),
                );
                return (
                  <Card key={resource.id}>
                    <h3>{resource.name}</h3>
                    <p>
                      {criteria.size} criterio(s) versionados disponibles según la base
                      seleccionada.
                    </p>
                  </Card>
                );
              })}
          </div>
        </section>
      ))}
      <Card className="inspection-form-card">
        <p className="eyebrow">Spike editorial controlado</p>
        <h2>Proponer criterios con IA para revisión experta</h2>
        <p>
          Solo staging, datos sintéticos y unidades oficiales ya almacenadas. Aprobar una propuesta
          no publica reglas, estándares ni mappings de runtime.
        </p>
        <div className="field">
          <label htmlFor="draft-resource">Recurso</label>
          <select
            id="draft-resource"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
          >
            <option value="">Selecciona un recurso</option>
            {catalogData.resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="button"
          type="button"
          disabled={!resourceId || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Preparando propuesta…' : 'Crear propuesta editorial'}
        </button>
        {create.isError ? (
          <p role="alert">
            {create.error instanceof ApiClientError
              ? create.error.message
              : 'No fue posible crear la propuesta.'}
          </p>
        ) : null}
      </Card>
      <section aria-labelledby="proposal-history-title">
        <h2 id="proposal-history-title">Historial editorial</h2>
        {proposals.data?.length ? (
          proposals.data.map((proposal) => (
            <Card key={proposal.id}>
              <h3>{proposal.resource.name}</h3>
              <p>
                {proposal.status} · {proposal.provider} · {proposal.model}
              </p>
              {proposal.status === 'AI_PROPOSED' &&
              proposalRoles.has(organization.currentRole ?? '') ? (
                <button
                  type="button"
                  className="button secondary"
                  disabled={submit.isPending}
                  onClick={() => submit.mutate(proposal.id)}
                >
                  Enviar a revisión experta
                </button>
              ) : null}
              {proposal.status === 'PENDING_EXPERT_REVIEW' &&
              reviewRoles.has(organization.currentRole ?? '') ? (
                <div className="inspection-sticky-actions">
                  <button
                    type="button"
                    className="button"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ proposalId: proposal.id, decision: 'APPROVED' })}
                  >
                    Aprobar editorialmente
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ proposalId: proposal.id, decision: 'REJECTED' })}
                  >
                    Rechazar propuesta
                  </button>
                </div>
              ) : null}
              <small>{new Date(proposal.createdAt).toLocaleString('es-EC')}</small>
            </Card>
          ))
        ) : (
          <p>No existen propuestas editoriales.</p>
        )}
      </section>
      {submit.isError || review.isError ? (
        <p role="alert">No fue posible actualizar el estado editorial de la propuesta.</p>
      ) : null}
    </div>
  );
}
