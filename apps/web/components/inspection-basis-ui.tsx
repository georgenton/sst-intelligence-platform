'use client';

import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import {
  INSPECTION_DOMAINS,
  INSPECTION_DOMAIN_LABELS,
} from '@/lib/inspection-standard-presentation';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import type { InspectionStandardCatalogItem } from './inspection-standards-ui';
import {
  ContextSummary,
  WorkspaceHeader,
  WorkspaceMain,
  WorkspaceInspector,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type InspectionDomain = (typeof INSPECTION_DOMAINS)[number];
type RegulatoryUnit = {
  id: string;
  unitType: string;
  identifier: string;
  heading?: string | null;
  locator: string;
  reviewStatus: string;
  sourceVersion: {
    catalogVersion: number;
    officialUrl?: string | null;
    source: {
      sourceKey: string;
      countryCode: string;
      issuer: string;
      canonicalTitle: string;
    };
  };
};
type BasisTechnicalSource = {
  id: string;
  role: 'PRIMARY_TECHNICAL' | 'SUPPLEMENTAL_TECHNICAL' | 'INTERNAL_ORGANIZATION';
  displayOrder: number;
  standardVersion: InspectionStandardCatalogItem;
};
type BasisRegulatoryLink = {
  id: string;
  displayOrder: number;
  regulatoryUnit: RegulatoryUnit;
};
type BasisVersion = {
  id: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  reason?: string | null;
  contentDigest: string;
  createdAt: string;
  technicalSources: BasisTechnicalSource[];
  regulatoryUnits: BasisRegulatoryLink[];
};
type BasisDefinition = {
  id: string;
  name: string;
  inspectionDomain: InspectionDomain;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  versions: BasisVersion[];
};

const WRITE_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);
function sourceLabel(standard: InspectionStandardCatalogItem) {
  return `${standard.source.name} · ${standard.editionLabel}`;
}

export function InspectionBasisSettings() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState<InspectionDomain>('ELECTRICAL');
  const [primaryId, setPrimaryId] = useState('');
  const [supplementalIds, setSupplementalIds] = useState<string[]>([]);
  const [internalIds, setInternalIds] = useState<string[]>([]);
  const [regulatorySearch, setRegulatorySearch] = useState('');
  const [regulatoryIds, setRegulatoryIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const catalog = useQuery({
    queryKey: queryKeys.organization.inspectionStandardCatalog(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<InspectionStandardCatalogItem[]>(
        '/inspection-standards/catalog',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const bases = useQuery({
    queryKey: queryKeys.organization.inspectionBases(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<BasisDefinition[]>('/inspection-bases', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const units = useQuery({
    queryKey: queryKeys.organization.inspectionBasisRegulatoryUnits(
      organizationId ?? 'inactive',
      regulatorySearch,
    ),
    queryFn: ({ signal }) =>
      auth.request<RegulatoryUnit[]>(
        `/inspection-bases/regulatory-units?q=${encodeURIComponent(regulatorySearch)}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && regulatorySearch.trim().length >= 2),
  });
  const domainStandards = useMemo(
    () => (catalog.data ?? []).filter((item) => item.inspectionDomain === domain),
    [catalog.data, domain],
  );
  const internalStandards = domainStandards.filter(
    ({ source }) => source.sourceType === 'ORGANIZATION_AUTHORED',
  );
  const globalStandards = domainStandards.filter(
    ({ source }) => source.sourceType === 'GLOBAL_REFERENCE',
  );

  const save = useMutation({
    mutationFn: async () => {
      const technicalSources = [
        { standardVersionId: primaryId, role: 'PRIMARY_TECHNICAL', displayOrder: 1 },
        ...supplementalIds.map((standardVersionId, index) => ({
          standardVersionId,
          role: 'SUPPLEMENTAL_TECHNICAL',
          displayOrder: index + 2,
        })),
        ...internalIds.map((standardVersionId, index) => ({
          standardVersionId,
          role: 'INTERNAL_ORGANIZATION',
          displayOrder: supplementalIds.length + index + 2,
        })),
      ];
      const draft = await auth.request<BasisVersion>(
        '/inspection-bases',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            inspectionDomain: domain,
            reason: reason.trim() || undefined,
            technicalSources,
            regulatoryUnits: regulatoryIds.map((regulatoryUnitId, index) => ({
              regulatoryUnitId,
              displayOrder: index + 1,
            })),
          }),
        },
        organizationId!,
      );
      return auth.request<BasisVersion>(
        `/inspection-bases/versions/${draft.id}/activate`,
        { method: 'POST' },
        organizationId!,
      );
    },
    onSuccess: async () => {
      setName('');
      setPrimaryId('');
      setSupplementalIds([]);
      setInternalIds([]);
      setRegulatoryIds([]);
      setReason('');
      setNotice('Base de inspección activada; las versiones históricas permanecen inmutables.');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionBases(organizationId!),
      });
    },
  });

  function toggle(id: string, values: string[], update: (next: string[]) => void) {
    update(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  }

  return (
    <WorkspaceShell className="inspection-workspace">
      <WorkspaceHeader
        eyebrow="Configuración SST"
        title="Bases de inspección"
        description="Compón fuentes técnicas, contexto normativo y referencias internas sin convertirlas en una nueva ley."
      />
      <ContextSummary>
        <span>{bases.data?.length ?? 0} bases versionadas</span>
        <span>Una base activa por dominio</span>
        <span>Composición explícita y versionada</span>
      </ContextSummary>
      {notice ? <p role="status">{notice}</p> : null}
      {save.isError ? <p role="alert">No pudimos guardar la base. Revisa la composición.</p> : null}
      <div className="workspace-two-pane">
        <WorkspaceMain>
          <WorkspaceSection eyebrow="Configuración actual" title="Bases por dominio">
            <div className="worker-list">
              {INSPECTION_DOMAINS.map((inspectionDomain) => {
                const definitions = (bases.data ?? []).filter(
                  (item) => item.inspectionDomain === inspectionDomain,
                );
                const active = definitions
                  .flatMap(({ versions }) => versions)
                  .find(({ status }) => status === 'ACTIVE');
                return (
                  <Card key={inspectionDomain}>
                    <p className="eyebrow">{INSPECTION_DOMAIN_LABELS[inspectionDomain]}</p>
                    {active ? (
                      <>
                        <h2>
                          {
                            definitions.find(({ versions }) =>
                              versions.some(({ id }) => id === active.id),
                            )?.name
                          }
                        </h2>
                        <p>Versión {active.version} · Activa</p>
                        <p>
                          Base técnica principal:{' '}
                          {sourceLabel(
                            active.technicalSources.find(
                              ({ role }) => role === 'PRIMARY_TECHNICAL',
                            )!.standardVersion,
                          )}
                        </p>
                        <small>
                          {active.technicalSources.length - 1} fuentes complementarias/internas ·{' '}
                          {active.regulatoryUnits.length} unidades de fundamento normativo
                        </small>
                      </>
                    ) : (
                      <p>
                        No existe una Base de inspección activa. La configuración técnica anterior
                        continúa vigente.
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </WorkspaceSection>
        </WorkspaceMain>
        <WorkspaceInspector label="Crear y activar base">
          {!canWrite ? (
            <p>Tu rol puede consultar las bases, pero no crear versiones.</p>
          ) : (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <label className="field">
                <span>Nombre de la base</span>
                <input
                  required
                  minLength={3}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Dominio</span>
                <select
                  value={domain}
                  onChange={(event) => {
                    setDomain(event.target.value as InspectionDomain);
                    setPrimaryId('');
                    setSupplementalIds([]);
                    setInternalIds([]);
                  }}
                >
                  {INSPECTION_DOMAINS.map((value) => (
                    <option key={value} value={value}>
                      {INSPECTION_DOMAIN_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Base técnica principal</span>
                <select required value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}>
                  <option value="">Selecciona una versión exacta</option>
                  {domainStandards.map((standard) => (
                    <option key={standard.id} value={standard.id}>
                      {sourceLabel(standard)} ·{' '}
                      {standard.source.originCountry ?? 'Sin jurisdicción'}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>Fuentes técnicas suplementarias</legend>
                {globalStandards
                  .filter(({ id }) => id !== primaryId)
                  .map((standard) => (
                    <label key={standard.id}>
                      <input
                        type="checkbox"
                        checked={supplementalIds.includes(standard.id)}
                        onChange={() => toggle(standard.id, supplementalIds, setSupplementalIds)}
                      />{' '}
                      {sourceLabel(standard)} ·{' '}
                      {standard.source.originCountry ?? 'Sin jurisdicción'}
                    </label>
                  ))}
              </fieldset>
              <fieldset>
                <legend>Fuentes internas</legend>
                {internalStandards.length ? (
                  internalStandards
                    .filter(({ id }) => id !== primaryId)
                    .map((standard) => (
                      <label key={standard.id}>
                        <input
                          type="checkbox"
                          checked={internalIds.includes(standard.id)}
                          onChange={() => toggle(standard.id, internalIds, setInternalIds)}
                        />{' '}
                        {sourceLabel(standard)}
                      </label>
                    ))
                ) : (
                  <p>No hay fuentes internas para este dominio.</p>
                )}
              </fieldset>
              <label className="field">
                <span>Buscar artículos o unidades regulatorias</span>
                <input
                  value={regulatorySearch}
                  onChange={(event) => setRegulatorySearch(event.target.value)}
                  placeholder="Ej. Art. 18"
                />
              </label>
              {units.data?.length ? (
                <fieldset>
                  <legend>Fundamento normativo</legend>
                  {units.data.map((unit) => (
                    <label key={unit.id}>
                      <input
                        type="checkbox"
                        checked={regulatoryIds.includes(unit.id)}
                        onChange={() => toggle(unit.id, regulatoryIds, setRegulatoryIds)}
                      />{' '}
                      {unit.sourceVersion.source.canonicalTitle} · {unit.identifier} ·{' '}
                      {unit.sourceVersion.source.countryCode}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <label className="field">
                <span>Razón de configuración</span>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <button className="button" disabled={!primaryId || save.isPending} type="submit">
                {save.isPending ? 'Activando…' : 'Crear y activar versión'}
              </button>
            </form>
          )}
          <section>
            <h3>Separación semántica</h3>
            <p>
              Base técnica, fundamento normativo y metodología de riesgo se muestran por separado.
              Una fuente extranjera conserva su jurisdicción y no se vuelve ley ecuatoriana.
            </p>
          </section>
        </WorkspaceInspector>
      </div>
    </WorkspaceShell>
  );
}
