'use client';

import { ApiClientError } from '@sst/api-client';
import type {
  RegulatoryCandidateStatus,
  RegulatoryDocumentType,
  RegulatorySourceDetail,
  RegulatorySourceListItem,
  RegulatorySourceRelationshipRecord,
  RegulatorySourceProvision,
  RegulatorySourceVersionRecord,
  RegulatoryUnitRecord,
} from '@sst/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  REGULATORY_CONTENT_EMPTY_COPY,
  REGULATORY_EDITORIAL_REPLACEMENT_COPY,
  regulatoryProvisionLocatorTypeLabels,
  regulatoryProvisionStatusLabels,
  regulatoryRequirementStatusLabels,
} from '@/lib/regulatory-content-experience';
import {
  formatCatalogDate,
  REGULATORY_SOURCE_BOUNDARY_COPY,
  regulatoryCandidateStatusLabels,
  regulatoryDocumentTypeLabels,
  regulatoryRelationshipReviewStatusLabels,
  regulatoryRelationshipLabel,
  regulatorySourceQueryString,
  regulatoryVigenciaReviewStatusLabels,
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
  q: '',
  issuer: '',
  documentType: '',
  candidateStatus: '',
};

type RegulatoryUnitListResponse = {
  sourceKey: string;
  version: null | {
    id: string;
    catalogVersion: number;
    artifactVerificationStatus: string;
    textExtractionStatus: string;
  };
  items: Array<RegulatoryUnitRecord & { createdAt: string }>;
  structuralBoundary: string;
};

type RegulatoryUnitDetailResponse = {
  unit: RegulatoryUnitRecord & { createdAt: string };
  source: RegulatorySourceDetail['source'];
  sourceVersion: RegulatorySourceVersionRecord;
  interpretations: Array<{
    id: string;
    heading: string | null;
    summary: string | null;
    editorialStatus: string;
  }>;
  textBoundary: 'OFFICIAL_TEXT_SEPARATE_FROM_PLATFORM_INTERPRETATION';
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
  const unauthorized = error instanceof ApiClientError && error.status === 401;
  const denied = error instanceof ApiClientError && error.status === 403;
  return (
    <ApplicabilityStatePanel
      kind="error"
      title={
        unauthorized
          ? 'Lectura no autorizada'
          : denied
            ? 'Catálogo no disponible para esta organización'
            : 'No pudimos cargar las fuentes'
      }
      description={
        unauthorized
          ? 'La sesión actual no permite consultar el catálogo.'
          : denied
            ? 'La API no autorizó esta lectura con la sesión y organización activas. Verifica tu acceso o selecciona otra organización.'
            : 'La consulta falló. No se mostrará un estado vacío ni información conservada de otra organización.'
      }
      action={
        unauthorized || denied ? undefined : (
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
          eyebrow="Configuración SST · fuente oficial"
          title="Biblioteca normativa"
          description="Consulta documentos oficiales versionados y abre el artículo exacto, sin confundir texto legal con interpretación de la plataforma."
          action={
            <div className="regulatory-header-actions">
              <Link className="button secondary" href="/app/applicability/requirements">
                Requisitos estructurados
              </Link>
              <Link className="button secondary" href="/app/applicability">
                Volver a Configuración SST
              </Link>
            </div>
          }
        />
        <CatalogBoundaryNotice />

        <section className="regulatory-filters" aria-labelledby="regulatory-filter-title">
          <div>
            <h2 id="regulatory-filter-title">Filtrar fuentes</h2>
            <p>Los filtros consultan únicamente metadata editorial.</p>
          </div>
          <label>
            Buscar
            <input
              type="search"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Documento, número o emisor"
            />
          </label>
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
                      <dt>Vigencia</dt>
                      <dd>{regulatoryVigenciaReviewStatusLabels[source.vigenciaReviewStatus]}</dd>
                    </div>
                  </dl>
                  <div className="regulatory-source-card__footer">
                    <Readiness readyForRules={source.readyForRules} />
                    <Link
                      href={`/app/applicability/sources/${encodeURIComponent(source.sourceKey)}`}
                    >
                      Abrir documento
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
  const [articleSearch, setArticleSearch] = useState('');
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
  const structuredContent = useQuery({
    queryKey: queryKeys.organization.regulatorySourceProvisions(organizationId, sourceKey),
    queryFn: ({ signal }) =>
      api.request<RegulatorySourceProvision[]>(`/regulatory-sources/${encodedKey}/provisions`, {
        signal,
      }),
    enabled,
    retry: shouldRetryGet,
  });
  const articleQuery = articleSearch.trim()
    ? `?q=${encodeURIComponent(articleSearch.trim())}&unitType=ARTICLE`
    : '?unitType=ARTICLE';
  const units = useQuery({
    queryKey: queryKeys.organization.regulatorySourceUnits(organizationId, sourceKey, articleQuery),
    queryFn: ({ signal }) =>
      api.request<RegulatoryUnitListResponse>(
        `/regulatory-sources/${encodedKey}/units${articleQuery}`,
        { signal },
      ),
    enabled,
    retry: shouldRetryGet,
  });
  const firstError =
    detail.error ?? versions.error ?? relationships.error ?? structuredContent.error ?? units.error;
  const structuredRows = structuredContent.data ?? [];
  const relatedRequirements = Array.from(
    new Map(
      structuredRows.flatMap((row) =>
        row.requirements.map(
          ({ requirement }) => [requirement.requirementKey, requirement] as const,
        ),
      ),
    ).values(),
  );

  return (
    <RegulatoryAccessGate api={api}>
      <div className="regulatory-source-page stack">
        {detail.isLoading ||
        versions.isLoading ||
        relationships.isLoading ||
        structuredContent.isLoading ||
        units.isLoading ? (
          <ApplicabilitySkeleton label="Cargando metadata de la fuente" />
        ) : firstError ? (
          <RegulatoryQueryError
            error={firstError}
            retry={() => {
              void detail.refetch();
              void versions.refetch();
              void relationships.refetch();
              void structuredContent.refetch();
              void units.refetch();
            }}
          />
        ) : detail.data &&
          versions.data &&
          relationships.data &&
          structuredContent.data &&
          units.data ? (
          <>
            <ApplicabilityPageHeader
              eyebrow="Biblioteca normativa"
              title={detail.data.source.canonicalTitle}
              description={`${detail.data.source.issuer} · ${detail.data.source.referenceNumber}`}
              action={
                <Link className="button secondary" href="/app/applicability/sources">
                  Volver al catálogo
                </Link>
              }
            />
            <CatalogBoundaryNotice />
            <section className="regulatory-source-identity" aria-labelledby="article-catalog-title">
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Texto oficial estructurado</p>
                  <h2 id="article-catalog-title">Contenido y artículos</h2>
                </div>
                <span>{units.data.items.length} artículos</span>
              </div>
              <label className="technical-field">
                Buscar en artículos
                <input
                  type="search"
                  value={articleSearch}
                  onChange={(event) => setArticleSearch(event.target.value)}
                  placeholder="Artículo, encabezado o texto"
                />
              </label>
              {units.data.version === null ? (
                <div className="regulatory-empty-state">
                  <strong>El texto completo todavía no está estructurado.</strong>
                  <p>
                    La metadata de la fuente permanece visible; no se presenta texto reconstruido.
                  </p>
                </div>
              ) : units.data.items.length === 0 ? (
                <div className="regulatory-empty-state">
                  <strong>No hay coincidencias.</strong>
                  <p>Prueba otro identificador o término del texto oficial.</p>
                </div>
              ) : (
                <ol className="regulatory-content-list">
                  {units.data.items.map((unit) => (
                    <li key={unit.id} className="regulatory-content-card">
                      <span className="regulatory-status">{unit.identifier}</span>
                      <h3>{unit.heading ?? unit.locator}</h3>
                      <p>
                        {unit.officialText.slice(0, 220)}
                        {unit.officialText.length > 220 ? '…' : ''}
                      </p>
                      <Link
                        href={`/app/applicability/sources/${encodeURIComponent(sourceKey)}/units/${unit.id}`}
                      >
                        Abrir texto oficial
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
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
                  <dt>Vigencia</dt>
                  <dd>
                    {
                      regulatoryVigenciaReviewStatusLabels[
                        detail.data.latestVersion.vigenciaReviewStatus
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

            <section className="regulatory-structured-content" aria-labelledby="structured-title">
              <div className="applicability-section-heading">
                <div>
                  <p className="applicability-kicker">Procedencia antes que inferencia</p>
                  <h2 id="structured-title">Contenido estructurado</h2>
                </div>
              </div>
              <div className="regulatory-structured-grid">
                <section aria-labelledby="provisions-title">
                  <div className="regulatory-subsection-heading">
                    <h3 id="provisions-title">Disposiciones</h3>
                    <span>{structuredRows.length}</span>
                  </div>
                  {structuredRows.length === 0 ? (
                    <div className="regulatory-empty-state">
                      <strong>No hay contenido estructurado todavía.</strong>
                      <p>{REGULATORY_CONTENT_EMPTY_COPY}</p>
                    </div>
                  ) : (
                    <div className="regulatory-content-list">
                      {structuredRows.map(({ provision, sourceVersion }) => (
                        <article key={provision.id} className="regulatory-content-card">
                          <span className="regulatory-status">
                            {regulatoryProvisionLocatorTypeLabels[provision.locatorType]}
                          </span>
                          <h4>{provision.heading ?? provision.locatorLabel}</h4>
                          <p>{provision.locatorLabel}</p>
                          {provision.summary ? <p>{provision.summary}</p> : null}
                          <small>
                            Versión de catálogo {sourceVersion.catalogVersion} ·{' '}
                            {regulatoryProvisionStatusLabels[provision.editorialStatus]}
                          </small>
                          {provision.supersedesProvisionId ? (
                            <small>{REGULATORY_EDITORIAL_REPLACEMENT_COPY}</small>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section aria-labelledby="related-requirements-title">
                  <div className="regulatory-subsection-heading">
                    <h3 id="related-requirements-title">Requisitos relacionados</h3>
                    <span>{relatedRequirements.length}</span>
                  </div>
                  {relatedRequirements.length === 0 ? (
                    <div className="regulatory-empty-state">
                      <strong>No hay requisitos estructurados todavía.</strong>
                      <p>{REGULATORY_CONTENT_EMPTY_COPY}</p>
                    </div>
                  ) : (
                    <div className="regulatory-content-list">
                      {relatedRequirements.map((requirement) => (
                        <article
                          key={requirement.requirementKey}
                          className="regulatory-content-card"
                        >
                          <span className="regulatory-status">
                            {regulatoryRequirementStatusLabels[requirement.editorialStatus]}
                          </span>
                          <h4>{requirement.title}</h4>
                          <p>{requirement.description}</p>
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
                    </div>
                  )}
                </section>
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
                        {regulatoryRelationshipLabel(
                          relationship.relationshipType,
                          relationship.reviewStatus,
                        )}
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

export function RegulatoryUnitDetailView({
  sourceKey,
  unitId,
}: {
  sourceKey: string;
  unitId: string;
}) {
  const api = useRegulatorySourceApi();
  const organizationId = api.organizationId ?? 'no-organization';
  const detail = useQuery({
    queryKey: queryKeys.organization.regulatoryUnit(organizationId, unitId),
    queryFn: ({ signal }) =>
      api.request<RegulatoryUnitDetailResponse>(`/regulatory-units/${encodeURIComponent(unitId)}`, {
        signal,
      }),
    enabled: Boolean(api.organizationId),
    retry: shouldRetryGet,
  });
  return (
    <RegulatoryAccessGate api={api}>
      {detail.isLoading ? (
        <ApplicabilitySkeleton label="Cargando artículo oficial" />
      ) : detail.isError ? (
        <RegulatoryQueryError error={detail.error} retry={() => void detail.refetch()} />
      ) : detail.data ? (
        <div className="regulatory-source-page stack">
          <ApplicabilityPageHeader
            eyebrow={`${detail.data.source.referenceNumber} · texto oficial`}
            title={detail.data.unit.identifier}
            description={detail.data.unit.heading ?? detail.data.unit.locator}
            action={
              <Link
                className="button secondary"
                href={`/app/applicability/sources/${encodeURIComponent(sourceKey)}`}
              >
                Volver al documento
              </Link>
            }
          />
          <section className="regulatory-source-identity" aria-labelledby="official-text-title">
            <div className="applicability-section-heading">
              <div>
                <p className="applicability-kicker">Documento oficial verificado</p>
                <h2 id="official-text-title">Texto oficial</h2>
              </div>
              <span>
                {detail.data.sourceVersion.artifactVerificationStatus ===
                'OFFICIAL_ARTIFACT_VERIFIED'
                  ? 'Artefacto verificado'
                  : 'Verificación pendiente'}
              </span>
            </div>
            <p className="regulatory-official-text">{detail.data.unit.officialText}</p>
            <dl>
              <div>
                <dt>Fuente</dt>
                <dd>{detail.data.source.canonicalTitle}</dd>
              </div>
              <div>
                <dt>Versión</dt>
                <dd>Catálogo {detail.data.sourceVersion.catalogVersion}</dd>
              </div>
              <div>
                <dt>Página / localizador</dt>
                <dd>
                  {detail.data.unit.pageStart
                    ? `p. ${detail.data.unit.pageStart}${detail.data.unit.pageEnd !== detail.data.unit.pageStart ? `–${detail.data.unit.pageEnd}` : ''}`
                    : detail.data.unit.locator}
                </dd>
              </div>
              <div>
                <dt>Vigencia revisada</dt>
                <dd>{detail.data.sourceVersion.vigenciaReviewStatus}</dd>
              </div>
            </dl>
            {detail.data.sourceVersion.officialUrl ? (
              <a
                className="button secondary"
                href={detail.data.sourceVersion.officialUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir documento oficial
              </a>
            ) : null}
          </section>
          <section
            className="regulatory-structured-content"
            aria-labelledby="platform-interpretation-title"
          >
            <div className="applicability-section-heading">
              <div>
                <p className="applicability-kicker">Separada del texto oficial</p>
                <h2 id="platform-interpretation-title">Interpretación en la plataforma</h2>
              </div>
            </div>
            {detail.data.interpretations.length === 0 ? (
              <p>Sin estructurar.</p>
            ) : (
              detail.data.interpretations.map((interpretation) => (
                <article className="regulatory-content-card" key={interpretation.id}>
                  <span className="regulatory-status">{interpretation.editorialStatus}</span>
                  <h3>{interpretation.heading ?? 'Interpretación candidata'}</h3>
                  <p>{interpretation.summary ?? 'Revisión profesional pendiente.'}</p>
                </article>
              ))
            )}
          </section>
        </div>
      ) : null}
    </RegulatoryAccessGate>
  );
}
