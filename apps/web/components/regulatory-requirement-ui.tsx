'use client';

import { ApiClientError } from '@sst/api-client';
import type { RegulatoryRequirementCatalogItem, RegulatoryRequirementDetail } from '@sst/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  REGULATORY_CONTENT_BOUNDARY_COPY,
  REGULATORY_CONTENT_EMPTY_COPY,
  REGULATORY_EDITORIAL_REPLACEMENT_COPY,
  regulatoryProvisionStatusLabels,
  regulatoryRequirementRelationshipTypeLabels,
  regulatoryRequirementScopeHintLabels,
  regulatoryRequirementStatusLabels,
} from '@/lib/regulatory-content-experience';
import { formatCatalogDate } from '@/lib/regulatory-source-experience';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import {
  ApplicabilityPageHeader,
  ApplicabilitySkeleton,
  ApplicabilityStatePanel,
} from './applicability-experience-ui';
import { useAuth } from './auth-provider';

function shouldRetryGet(failureCount: number, error: Error) {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 1;
}

function useRegulatoryRequirementApi() {
  const auth = useAuth();
  const organization = useOrganization();
  return {
    organizationId: organization.activeId,
    accessLoading: organization.loading,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function RequirementAccessGate({
  api,
  children,
}: {
  api: ReturnType<typeof useRegulatoryRequirementApi>;
  children: React.ReactNode;
}) {
  if (api.accessLoading) return <ApplicabilitySkeleton label="Comprobando acceso a requisitos" />;
  if (!api.organizationId) {
    return (
      <ApplicabilityStatePanel
        kind="info"
        title="Selecciona una organización"
        description="El catálogo es global, pero cada lectura valida la organización activa."
      />
    );
  }
  return children;
}

function RequirementError({ error, retry }: { error: Error; retry(): void }) {
  const unauthorized = error instanceof ApiClientError && [401, 403].includes(error.status);
  return (
    <ApplicabilityStatePanel
      kind="error"
      title={unauthorized ? 'Lectura no autorizada' : 'No pudimos cargar los requisitos'}
      description={
        unauthorized
          ? 'La API no autorizó esta lectura con la sesión y organización activas.'
          : 'La consulta falló. No se mostrará contenido conservado de otra organización.'
      }
      action={
        unauthorized ? undefined : (
          <button type="button" className="button secondary" onClick={retry}>
            Reintentar
          </button>
        )
      }
    />
  );
}

function RequirementBoundaryNotice() {
  return (
    <aside className="regulatory-boundary-notice" aria-label="Límite de interpretación">
      <strong>Requisito identificado, no decisión de aplicabilidad</strong>
      <p>{REGULATORY_CONTENT_BOUNDARY_COPY}</p>
    </aside>
  );
}

export function RegulatoryRequirementCatalog() {
  const api = useRegulatoryRequirementApi();
  const organizationId = api.organizationId ?? 'no-organization';
  const requirements = useQuery({
    queryKey: queryKeys.organization.regulatoryRequirements(organizationId),
    queryFn: ({ signal }) =>
      api.request<RegulatoryRequirementCatalogItem[]>('/regulatory-requirements', { signal }),
    enabled: Boolean(api.organizationId),
    retry: shouldRetryGet,
  });
  const requirementRows = requirements.data ?? [];

  return (
    <RequirementAccessGate api={api}>
      <div className="regulatory-source-page stack">
        <ApplicabilityPageHeader
          eyebrow="Configuración SST · referencia"
          title="Requisitos estructurados"
          description="Conceptos editoriales con procedencia verificable. No son reglas ejecutables."
          action={
            <Link className="button secondary" href="/app/applicability/sources">
              Volver a Fuentes de referencia
            </Link>
          }
        />
        <RequirementBoundaryNotice />
        {requirements.isLoading ? (
          <ApplicabilitySkeleton label="Cargando requisitos estructurados" />
        ) : requirements.isError ? (
          <RequirementError error={requirements.error} retry={() => void requirements.refetch()} />
        ) : requirementRows.length === 0 ? (
          <ApplicabilityStatePanel
            kind="empty"
            title="No hay contenido estructurado todavía."
            description={REGULATORY_CONTENT_EMPTY_COPY}
          />
        ) : (
          <section className="regulatory-requirement-grid" aria-label="Requisitos identificados">
            {requirementRows.map((requirement) => (
              <article className="regulatory-content-card" key={requirement.requirementKey}>
                <span className="regulatory-status">
                  {regulatoryRequirementStatusLabels[requirement.editorialStatus]}
                </span>
                <h2>{requirement.title}</h2>
                <p>{requirement.description}</p>
                <small>{requirement.provenanceCount} referencias de procedencia</small>
                {requirement.supersedesRequirementId ? (
                  <small>{REGULATORY_EDITORIAL_REPLACEMENT_COPY}</small>
                ) : null}
                <Link
                  href={`/app/applicability/requirements/${encodeURIComponent(requirement.requirementKey)}`}
                >
                  Ver procedencia
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </RequirementAccessGate>
  );
}

export function RegulatoryRequirementDetailView({ requirementKey }: { requirementKey: string }) {
  const api = useRegulatoryRequirementApi();
  const organizationId = api.organizationId ?? 'no-organization';
  const requirement = useQuery({
    queryKey: queryKeys.organization.regulatoryRequirement(organizationId, requirementKey),
    queryFn: ({ signal }) =>
      api.request<RegulatoryRequirementDetail>(
        `/regulatory-requirements/${encodeURIComponent(requirementKey)}`,
        { signal },
      ),
    enabled: Boolean(api.organizationId),
    retry: shouldRetryGet,
  });

  return (
    <RequirementAccessGate api={api}>
      <div className="regulatory-source-page stack">
        {requirement.isLoading ? (
          <ApplicabilitySkeleton label="Cargando procedencia del requisito" />
        ) : requirement.isError ? (
          <RequirementError error={requirement.error} retry={() => void requirement.refetch()} />
        ) : requirement.data ? (
          <>
            <ApplicabilityPageHeader
              eyebrow="Requisito identificado"
              title={requirement.data.requirement.title}
              description={requirement.data.requirement.description}
              action={
                <Link className="button secondary" href="/app/applicability/requirements">
                  Volver a requisitos
                </Link>
              }
            />
            <RequirementBoundaryNotice />
            {requirement.data.requirement.supersedesRequirementId ? (
              <ApplicabilityStatePanel
                kind="info"
                title={REGULATORY_EDITORIAL_REPLACEMENT_COPY}
                description="La relación registra continuidad editorial de la plataforma; no declara una derogación o sustitución jurídica."
              />
            ) : null}
            <section
              className="regulatory-source-identity"
              aria-labelledby="requirement-review-title"
            >
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Revisión humana</p>
                  <h2 id="requirement-review-title">Estado editorial</h2>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Revisión</dt>
                  <dd>
                    {
                      regulatoryRequirementStatusLabels[
                        requirement.data.requirement.editorialStatus
                      ]
                    }
                  </dd>
                </div>
                <div>
                  <dt>Orientación de alcance</dt>
                  <dd>
                    {regulatoryRequirementScopeHintLabels[requirement.data.requirement.scopeHint]}
                  </dd>
                </div>
              </dl>
            </section>
            <section aria-labelledby="requirement-provenance-title">
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">¿De dónde salió?</p>
                  <h2 id="requirement-provenance-title">Procedencia</h2>
                </div>
              </div>
              <div className="regulatory-requirement-grid">
                {requirement.data.provenance.map((source) => (
                  <article
                    className="regulatory-content-card"
                    key={`${source.provision.id}-${source.relationshipType}`}
                  >
                    <span className="regulatory-status">
                      {regulatoryRequirementRelationshipTypeLabels[source.relationshipType]}
                    </span>
                    <h3>{source.source.canonicalTitle}</h3>
                    <p>{source.source.referenceNumber}</p>
                    <dl>
                      <div>
                        <dt>Versión de fuente</dt>
                        <dd>{source.sourceVersion.catalogVersion}</dd>
                      </div>
                      <div>
                        <dt>Sección o artículo</dt>
                        <dd>{source.provision.locatorLabel}</dd>
                      </div>
                      <div>
                        <dt>Revisión</dt>
                        <dd>{regulatoryProvisionStatusLabels[source.provision.editorialStatus]}</dd>
                      </div>
                      <div>
                        <dt>Registrada</dt>
                        <dd>{formatCatalogDate(source.sourceVersion.recordedAt)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <ApplicabilityStatePanel
            kind="empty"
            title="Requisito sin procedencia"
            description="No hay contenido estructurado todavía."
          />
        )}
      </div>
    </RequirementAccessGate>
  );
}
