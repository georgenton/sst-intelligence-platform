'use client';

import type { InspectionDomainKey } from '@sst/contracts';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { humanRoleLabel } from '@/lib/human-lexicon';
import {
  INSPECTION_DOMAINS,
  INSPECTION_DOMAIN_LABELS,
  INSPECTION_STANDARD_RIGHTS_LABELS,
  type InspectionStandardRightsType,
} from '@/lib/inspection-standard-presentation';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextLine,
  EntitlementState,
  InlineRequestState,
  InspectionPageHeader,
  InspectionSkeleton,
  InspectionState,
  PermissionState,
} from './inspection-experience-ui';
import { useDashboardData } from './use-app-data';

type StandardCriterion = {
  id: string;
  code: string;
  title: string;
  guidance: string;
  evidenceExpectation?: string | null;
  required: boolean;
  notApplicableAllowed: boolean;
};

type StandardSection = {
  id: string;
  code: string;
  title: string;
  criteria: StandardCriterion[];
};

export type InspectionStandardCatalogItem = {
  id: string;
  versionCode: string;
  editionLabel: string;
  status: 'AVAILABLE' | 'RETIRED';
  inspectionDomain: InspectionDomainKey | null;
  responsibilityNotice?: string | null;
  source: {
    id: string;
    organizationId?: string | null;
    code: string;
    name: string;
    publisher: string;
    originCountry?: string | null;
    referenceUrl?: string | null;
    rightsType: InspectionStandardRightsType;
    sourceType: 'GLOBAL_REFERENCE' | 'ORGANIZATION_AUTHORED';
    status: 'ACTIVE' | 'RETIRED';
  };
  sections: StandardSection[];
};

type PolicyBinding = {
  inspectionDomain: InspectionDomainKey;
  standardVersion: InspectionStandardCatalogItem;
};

export type InspectionStandardPolicy = {
  current: null | {
    id: string;
    version: number;
    reason?: string | null;
    createdAt: string;
    createdBy: { displayName: string };
    bindings: PolicyBinding[];
  };
  history: Array<{
    id: string;
    version: number;
    reason?: string | null;
    createdAt: string;
    createdBy: { displayName: string };
    bindings: PolicyBinding[];
  }>;
};

const POLICY_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

function sourceTypeLabel(value: InspectionStandardCatalogItem['source']['sourceType']) {
  return value === 'ORGANIZATION_AUTHORED'
    ? 'Estándar de la organización'
    : 'Catálogo de referencia';
}

function standardLabel(item: InspectionStandardCatalogItem) {
  return `${item.source.name} · ${item.editionLabel}`;
}

function StandardDetails({ standard }: { standard: InspectionStandardCatalogItem }) {
  return (
    <details className="inspection-standard-details">
      <summary>Ver detalles y criterios</summary>
      <div className="inspection-standard-details__body">
        <dl>
          <div>
            <dt>Editor o fuente</dt>
            <dd>{standard.source.publisher}</dd>
          </div>
          <div>
            <dt>Origen</dt>
            <dd>{sourceTypeLabel(standard.source.sourceType)}</dd>
          </div>
          <div>
            <dt>Derechos</dt>
            <dd>{INSPECTION_STANDARD_RIGHTS_LABELS[standard.source.rightsType]}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{standard.status === 'AVAILABLE' ? 'Disponible' : 'Retirado'}</dd>
          </div>
        </dl>
        {standard.responsibilityNotice ? (
          <p className="inspection-invariant-note">{standard.responsibilityNotice}</p>
        ) : null}
        {standard.sections.map((section) => (
          <section key={section.id}>
            <h4>{section.title}</h4>
            <ol>
              {section.criteria.map((criterion) => (
                <li key={criterion.id}>
                  <strong>{criterion.title}</strong>
                  <p>{criterion.guidance}</p>
                  {criterion.evidenceExpectation ? (
                    <small>Evidencia esperada: {criterion.evidenceExpectation}</small>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </details>
  );
}

export function InspectionStandardsSettings() {
  const auth = useAuth();
  const organization = useOrganization();
  const dashboard = useDashboardData();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const activeOrganization = organization.organizations.find(({ id }) => id === organizationId);
  const role = activeOrganization?.memberships[0]?.role;
  const moduleEnabled = dashboard.data?.entitlements.features['module.inspections'] === true;
  const canManage = Boolean(role && POLICY_ROLES.has(role));
  const [selections, setSelections] = useState<Partial<Record<InspectionDomainKey, string>>>({});
  const [reason, setReason] = useState('');
  const [loadedPolicyKey, setLoadedPolicyKey] = useState<string | undefined>(undefined);

  const catalog = useQuery({
    queryKey: queryKeys.organization.inspectionStandardCatalog(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<InspectionStandardCatalogItem[]>(
        '/inspection-standards/catalog',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && moduleEnabled),
  });
  const policy = useQuery({
    queryKey: queryKeys.organization.inspectionStandardPolicy(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<InspectionStandardPolicy>(
        '/inspection-standards/organization/policy',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && moduleEnabled),
  });

  useEffect(() => {
    const currentId = policy.data?.current?.id ?? null;
    const currentKey = organizationId ? `${organizationId}:${currentId ?? 'none'}` : undefined;
    if (!policy.data || !currentKey || loadedPolicyKey === currentKey) return;
    setSelections(
      Object.fromEntries(
        policy.data.current?.bindings.map((binding) => [
          binding.inspectionDomain,
          binding.standardVersion.id,
        ]) ?? [],
      ),
    );
    setLoadedPolicyKey(currentKey);
  }, [loadedPolicyKey, organizationId, policy.data]);

  const save = useMutation({
    mutationFn: () => {
      const bindings = INSPECTION_DOMAINS.flatMap((inspectionDomain) => {
        const standardVersionId = selections[inspectionDomain];
        return standardVersionId ? [{ inspectionDomain, standardVersionId }] : [];
      });
      return auth.request(
        '/inspection-standards/organization/policy',
        {
          method: 'PUT',
          body: JSON.stringify({ bindings, reason: reason.trim() || undefined }),
        },
        organizationId!,
      );
    },
    onSuccess: async () => {
      setReason('');
      setLoadedPolicyKey(undefined);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionStandardPolicy(organizationId!),
      });
    },
  });

  if (organization.loading || dashboard.isLoading)
    return <InspectionSkeleton label="Cargando configuración de estándares" />;
  if (!organizationId)
    return (
      <InspectionState
        kind="info"
        title="Selecciona una organización"
        description="La política de estándares pertenece a la organización activa."
      />
    );
  if (!moduleEnabled) return <EntitlementState planName={dashboard.data?.entitlements.plan.name} />;

  return (
    <div className="inspection-workspace stack">
      <InspectionPageHeader
        eyebrow="Configuración SST"
        title="Estándares de inspección"
        description="Define una base técnica consistente para cada dominio. Las inspecciones nuevas usarán automáticamente la versión configurada."
        context={<ContextLine>{activeOrganization?.name ?? 'Organización activa'}</ContextLine>}
      />
      <div className="inspection-demo-notice" role="note">
        <span aria-hidden="true">i</span>
        <div>
          <strong>Base técnica, metodología y regulación son conceptos distintos</strong>
          <p>
            Un estándar define qué se verifica. La metodología valora después el riesgo de un
            hallazgo y una referencia normativa se presenta por separado cuando existe.
          </p>
        </div>
      </div>
      {!canManage ? (
        <PermissionState
          role={role}
          capability="cambiar la política de estándares"
          authorizedRoles="Propietario, Administrador o Responsable SST"
        />
      ) : null}
      {catalog.isLoading || policy.isLoading ? (
        <InspectionSkeleton label="Cargando catálogo y política" />
      ) : catalog.isError || policy.isError ? (
        <InspectionState
          kind="error"
          title="No pudimos cargar la configuración"
          description="No se modificó la política. Revisa la conexión y vuelve a intentarlo."
          action={
            <button
              className="button secondary"
              type="button"
              onClick={() => void Promise.all([catalog.refetch(), policy.refetch()])}
            >
              Reintentar
            </button>
          }
        />
      ) : (
        <>
          <div className="inspection-standard-grid">
            {INSPECTION_DOMAINS.map((domain) => {
              const options =
                catalog.data?.filter(
                  (standard) =>
                    standard.inspectionDomain === domain && standard.status === 'AVAILABLE',
                ) ?? [];
              const selected = catalog.data?.find(({ id }) => id === selections[domain]);
              return (
                <Card className="inspection-standard-domain-card" key={domain}>
                  <p className="eyebrow">Dominio de inspección</p>
                  <h2>{INSPECTION_DOMAIN_LABELS[domain]}</h2>
                  <label className="field">
                    <span>Estándar vigente para inspecciones nuevas</span>
                    <select
                      value={selections[domain] ?? ''}
                      disabled={!canManage || save.isPending}
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [domain]: event.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">Sin configurar</option>
                      {options.map((standard) => (
                        <option key={standard.id} value={standard.id}>
                          {standardLabel(standard)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected ? (
                    <>
                      <dl className="inspection-standard-summary">
                        <div>
                          <dt>Versión</dt>
                          <dd>{selected.versionCode}</dd>
                        </div>
                        <div>
                          <dt>Origen</dt>
                          <dd>{sourceTypeLabel(selected.source.sourceType)}</dd>
                        </div>
                        <div>
                          <dt>Derechos</dt>
                          <dd>{INSPECTION_STANDARD_RIGHTS_LABELS[selected.source.rightsType]}</dd>
                        </div>
                      </dl>
                      <StandardDetails standard={selected} />
                    </>
                  ) : (
                    <p className="inspection-standard-empty">
                      Las inspecciones nuevas de este dominio quedarán bloqueadas hasta configurar
                      su base técnica.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
          {canManage ? (
            <Card className="inspection-form-card">
              <div className="inspection-form">
                <label className="field" htmlFor="standard-policy-reason">
                  <span>Motivo del cambio (opcional)</span>
                  <textarea
                    id="standard-policy-reason"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Ej. actualización de la base técnica aprobada internamente"
                  />
                </label>
                {save.isError ? (
                  <InlineRequestState>
                    No pudimos guardar la nueva versión de política. La selección permanece visible.
                  </InlineRequestState>
                ) : null}
                {save.isSuccess ? (
                  <p className="inspection-success" role="status">
                    Nueva versión de política guardada.
                  </p>
                ) : null}
                <div className="inspection-sticky-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={save.isPending || !Object.values(selections).some(Boolean)}
                    onClick={() => save.mutate()}
                  >
                    {save.isPending ? 'Guardando versión…' : 'Guardar nueva versión'}
                  </button>
                </div>
              </div>
            </Card>
          ) : null}
          <Card className="inspection-policy-history">
            <details>
              <summary>Ver historial de políticas ({policy.data?.history.length ?? 0})</summary>
              <ol>
                {policy.data?.history.map((version) => (
                  <li key={version.id}>
                    <strong>Versión {version.version}</strong>
                    <span>
                      {new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(
                        new Date(version.createdAt),
                      )}{' '}
                      · {version.createdBy.displayName}
                    </span>
                    {version.reason ? <p>{version.reason}</p> : null}
                    <ul>
                      {version.bindings.map((binding) => (
                        <li key={binding.inspectionDomain}>
                          {INSPECTION_DOMAIN_LABELS[binding.inspectionDomain]}:{' '}
                          {standardLabel(binding.standardVersion)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </details>
          </Card>
          <p className="inspection-invariant-note">
            Los estándares de demostración son contenido sintético. La autoría de estándares
            internos está disponible mediante la API acotada; su editor visual queda diferido para
            una revisión posterior de alcance y derechos.
          </p>
          <Link href="/app/inspections" className="button secondary">
            Volver a inspecciones
          </Link>
          {role ? <small>Tu rol actual: {humanRoleLabel(role)}</small> : null}
        </>
      )}
    </div>
  );
}
