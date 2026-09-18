'use client';

import { ApiClientError } from '@sst/api-client';
import type { InspectionDomainKey } from '@sst/contracts';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import {
  INSPECTION_DOMAINS,
  INSPECTION_DOMAIN_LABELS,
} from '@/lib/inspection-standard-presentation';
import type {
  ContextData,
  Inspection,
  InspectionApi,
  RiskMethodCatalogItem,
} from './inspections-ui';
import {
  InlineRequestState,
  InspectionSkeleton,
  InspectionState,
} from './inspection-experience-ui';
import { TechnicalDetails } from './technical-details';
import { useRealRequestFeedback } from './use-real-request-feedback';

type Criterion = {
  id: string;
  title: string;
  guidance: string;
  code: string;
  notApplicableAllowed: boolean;
};
type Standard = {
  id: string;
  versionCode: string;
  editionLabel: string;
  contentDigest: string;
  source: { name: string; originCountry?: string | null; rightsType: string };
  criteria: Criterion[];
};
type Basis = {
  id: string;
  version: number;
  contentDigest: string;
  definition: { name: string };
  technicalSources: Array<{ role: string; standardVersion: Standard }>;
  regulatoryUnits: Array<{
    regulatoryUnit: {
      identifier: string;
      sourceVersion: { source: { canonicalTitle: string; countryCode: string } };
    };
  }>;
};
type Policy = {
  current: {
    bindings: Array<{ inspectionDomain: InspectionDomainKey; standardVersion: Standard }>;
  } | null;
};
type ResourceCatalog = {
  version: number;
  contentDigest: string;
  taxonomy: { name: string };
  resources: Array<{ id: string; name: string; level: string }>;
  mappingVersions: Array<{
    id: string;
    version: number;
    contentDigest: string;
    mappings: Array<{ resourceId: string; criterionId: string; displayOrder: number }>;
  }>;
};
type Form = {
  workCenterId: string;
  workAreaId: string;
  inspectionDomain: InspectionDomainKey | '';
  resourceId: string;
  title: string;
  description: string;
  scheduledFor: string;
  riskMethodVersionId: string;
  inspectionDepth: 'BASIC' | 'TECHNICAL' | 'SYSTEMIC';
};
const GENERAL = 'general';
const retry = (count: number, error: unknown) =>
  !(error instanceof ApiClientError && error.status < 500) && count < 2;

export function InspectionPreparation({ api }: { api: InspectionApi }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = api.organizationId!;
  const form = useForm<Form>({
    mode: 'onBlur',
    defaultValues: {
      workCenterId: '',
      workAreaId: '',
      inspectionDomain: '',
      resourceId: '',
      title: '',
      description: '',
      scheduledFor: '',
      riskMethodVersionId: '',
      inspectionDepth: 'BASIC',
    },
  });
  const values = form.watch();
  const context = useQuery({
    queryKey: queryKeys.organization.inspectionContext(organizationId),
    queryFn: ({ signal }) => api.request<ContextData>('/inspections/context', { signal }),
    retry,
  });
  const methods = useQuery({
    queryKey: queryKeys.organization.riskMethods(organizationId),
    queryFn: ({ signal }) => api.request<RiskMethodCatalogItem[]>('/risk-methods', { signal }),
    retry,
  });
  const policy = useQuery({
    queryKey: queryKeys.organization.inspectionStandardPolicy(organizationId),
    queryFn: ({ signal }) =>
      api.request<Policy>('/inspection-standards/organization/policy', { signal }),
    retry,
  });
  const bases = useQuery({
    queryKey: queryKeys.organization.inspectionBases(organizationId),
    queryFn: ({ signal }) =>
      api.request<
        Array<{ inspectionDomain: InspectionDomainKey; versions: Array<{ status: string }> }>
      >('/inspection-bases', { signal }),
    retry,
  });
  const basis = useQuery({
    queryKey: queryKeys.organization.inspectionBasisActive(
      organizationId,
      values.inspectionDomain || 'none',
    ),
    enabled: Boolean(values.inspectionDomain),
    queryFn: async ({ signal }) => {
      try {
        return await api.request<Basis>(`/inspection-bases/active/${values.inspectionDomain}`, {
          signal,
        });
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) return null;
        throw error;
      }
    },
    retry,
  });
  const binding = policy.data?.current?.bindings.find(
    ({ inspectionDomain }) => inspectionDomain === values.inspectionDomain,
  );
  const sources =
    basis.data?.technicalSources ??
    (binding ? [{ role: 'PRIMARY_TECHNICAL', standardVersion: binding.standardVersion }] : []);
  const primary = sources.find(({ role }) => role === 'PRIMARY_TECHNICAL')?.standardVersion;
  const resources = useQuery({
    queryKey: queryKeys.organization.inspectionResources(
      organizationId,
      values.inspectionDomain || 'none',
      primary?.id ?? 'none',
    ),
    enabled: Boolean(values.inspectionDomain && primary && !basis.isPending),
    queryFn: ({ signal }) =>
      api.request<ResourceCatalog | null>(
        `/inspection-resources?domain=${values.inspectionDomain}&standardVersionId=${primary!.id}`,
        { signal },
      ),
    retry,
  });
  const configured = INSPECTION_DOMAINS.filter(
    (domain) =>
      policy.data?.current?.bindings.some(({ inspectionDomain }) => inspectionDomain === domain) ||
      bases.data?.some(
        (item) =>
          item.inspectionDomain === domain &&
          item.versions.some(({ status }) => status === 'ACTIVE'),
      ),
  );
  const center = context.data?.workCenters.find(({ id }) => id === values.workCenterId);
  const multiSource = sources.length > 1;
  const mapping = resources.data?.mappingVersions[0];
  const allCriteria = sources.flatMap(({ standardVersion }) => standardVersion.criteria);
  const scopedIds =
    mapping?.mappings
      .filter(({ resourceId }) => resourceId === values.resourceId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(({ criterionId }) => criterionId) ?? [];
  const byId = new Map(allCriteria.map((criterion) => [criterion.id, criterion]));
  const preview =
    values.resourceId === GENERAL
      ? allCriteria
      : sources.length > 1
        ? []
        : scopedIds
            .map((id) => byId.get(id))
            .filter((criterion): criterion is Criterion => Boolean(criterion));
  const scopedAvailable = !multiSource && Boolean(mapping);
  const preparationPending = Boolean(
    values.inspectionDomain && (basis.isPending || (primary && resources.isPending)),
  );
  const preparationError = basis.isError || resources.isError;
  const create = useMutation({
    mutationFn: (input: Form) =>
      api.request<Inspection>('/inspections', {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          resourceId: input.resourceId === GENERAL ? undefined : input.resourceId,
          workAreaId: input.workAreaId || undefined,
          description: input.description || undefined,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor).toISOString() : undefined,
        }),
      }),
    onSuccess: async (inspection) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspections(organizationId),
      });
      router.push(`/app/inspections/${inspection.id}`);
    },
  });
  const pendingFeedback = useRealRequestFeedback(create.isPending);
  const ready = Boolean(
    center &&
    primary &&
    preview.length &&
    values.resourceId &&
    !preparationPending &&
    !preparationError &&
    (values.resourceId === GENERAL || scopedAvailable),
  );
  const initialQueries = [context, methods, policy, bases];
  if (initialQueries.some((query) => query.isPending))
    return <InspectionSkeleton label="Cargando configuración de inspección" />;
  if (initialQueries.some((query) => query.isError))
    return (
      <InspectionState
        kind="error"
        title="No pudimos cargar la configuración"
        description="Vuelve a intentar para consultar la configuración real de tu organización."
        action={
          <button
            className="button secondary"
            onClick={() => void Promise.all(initialQueries.map((query) => query.refetch()))}
          >
            Reintentar
          </button>
        }
      />
    );
  if (!context.data?.workCenters.length)
    return (
      <InspectionState
        kind="empty"
        title="No hay centros configurados"
        description="Configura un centro de trabajo antes de crear la inspección."
        action={
          <Link className="button secondary" href="/app/settings/organization">
            Ir a Organización
          </Link>
        }
      />
    );
  return (
    <form
      className="inspection-preparation"
      noValidate
      onSubmit={form.handleSubmit((input) => {
        if (ready && !create.isPending) create.mutate(input);
      })}
    >
      <Card className="inspection-form-card">
        <p className="eyebrow">1 · Dónde</p>
        <h2>Ubicación del recorrido</h2>
        <div className="inspection-form-grid">
          <div className="field">
            <label htmlFor="inspection-prep-center">Centro de trabajo</label>
            <select
              id="inspection-prep-center"
              {...form.register('workCenterId', { required: 'Selecciona un centro.' })}
              onChange={(event) => {
                form.setValue('workCenterId', event.target.value);
                form.setValue('workAreaId', '');
              }}
            >
              <option value="">Selecciona un centro</option>
              {context.data.workCenters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inspection-prep-area">Área (opcional)</label>
            <select id="inspection-prep-area" {...form.register('workAreaId')} disabled={!center}>
              <option value="">Sin área específica</option>
              {center?.workAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>
      {center ? (
        <Card className="inspection-form-card">
          <p className="eyebrow">2 · Qué vas a inspeccionar</p>
          <fieldset className="risk-method-selection">
            <legend>Dominio de inspección</legend>
            <div className="risk-method-card-grid">
              {configured.map((domain) => (
                <label className="risk-method-card" key={domain}>
                  <input
                    type="radio"
                    value={domain}
                    {...form.register('inspectionDomain', { required: true })}
                    onChange={() => {
                      form.setValue('inspectionDomain', domain);
                      form.setValue('resourceId', '');
                    }}
                  />
                  <span>
                    <strong>{INSPECTION_DOMAIN_LABELS[domain]}</strong>
                    <small>Configurado en tu organización</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {!configured.length ? (
            <p>
              No hay dominios configurados.{' '}
              <Link href="/app/settings/inspection-standards">Configurar una base técnica</Link>
            </p>
          ) : null}
        </Card>
      ) : null}
      {center && values.inspectionDomain ? (
        <Card className="inspection-form-card">
          <p className="eyebrow">3 · Recurso y alcance</p>
          <h2>Sobre qué harás el recorrido</h2>
          {preparationPending ? (
            <InspectionSkeleton label="Resolviendo base y alcance" />
          ) : preparationError ? (
            <InspectionState
              kind="error"
              title="No pudimos resolver el alcance"
              description="Tus selecciones se conservan."
              action={
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void Promise.all([basis.refetch(), resources.refetch()])}
                >
                  Reintentar
                </button>
              }
            />
          ) : (
            <>
              {multiSource ? (
                <div className="inspection-recurrence" role="note">
                  <strong>Esta base combina {sources.length} fuentes técnicas</strong>
                  <p>
                    El mapeo por recurso no demuestra cobertura de todas las fuentes. Puedes elegir
                    una inspección general sobre el centro, conservando sus {allCriteria.length}{' '}
                    criterios. No se recorta ninguna fuente.
                  </p>
                </div>
              ) : !resources.data || !mapping ? (
                <p>
                  Este dominio no tiene un mapeo activo por recurso. La inspección general conserva
                  todos los criterios de la base.
                </p>
              ) : null}
              <fieldset className="risk-method-selection">
                <legend>Recurso a inspeccionar</legend>
                <div className="risk-method-card-grid">
                  {resources.data?.resources.map((resource) => (
                    <label className="risk-method-card" key={resource.id}>
                      <input
                        type="radio"
                        value={resource.id}
                        {...form.register('resourceId', { required: true })}
                        disabled={
                          !scopedAvailable ||
                          !mapping?.mappings.some(({ resourceId }) => resourceId === resource.id)
                        }
                      />
                      <span>
                        <strong>{resource.name}</strong>
                        <small>
                          {resource.level === 'MINOR'
                            ? 'Recurso menor'
                            : resource.level === 'MAJOR'
                              ? 'Instalación mayor'
                              : 'Servicio industrial'}
                        </small>
                        {!scopedAvailable ? <small>No disponible con esta base</small> : null}
                      </span>
                    </label>
                  ))}
                  <label className="risk-method-card">
                    <input
                      type="radio"
                      value={GENERAL}
                      {...form.register('resourceId', { required: true })}
                    />
                    <span>
                      <strong>Inspección general sin recurso</strong>
                      <small>
                        Sobre {center.name} · conserva los {allCriteria.length} criterios de la base
                      </small>
                    </span>
                  </label>
                </div>
              </fieldset>
              <Link href="/app/settings/inspection-resources">Consultar alcance de recursos</Link>
            </>
          )}
        </Card>
      ) : null}
      {values.resourceId && !preparationPending && !preparationError ? (
        <Card className="inspection-form-card">
          <p className="eyebrow">4 · Base y criterios</p>
          <h2>{basis.data?.definition.name ?? primary?.source.name}</h2>
          {sources.map(({ role, standardVersion }) => (
            <div className="inspection-standard-basis" key={standardVersion.id}>
              <strong>
                {role === 'PRIMARY_TECHNICAL'
                  ? 'Fuente principal'
                  : role === 'SUPPLEMENTAL_TECHNICAL'
                    ? 'Referencia suplementaria'
                    : 'Fuente interna'}{' '}
                · {standardVersion.source.name}
              </strong>
              <p>
                {standardVersion.editionLabel} · Jurisdicción / origen:{' '}
                {standardVersion.source.originCountry ?? 'No indicado'}
              </p>
              {standardVersion.source.rightsType === 'DEMO_SYNTHETIC' ? (
                <span className="domain-status">
                  Demostración sintética · pendiente de validación profesional
                </span>
              ) : null}
              <TechnicalDetails summary="Ver versión de esta fuente">
                <p>Versión {standardVersion.versionCode}</p>
                <code>{standardVersion.contentDigest}</code>
              </TechnicalDetails>
            </div>
          ))}
          <p className="inspection-invariant-note">
            La base define qué se verifica. No equivale a una ley, una metodología de riesgo ni un
            protocolo. Crear congela la configuración vigente de este alcance.
          </p>
          {basis.data?.regulatoryUnits.length ? (
            <TechnicalDetails summary="Contexto regulatorio separado">
              {basis.data.regulatoryUnits.map(({ regulatoryUnit }, index) => (
                <p key={index}>
                  {regulatoryUnit.sourceVersion.source.canonicalTitle} · {regulatoryUnit.identifier}{' '}
                  · {regulatoryUnit.sourceVersion.source.countryCode}
                </p>
              ))}
            </TechnicalDetails>
          ) : null}
          <h3>{preview.length} criterios para este recorrido</h3>
          {preview.length ? (
            <ol className="inspection-criteria-preview">
              {preview.map((criterion) => (
                <li key={criterion.id}>
                  <strong>{criterion.title}</strong>
                  <small>
                    {
                      sources.find(({ standardVersion }) =>
                        standardVersion.criteria.some(({ id }) => id === criterion.id),
                      )?.standardVersion.source.name
                    }
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p role="alert">
              No hay criterios resueltos para este alcance. Revisa la configuración antes de crear.
            </p>
          )}
        </Card>
      ) : null}
      {preview.length ? (
        <Card className="inspection-form-card">
          <p className="eyebrow">5 · Preparar el trabajo</p>
          <label className="field">
            <span>Título</span>
            <input
              {...form.register('title', {
                required: 'Escribe un título.',
                minLength: { value: 3, message: 'Usa al menos 3 caracteres.' },
                maxLength: { value: 160, message: 'Usa como máximo 160 caracteres.' },
              })}
              maxLength={160}
              aria-invalid={Boolean(form.formState.errors.title)}
            />
            {form.formState.errors.title ? (
              <small className="field-error">{form.formState.errors.title.message}</small>
            ) : null}
          </label>
          <fieldset className="risk-method-selection">
            <legend>Profundidad de inspección</legend>
            <div className="risk-method-card-grid">
              {(
                [
                  ['BASIC', 'Básica', 'Verificación visible o de primera línea.'],
                  ['TECHNICAL', 'Técnica', 'Revisión especializada con mayor profundidad.'],
                  ['SYSTEMIC', 'Sistémica', 'Programas, recurrencia y controles transversales.'],
                ] as const
              ).map(([value, label, description]) => (
                <label className="risk-method-card" key={value}>
                  <input type="radio" value={value} {...form.register('inspectionDepth')} />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="risk-method-selection">
            <legend>Metodología de valoración</legend>
            <p>
              Se aplica al hallazgo y su riesgo residual; no cambia los criterios de inspección.
            </p>
            <div className="risk-method-card-grid">
              {methods.data?.map((method) => (
                <label className="risk-method-card" key={method.id}>
                  <input
                    type="radio"
                    value={method.id}
                    {...form.register('riskMethodVersionId', {
                      required: 'Selecciona una metodología de valoración.',
                    })}
                  />
                  <span>
                    <strong>{method.displayName}</strong>
                    <small>
                      Versión {method.semanticVersion} ·{' '}
                      {method.publicationStatus === 'PUBLISHED'
                        ? 'Histórica publicada'
                        : 'Candidata para revisión'}
                    </small>
                    <span>{method.purpose}</span>
                    <em>{method.disclaimer}</em>
                  </span>
                </label>
              ))}
            </div>
            {form.formState.errors.riskMethodVersionId ? (
              <small className="field-error">
                {form.formState.errors.riskMethodVersionId.message}
              </small>
            ) : null}
          </fieldset>
          <TechnicalDetails summary="Descripción y programación opcionales">
            <label className="field">
              <span>Descripción (opcional)</span>
              <textarea rows={3} maxLength={2000} {...form.register('description')} />
            </label>
            <label className="field">
              <span>Fecha programada (opcional)</span>
              <input type="datetime-local" {...form.register('scheduledFor')} />
            </label>
          </TechnicalDetails>
          <p className="inspection-invariant-note">Guardar el borrador no inicia la inspección.</p>
          {create.isError ? (
            <InlineRequestState>
              No pudimos crear la inspección. Tus datos permanecen aquí; revisa el estado actual y
              vuelve a intentar.
            </InlineRequestState>
          ) : null}
          <div className="inspection-sticky-actions">
            <Link className="button secondary" href="/app/inspections">
              Cancelar
            </Link>
            <button className="button" disabled={!ready || create.isPending}>
              {pendingFeedback ? 'Creando borrador…' : 'Crear inspección'}
            </button>
          </div>
        </Card>
      ) : null}
    </form>
  );
}
