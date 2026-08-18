'use client';

import { ApiClientError } from '@sst/api-client';
import type {
  RegulatoryCandidateStatus,
  RegulatoryDocumentType,
  RegulatorySourceDetail,
  RegulatorySourceListItem,
  RegulatorySourceRelationshipRecord,
  RegulatorySourceVersionRecord,
} from '@sst/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  formatCatalogDate,
  REGULATORY_SOURCE_BOUNDARY_COPY,
  regulatoryCandidateStatusLabels,
  regulatoryDocumentTypeLabels,
  regulatoryRelationshipReviewStatusLabels,
  regulatoryRelationshipTypeLabels,
  regulatorySourceQueryString,
  regulatorySupersessionStatusLabels,
  type RegulatorySourceFilters,
} from '@/lib/regulatory-source-experience';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import {
  ApplicabilityPageHeader,
  ApplicabilitySkeleton,
  ApplicabilityStatePanel,
} from './applicability-experience-ui';
import { useAuth } from './auth-provider';

const EMPTY_FILTERS: RegulatorySourceFilters = {
  issuer: '',
  documentType: '',
  candidateStatus: '',
};

function shouldRetryGet(failureCount: number, error: Error) {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 1;
}

function useRegulatorySourceApi() {
  const auth = useAuth();
  const organization = useOrganization();
  return {
    organizationId: organization.activeId,
    accessLoading: organization.loading,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function RegulatoryAccessGate({
  api,
  children,
}: {
  api: ReturnType<typeof useRegulatorySourceApi>;
  children: React.ReactNode;
}) {
  if (api.accessLoading) return <ApplicabilitySkeleton label="Comprobando acceso al catálogo" />;
  if (!api.organizationId) {
    return (
      <ApplicabilityStatePanel
        kind="info"
        title="Selecciona una organización"
        description="El catálogo es global, pero cada lectura requiere validar la organización activa."
      />
    );
  }
  return children;
}

function RegulatoryQueryError({ error, retry }: { error: Error; retry(): void }) {
  const denied = error instanceof ApiClientError && error.status === 403;
  return (
    <ApplicabilityStatePanel
      kind="error"
      title={
        denied ? 'Catálogo no disponible para esta organización' : 'No pudimos cargar las fuentes'
      }
      description={
        denied
          ? 'La organización activa no tiene habilitado el módulo de aplicabilidad. La API mantiene la decisión de acceso.'
          : 'La consulta falló. No se mostrará un estado vacío ni información conservada de otra organización.'
      }
      action={
        denied ? undefined : (
          <button className="button secondary" type="button" onClick={retry}>
            Reintentar
          </button>
        )
      }
    />
  );
}

function CatalogBoundaryNotice() {
  return (
    <aside className="regulatory-boundary-notice" aria-label="Límite de interpretación">
      <strong>Metadata de catálogo, no interpretación legal</strong>
      <p>{REGULATORY_SOURCE_BOUNDARY_COPY}</p>
    </aside>
  );
}

function Readiness({ readyForRules }: { readyForRules: boolean }) {
  return (
    <span className="regulatory-status" data-tone={readyForRules ? 'success' : 'warning'}>
      {readyForRules ? 'Lista editorialmente para reglas' : 'No lista para reglas'}
    </span>
  );
}

export function RegulatorySourceCatalog() {
  const api = useRegulatorySourceApi();
  const [filters, setFilters] = useState<RegulatorySourceFilters>(EMPTY_FILTERS);
  const queryString = regulatorySourceQueryString(filters);
  const organizationId = api.organizationId ?? 'no-organization';
  const sources = useQuery({
    queryKey: queryKeys.organization.regulatorySources(organizationId, queryString),
    queryFn: ({ signal }) =>
      api.request<RegulatorySourceListItem[]>(`/regulatory-sources${queryString}`, { signal }),
    enabled: Boolean(api.organizationId),
    retry: shouldRetryGet,
  });
  const sourceRows = sources.data ?? [];

  return (
    <RegulatoryAccessGate api={api}>
      <div className="regulatory-source-page stack">
        <ApplicabilityPageHeader
          eyebrow="Configuración SST · referencia"
          title="Fuentes de referencia"
          description="Catálogo versionado de fuentes candidatas de Ecuador. La consulta es de solo lectura."
          action={
            <Link className="button secondary" href="/app/applicability">
              Volver a Configuración SST
            </Link>
          }
        />
        <CatalogBoundaryNotice />

        <section className="regulatory-filters" aria-labelledby="regulatory-filter-title">
          <div>
            <h2 id="regulatory-filter-title">Filtrar fuentes</h2>
            <p>Los filtros consultan únicamente metadata editorial.</p>
          </div>
          <label>
            Emisor
            <input
              value={filters.issuer}
              onChange={(event) =>
                setFilters((current) => ({ ...current, issuer: event.target.value }))
              }
              placeholder="Ej. Ministerio del Trabajo"
            />
          </label>
          <label>
            Tipo de documento
            <select
              value={filters.documentType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  documentType: event.target.value as '' | RegulatoryDocumentType,
                }))
              }
            >
              <option value="">Todos</option>
              {Object.entries(regulatoryDocumentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado de revisión
            <select
              value={filters.candidateStatus}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  candidateStatus: event.target.value as '' | RegulatoryCandidateStatus,
                }))
              }
            >
              <option value="">Todos</option>
              {Object.entries(regulatoryCandidateStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Limpiar filtros
          </button>
        </section>

        {sources.isLoading ? (
          <ApplicabilitySkeleton label="Cargando fuentes de referencia" />
        ) : sources.isError ? (
          <RegulatoryQueryError error={sources.error} retry={() => void sources.refetch()} />
        ) : sourceRows.length === 0 ? (
          <ApplicabilityStatePanel
            kind="empty"
            title="No hay coincidencias"
            description="No encontramos fuentes candidatas con los filtros seleccionados."
            action={
              <button
                className="button secondary"
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                Limpiar filtros
              </button>
            }
          />
        ) : (
          <section aria-labelledby="regulatory-source-results-title">
            <div className="applicability-section-heading">
              <div>
                <p className="applicability-kicker">Catálogo global · acceso validado</p>
                <h2 id="regulatory-source-results-title">Fuentes candidatas</h2>
              </div>
              <span>
                {sourceRows.length} {sourceRows.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>
            <div className="regulatory-source-grid">
              {sourceRows.map((source) => (
                <article className="regulatory-source-card" key={source.sourceKey}>
                  <div className="regulatory-source-card__heading">
                    <span className="regulatory-status">
                      {regulatoryDocumentTypeLabels[source.documentType]}
                    </span>
                    <span>Catálogo v{source.latestCatalogVersion}</span>
                  </div>
                  <div>
                    <p>{source.issuer}</p>
                    <h3>{source.canonicalTitle}</h3>
                    <code>{source.referenceNumber}</code>
                  </div>
                  <dl>
                    <div>
                      <dt>Revisión</dt>
                      <dd>{regulatoryCandidateStatusLabels[source.candidateStatus]}</dd>
                    </div>
                    <div>
                      <dt>Documento oficial</dt>
                      <dd>{source.officialDocumentLocated ? 'Localizado' : 'No localizado'}</dd>
                    </div>
                    <div>
                      <dt>Relación</dt>
                      <dd>{regulatorySupersessionStatusLabels[source.supersessionStatus]}</dd>
                    </div>
                  </dl>
                  <div className="regulatory-source-card__footer">
                    <Readiness readyForRules={source.readyForRules} />
                    <Link
                      href={`/app/applicability/sources/${encodeURIComponent(source.sourceKey)}`}
                    >
                      Ver metadata
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </RegulatoryAccessGate>
  );
}

function VersionCard({ version }: { version: RegulatorySourceVersionRecord }) {
  return (
    <article className="regulatory-version-card">
      <div>
        <strong>Versión de catálogo {version.catalogVersion}</strong>
        <span>Registrada {formatCatalogDate(version.recordedAt)}</span>
      </div>
      <dl>
        <div>
          <dt>Estado editorial</dt>
          <dd>{regulatoryCandidateStatusLabels[version.candidateStatus]}</dd>
        </div>
        <div>
          <dt>Documento oficial</dt>
          <dd>{version.officialDocumentLocated ? 'Localizado' : 'No localizado'}</dd>
        </div>
        <div>
          <dt>Publicación</dt>
          <dd>{formatCatalogDate(version.publicationDate)}</dd>
        </div>
        <div>
          <dt>Desde</dt>
          <dd>{formatCatalogDate(version.effectiveFrom)}</dd>
        </div>
        <div>
          <dt>Hasta</dt>
          <dd>{formatCatalogDate(version.effectiveTo)}</dd>
        </div>
        <div>
          <dt>Extracción</dt>
          <dd>{version.readyForExtraction ? 'Preparada editorialmente' : 'No preparada'}</dd>
        </div>
      </dl>
      {version.reviewNotes ? <p>{version.reviewNotes}</p> : null}
      <Readiness readyForRules={version.readyForRules} />
    </article>
  );
}

export function RegulatorySourceDetailView({ sourceKey }: { sourceKey: string }) {
  const api = useRegulatorySourceApi();
  const organizationId = api.organizationId ?? 'no-organization';
  const enabled = Boolean(api.organizationId);
  const encodedKey = encodeURIComponent(sourceKey);
  const detail = useQuery({
    queryKey: queryKeys.organization.regulatorySource(organizationId, sourceKey),
    queryFn: ({ signal }) =>
      api.request<RegulatorySourceDetail>(`/regulatory-sources/${encodedKey}`, { signal }),
    enabled,
    retry: shouldRetryGet,
  });
  const versions = useQuery({
    queryKey: queryKeys.organization.regulatorySourceVersions(organizationId, sourceKey),
    queryFn: ({ signal }) =>
      api.request<RegulatorySourceVersionRecord[]>(`/regulatory-sources/${encodedKey}/versions`, {
        signal,
      }),
    enabled,
    retry: shouldRetryGet,
  });
  const relationships = useQuery({
    queryKey: queryKeys.organization.regulatorySourceRelationships(organizationId, sourceKey),
    queryFn: ({ signal }) =>
      api.request<RegulatorySourceRelationshipRecord[]>(
        `/regulatory-sources/${encodedKey}/relationships`,
        { signal },
      ),
    enabled,
    retry: shouldRetryGet,
  });
  const firstError = detail.error ?? versions.error ?? relationships.error;

  return (
    <RegulatoryAccessGate api={api}>
      <div className="regulatory-source-page stack">
        {detail.isLoading || versions.isLoading || relationships.isLoading ? (
          <ApplicabilitySkeleton label="Cargando metadata de la fuente" />
        ) : firstError ? (
          <RegulatoryQueryError
            error={firstError}
            retry={() => {
              void detail.refetch();
              void versions.refetch();
              void relationships.refetch();
            }}
          />
        ) : detail.data && versions.data && relationships.data ? (
          <>
            <ApplicabilityPageHeader
              eyebrow="Fuente candidata"
              title={detail.data.source.canonicalTitle}
              description={`${detail.data.source.issuer} · ${detail.data.source.referenceNumber}`}
              action={
                <Link className="button secondary" href="/app/applicability/sources">
                  Volver al catálogo
                </Link>
              }
            />
            <CatalogBoundaryNotice />
            <section className="regulatory-source-identity" aria-labelledby="source-identity-title">
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Identidad estable</p>
                  <h2 id="source-identity-title">Identidad de la fuente</h2>
                </div>
                <code>{detail.data.source.sourceKey}</code>
              </div>
              <dl>
                <div>
                  <dt>País</dt>
                  <dd>{detail.data.source.countryCode}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{regulatoryDocumentTypeLabels[detail.data.source.documentType]}</dd>
                </div>
                <div>
                  <dt>Estado editorial</dt>
                  <dd>
                    {regulatoryCandidateStatusLabels[detail.data.latestVersion.candidateStatus]}
                  </dd>
                </div>
                <div>
                  <dt>Revisión de relación</dt>
                  <dd>
                    {
                      regulatorySupersessionStatusLabels[
                        detail.data.latestVersion.supersessionStatus
                      ]
                    }
                  </dd>
                </div>
              </dl>
              {detail.data.latestVersion.officialUrl ? (
                <a
                  className="button secondary"
                  href={detail.data.latestVersion.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir documento localizado
                </a>
              ) : (
                <p className="applicability-muted">No se ha fijado un documento oficial.</p>
              )}
            </section>

            <section aria-labelledby="source-version-history-title">
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Snapshots inmutables</p>
                  <h2 id="source-version-history-title">Historial de versiones</h2>
                </div>
                <span>{versions.data.length} versiones</span>
              </div>
              <div className="regulatory-version-list">
                {versions.data.map((version) => (
                  <VersionCard key={version.catalogVersion} version={version} />
                ))}
              </div>
            </section>

            <section
              className="regulatory-relationships"
              aria-labelledby="source-relationships-title"
            >
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Sin inferencias automáticas</p>
                  <h2 id="source-relationships-title">Relaciones entre fuentes</h2>
                </div>
              </div>
              {relationships.data.length === 0 ? (
                <p>No hay relaciones registradas para esta fuente.</p>
              ) : (
                <div>
                  {relationships.data.map((relationship) => (
                    <article
                      key={`${relationship.fromSource.sourceKey}-${relationship.toSource.sourceKey}-${relationship.relationshipType}`}
                    >
                      <strong>
                        {regulatoryRelationshipTypeLabels[relationship.relationshipType]}
                      </strong>
                      <p>
                        {relationship.fromSource.referenceNumber} →{' '}
                        {relationship.toSource.referenceNumber}
                      </p>
                      <span>
                        {regulatoryRelationshipReviewStatusLabels[relationship.reviewStatus]}
                      </span>
                      {relationship.notes ? <small>{relationship.notes}</small> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <ApplicabilityStatePanel
            kind="empty"
            title="Fuente sin metadata"
            description="La fuente no tiene una versión de catálogo consultable."
          />
        )}
      </div>
    </RegulatoryAccessGate>
  );
}
