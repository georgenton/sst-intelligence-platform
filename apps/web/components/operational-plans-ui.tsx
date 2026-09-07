'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useFieldArray, useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { humanPriorityLabel } from '@/lib/human-lexicon';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  InspectionPageHeader,
  InspectionSkeleton,
  InspectionState,
} from './inspection-experience-ui';

type PlanItem = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  frequency?: string;
  priority: string;
  provenanceType: string;
  provenanceReference?: string;
  workCenter?: { id: string; name: string };
  responsible?: { id: string; displayName: string };
  execution: { status: string; version: number };
};

type PlanVersion = {
  id: string;
  version: number;
  status: string;
  origin: string;
  name: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  contentDigest: string;
  responsible?: { id: string; displayName: string };
  items: PlanItem[];
};

type Plan = { id: string; versions: PlanVersion[] };
type PlanList = { items: Plan[]; total: number };
type Context = {
  workCenters: Array<{ id: string; name: string }>;
  members: Array<{ id: string; displayName: string; role: string }>;
};

type PlanForm = {
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  responsibleUserId: string;
  items: Array<{
    title: string;
    description: string;
    dueAt: string;
    frequency: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    workCenterId: string;
    responsibleUserId: string;
    evidenceReferencesText: string;
  }>;
};

function usePlanApi() {
  const auth = useAuth();
  const organization = useOrganization();
  return {
    organizationId: organization.activeId,
    role: organization.currentRole,
    request: <T,>(path: string, init?: RequestInit) =>
      auth.request<T>(path, init, organization.activeId ?? undefined),
  };
}

const writers = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER', 'SST_TECHNICIAN', 'CONSULTANT']);
const activators = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

function stateLabel(value: string) {
  return (
    {
      DRAFT: 'Borrador',
      ACTIVE: 'Activo',
      RETIRED: 'Histórico',
      PLANNED: 'Planificado',
      IN_PROGRESS: 'En curso',
      COMPLETED: 'Completado',
      CANCELED: 'Cancelado',
    }[value] ?? value
  );
}

export function OperationalPlans({ planId }: { planId?: string }) {
  const api = usePlanApi();
  const queryClient = useQueryClient();
  const plans = useQuery({
    queryKey: planId
      ? queryKeys.organization.operationalPlan(api.organizationId ?? 'inactive', planId)
      : queryKeys.organization.operationalPlans(api.organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<Plan | PlanList>(planId ? `/operational-plans/${planId}` : '/operational-plans', {
        signal,
      }),
    enabled: Boolean(api.organizationId),
  });
  const context = useQuery({
    queryKey: queryKeys.organization.inspectionContext(api.organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<Context>('/inspections/context', { signal }),
    enabled: Boolean(api.organizationId),
  });
  const form = useForm<PlanForm>({
    defaultValues: {
      name: '',
      description: '',
      periodStart: new Date().toISOString().slice(0, 10),
      periodEnd: `${new Date().getUTCFullYear()}-12-31`,
      responsibleUserId: '',
      items: [
        {
          title: '',
          description: '',
          dueAt: '',
          frequency: '',
          priority: 'MEDIUM',
          workCenterId: '',
          responsibleUserId: '',
          evidenceReferencesText: '',
        },
      ],
    },
  });
  const fields = useFieldArray({ control: form.control, name: 'items' });
  const create = useMutation({
    mutationFn: (values: PlanForm) =>
      api.request<Plan>('/operational-plans', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          responsibleUserId: values.responsibleUserId || undefined,
          items: values.items.map(({ evidenceReferencesText, ...item }) => ({
            ...item,
            dueAt: item.dueAt || undefined,
            frequency: item.frequency || undefined,
            workCenterId: item.workCenterId || undefined,
            responsibleUserId: item.responsibleUserId || undefined,
            evidenceReferences: evidenceReferencesText
              .split('\n')
              .map((value) => value.trim())
              .filter(Boolean),
            provenanceType: 'MANUAL',
          })),
        }),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(api.organizationId!),
      });
    },
  });
  const generate = useMutation({
    mutationFn: () => {
      const values = form.getValues();
      return api.request<Plan>('/operational-plans/generate-draft', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name || 'Plan operativo sugerido',
          description: values.description || undefined,
          periodStart: values.periodStart,
          periodEnd: values.periodEnd,
          responsibleUserId: values.responsibleUserId || undefined,
        }),
      });
    },
    onSuccess: async () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(api.organizationId!),
      }),
  });
  const activate = useMutation({
    mutationFn: ({ planId: id, versionId }: { planId: string; versionId: string }) =>
      api.request(`/operational-plans/${id}/versions/${versionId}/activate`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(api.organizationId!),
      });
    },
  });
  const transition = useMutation({
    mutationFn: ({
      itemId,
      status,
      expectedVersion,
    }: {
      itemId: string;
      status: string;
      expectedVersion: number;
    }) =>
      api.request(`/operational-plans/items/${itemId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, expectedVersion }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(api.organizationId!),
      });
    },
  });

  if (plans.isLoading || context.isLoading)
    return <InspectionSkeleton label="Cargando plan operativo" />;
  if (plans.isError || context.isError)
    return (
      <InspectionState
        kind="error"
        title="No pudimos cargar el plan"
        description="Actualiza la vista e inténtalo nuevamente."
      />
    );
  const list = planId ? [plans.data as Plan] : ((plans.data as PlanList | undefined)?.items ?? []);

  return (
    <div className="inspection-task-page stack">
      <InspectionPageHeader
        eyebrow="Plan Operativo Macro V0"
        title={planId ? 'Detalle del plan operativo' : 'Planifica el trabajo SST'}
        description="El plan organiza actividades versionadas. La Cola de trabajo muestra únicamente lo que requiere atención."
      />
      {!planId && writers.has(api.role ?? '') ? (
        <Card className="inspection-form-card">
          <form
            className="inspection-form"
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
          >
            <div className="inspection-form-intro">
              <p className="eyebrow">Dos caminos, un mismo borrador revisable</p>
              <h2>Ya tengo un plan</h2>
              <p>
                Transcribe su estructura sin perder responsable, fechas, frecuencia, prioridad ni
                procedencia.
              </p>
            </div>
            <div className="inspection-form-grid">
              <div className="field">
                <label htmlFor="plan-name">Nombre</label>
                <input
                  id="plan-name"
                  {...form.register('name', { required: true, minLength: 3 })}
                />
              </div>
              <div className="field">
                <label htmlFor="plan-owner">Responsable</label>
                <select id="plan-owner" {...form.register('responsibleUserId')}>
                  <option value="">Sin responsable general</option>
                  {context.data?.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="plan-start">Inicio del período</label>
                <input
                  id="plan-start"
                  type="date"
                  {...form.register('periodStart', { required: true })}
                />
              </div>
              <div className="field">
                <label htmlFor="plan-end">Fin del período</label>
                <input
                  id="plan-end"
                  type="date"
                  {...form.register('periodEnd', { required: true })}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="plan-description">Descripción</label>
              <textarea id="plan-description" {...form.register('description')} />
            </div>
            {fields.fields.map((field, index) => (
              <fieldset className="inspection-summary-card" key={field.id}>
                <legend>Actividad {index + 1}</legend>
                <div className="field">
                  <label htmlFor={`plan-item-${index}`}>Actividad</label>
                  <input
                    id={`plan-item-${index}`}
                    {...form.register(`items.${index}.title`, { required: true, minLength: 3 })}
                  />
                </div>
                <div className="inspection-form-grid">
                  <div className="field">
                    <label>Fecha límite</label>
                    <input type="date" {...form.register(`items.${index}.dueAt`)} />
                  </div>
                  <div className="field">
                    <label>Frecuencia</label>
                    <input
                      placeholder="Mensual, trimestral…"
                      {...form.register(`items.${index}.frequency`)}
                    />
                  </div>
                  <div className="field">
                    <label>Prioridad</label>
                    <select {...form.register(`items.${index}.priority`)}>
                      <option value="LOW">Baja</option>
                      <option value="MEDIUM">Media</option>
                      <option value="HIGH">Alta</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Centro de trabajo</label>
                    <select {...form.register(`items.${index}.workCenterId`)}>
                      <option value="">Toda la organización</option>
                      {context.data?.workCenters.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Responsable</label>
                    <select {...form.register(`items.${index}.responsibleUserId`)}>
                      <option value="">Sin asignar</option>
                      {context.data?.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Referencias de evidencia</label>
                  <textarea
                    placeholder="Una referencia por línea"
                    {...form.register(`items.${index}.evidenceReferencesText`)}
                  />
                </div>
                {fields.fields.length > 1 ? (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => fields.remove(index)}
                  >
                    Quitar actividad
                  </button>
                ) : null}
              </fieldset>
            ))}
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                fields.append({
                  title: '',
                  description: '',
                  dueAt: '',
                  frequency: '',
                  priority: 'MEDIUM',
                  workCenterId: '',
                  responsibleUserId: '',
                  evidenceReferencesText: '',
                })
              }
            >
              Agregar actividad
            </button>
            <div className="inspection-sticky-actions">
              <button className="button" disabled={create.isPending}>
                Ya tengo un plan
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={
                  generate.isPending || !form.watch('periodStart') || !form.watch('periodEnd')
                }
                onClick={() => generate.mutate()}
              >
                Ayúdame a crear uno
              </button>
            </div>
            {create.isError || generate.isError ? (
              <p role="alert">
                {(create.error ?? generate.error) instanceof ApiClientError
                  ? (create.error ?? (generate.error as ApiClientError)).message
                  : 'No pudimos crear el borrador.'}
              </p>
            ) : null}
          </form>
        </Card>
      ) : null}
      {list.length === 0 ? (
        <InspectionState
          kind="empty"
          title="Todavía no hay planes"
          description="Crea un borrador manual o genera uno desde señales operativas conocidas."
        />
      ) : (
        list.map((plan) => {
          const version = plan.versions[0];
          if (!version) return null;
          return (
            <Card key={plan.id} className="inspection-summary-card">
              <p className="eyebrow">
                {stateLabel(version.status)} · versión {version.version}
              </p>
              <h2>
                <Link href={`/app/plans/${plan.id}`}>{version.name}</Link>
              </h2>
              <p>{version.description ?? 'Sin descripción adicional.'}</p>
              <p>
                {new Date(version.periodStart).toLocaleDateString('es-EC')} –{' '}
                {new Date(version.periodEnd).toLocaleDateString('es-EC')}
              </p>
              {version.status === 'DRAFT' && activators.has(api.role ?? '') ? (
                <button
                  className="button"
                  type="button"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate({ planId: plan.id, versionId: version.id })}
                >
                  Activar plan
                </button>
              ) : null}
              {planId ? (
                <div className="stack-sm">
                  {version.items.map((item) => (
                    <article
                      id={`item-${item.id}`}
                      key={item.id}
                      className="inspection-summary-card"
                    >
                      <p className="eyebrow">
                        {humanPriorityLabel(item.priority)} · {stateLabel(item.execution.status)}
                      </p>
                      <h3>{item.title}</h3>
                      <p>{item.description ?? 'Sin descripción adicional.'}</p>
                      <small>
                        Procedencia: {item.provenanceType}
                        {item.provenanceReference ? ` · ${item.provenanceReference}` : ''}
                      </small>
                      {item.execution.status === 'PLANNED' ? (
                        <button
                          type="button"
                          className="button"
                          onClick={() =>
                            transition.mutate({
                              itemId: item.id,
                              status: 'IN_PROGRESS',
                              expectedVersion: item.execution.version,
                            })
                          }
                        >
                          Iniciar
                        </button>
                      ) : null}
                      {item.execution.status === 'IN_PROGRESS' ? (
                        <button
                          type="button"
                          className="button"
                          onClick={() =>
                            transition.mutate({
                              itemId: item.id,
                              status: 'COMPLETED',
                              expectedVersion: item.execution.version,
                            })
                          }
                        >
                          Completar
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
              {planId && plan.versions.length > 1 ? (
                <details>
                  <summary>Ver historial de versiones</summary>
                  <div className="stack-sm">
                    {plan.versions.slice(1).map((historical) => (
                      <article key={historical.id} className="inspection-summary-card">
                        <strong>
                          Versión {historical.version} · {stateLabel(historical.status)}
                        </strong>
                        <p>{historical.name}</p>
                        <small>
                          {historical.items.length} actividad(es) · digest{' '}
                          {historical.contentDigest}
                        </small>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}
