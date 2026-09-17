'use client';

import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { useRef, useState } from 'react';
import { operationalPlanError, planItemSource } from '@/lib/operational-plan-handoff';
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
  startsAt?: string;
  dueAt?: string;
  evidenceReferences: string[];
  provenanceSnapshot: Record<string, unknown>;
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
  responsibleUserId?: string;
  provenance: Record<string, unknown>;
  responsible?: { id: string; displayName: string };
  items: PlanItem[];
};

type Plan = { id: string; versions: PlanVersion[] };
type PlanList = { items: Plan[]; total: number };
export type PlanContext = {
  workCenters: Array<{ id: string; name: string }>;
  members: Array<{ id: string; displayName: string; role: string }>;
};

export type PlanForm = {
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  responsibleUserId: string;
  provenance?: Record<string, unknown>;
  items: Array<{
    startsAt?: string;
    provenanceType?: string;
    provenanceReference?: string;
    provenanceSnapshot?: Record<string, unknown>;
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

export const planWriteRoles = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
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
  const [reviewing, setReviewing] = useState(false);
  const submission = useRef(false);
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
    queryKey: queryKeys.organization.operationalPlanContext(api.organizationId ?? 'inactive'),
    queryFn: ({ signal }) => api.request<PlanContext>('/operational-plans/context', { signal }),
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
      api.request<Plan>(
        reviewing && planId ? `/operational-plans/${planId}/versions` : '/operational-plans',
        {
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
              startsAt: item.startsAt || undefined,
              provenanceType: item.provenanceType || 'MANUAL',
            })),
          }),
        },
      ),
    onSuccess: async () => {
      form.reset();
      setReviewing(false);
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
        eyebrow="Plan Operativo"
        title={planId ? 'Detalle del plan operativo' : 'Planifica el trabajo SST'}
        description="El plan organiza actividades versionadas. La Cola de trabajo muestra únicamente lo que requiere atención."
      />
      {(!planId || reviewing) && planWriteRoles.has(api.role ?? '') ? (
        <Card className="inspection-form-card">
          <form
            className="inspection-form"
            onSubmit={form.handleSubmit((values) => {
              if (submission.current) return;
              submission.current = true;
              create.mutate(values, {
                onSettled: () => {
                  submission.current = false;
                },
              });
            })}
          >
            <div className="inspection-form-intro">
              <p className="eyebrow">Dos caminos, un mismo borrador revisable</p>
              <h2>{reviewing ? 'Revisar y crear nueva versión' : 'Ya tengo un plan'}</h2>
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
                <div className="field">
                  <label htmlFor={`plan-item-description-${index}`}>
                    Descripción de actividad {index + 1}
                  </label>
                  <textarea
                    id={`plan-item-description-${index}`}
                    {...form.register(`items.${index}.description`)}
                  />
                </div>
                <div className="inspection-form-grid">
                  <div className="field">
                    <label htmlFor={`plan-item-start-${index}`}>
                      Inicio de actividad {index + 1}
                    </label>
                    <input
                      id={`plan-item-start-${index}`}
                      type="date"
                      {...form.register(`items.${index}.startsAt`)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`plan-item-due-${index}`}>
                      Fecha límite de actividad {index + 1}
                    </label>
                    <input
                      id={`plan-item-due-${index}`}
                      type="date"
                      {...form.register(`items.${index}.dueAt`)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`plan-item-frequency-${index}`}>
                      Frecuencia de actividad {index + 1}
                    </label>
                    <input
                      id={`plan-item-frequency-${index}`}
                      placeholder="Mensual, trimestral…"
                      {...form.register(`items.${index}.frequency`)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`plan-item-priority-${index}`}>
                      Prioridad de actividad {index + 1}
                    </label>
                    <select
                      id={`plan-item-priority-${index}`}
                      {...form.register(`items.${index}.priority`)}
                    >
                      <option value="LOW">Baja</option>
                      <option value="MEDIUM">Media</option>
                      <option value="HIGH">Alta</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`plan-item-workCenterId-${index}`}>
                      Centro de trabajo de actividad {index + 1}
                    </label>
                    <select
                      id={`plan-item-workCenterId-${index}`}
                      {...form.register(`items.${index}.workCenterId`)}
                    >
                      <option value="">Toda la organización</option>
                      {context.data?.workCenters.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`plan-item-responsibleUserId-${index}`}>
                      Responsable de actividad {index + 1}
                    </label>
                    <select
                      id={`plan-item-responsibleUserId-${index}`}
                      {...form.register(`items.${index}.responsibleUserId`)}
                    >
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
                  <label htmlFor={`plan-item-evidenceReferencesText-${index}`}>
                    Referencias de evidencia de actividad {index + 1}
                  </label>
                  <textarea
                    id={`plan-item-evidenceReferencesText-${index}`}
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
                {reviewing ? 'Guardar nueva versión' : 'Ya tengo un plan'}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={
                  generate.isPending || !form.watch('periodStart') || !form.watch('periodEnd')
                }
                hidden={reviewing}
                onClick={() => generate.mutate()}
              >
                Ayúdame a crear uno
              </button>
            </div>
            {create.isError || generate.isError ? (
              <p role="alert">{operationalPlanError()}</p>
            ) : null}
          </form>
        </Card>
      ) : null}
      {activate.isError || transition.isError ? <p role="alert">{operationalPlanError()}</p> : null}
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
              {planId &&
              version.status === 'DRAFT' &&
              planWriteRoles.has(api.role ?? '') &&
              !reviewing ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    form.reset({
                      name: version.name,
                      description: version.description ?? '',
                      periodStart: version.periodStart.slice(0, 10),
                      periodEnd: version.periodEnd.slice(0, 10),
                      responsibleUserId: version.responsibleUserId ?? '',
                      provenance: version.provenance,
                      items: version.items.map((item) => ({
                        title: item.title,
                        description: item.description ?? '',
                        startsAt: item.startsAt?.slice(0, 10) ?? '',
                        dueAt: item.dueAt?.slice(0, 10) ?? '',
                        frequency: item.frequency ?? '',
                        priority: item.priority as PlanForm['items'][number]['priority'],
                        workCenterId: item.workCenter?.id ?? '',
                        responsibleUserId: item.responsible?.id ?? '',
                        evidenceReferencesText: item.evidenceReferences.join('\n'),
                        provenanceType: item.provenanceType,
                        provenanceReference: item.provenanceReference,
                        provenanceSnapshot: item.provenanceSnapshot,
                      })),
                    });
                    setReviewing(true);
                  }}
                >
                  Revisar y crear nueva versión
                </button>
              ) : null}
              <p>Responsable general: {version.responsible?.displayName ?? 'Sin asignar'}</p>
              {version.status === 'DRAFT' ? (
                <p>
                  Al activarlo, esta versión se convierte en el plan operativo vigente. Las
                  recomendaciones del diagnóstico no activan módulos ni cambian tu plan de
                  suscripción.
                </p>
              ) : null}
              {version.status === 'DRAFT' && !reviewing && activators.has(api.role ?? '') ? (
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
                      <p>Origen: {planItemSource(item.provenanceType, item.provenanceSnapshot)}</p>
                      {typeof item.provenanceSnapshot.engineVersion === 'string' ? (
                        <p>Motor de recomendación {item.provenanceSnapshot.engineVersion}</p>
                      ) : null}
                      <dl>
                        <div>
                          <dt>Centro</dt>
                          <dd>{item.workCenter?.name ?? 'Toda la organización'}</dd>
                        </div>
                        <div>
                          <dt>Responsable</dt>
                          <dd>{item.responsible?.displayName ?? 'Sin asignar'}</dd>
                        </div>
                        <div>
                          <dt>Inicio</dt>
                          <dd>{item.startsAt?.slice(0, 10) ?? 'Sin fecha'}</dd>
                        </div>
                        <div>
                          <dt>Fecha límite</dt>
                          <dd>{item.dueAt?.slice(0, 10) ?? 'Sin fecha'}</dd>
                        </div>
                        <div>
                          <dt>Frecuencia</dt>
                          <dd>{item.frequency ?? 'Sin definir'}</dd>
                        </div>
                      </dl>
                      <p>
                        Referencias de evidencia:{' '}
                        {item.evidenceReferences.length
                          ? item.evidenceReferences.join('; ')
                          : 'Sin referencias'}
                      </p>
                      {version.status === 'ACTIVE' &&
                      planWriteRoles.has(api.role ?? '') &&
                      item.execution.status === 'PLANNED' ? (
                        <button
                          type="button"
                          className="button"
                          disabled={transition.isPending}
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
                      {version.status === 'ACTIVE' &&
                      planWriteRoles.has(api.role ?? '') &&
                      item.execution.status === 'IN_PROGRESS' ? (
                        <button
                          type="button"
                          className="button"
                          disabled={transition.isPending}
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
                        <ul>
                          {historical.items.map((item) => (
                            <li key={item.id}>
                              {item.title} · {stateLabel(item.execution.status)}
                            </li>
                          ))}
                        </ul>
                        <small>
                          {historical.items.length} actividad(es) · {stateLabel(historical.status)}
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

export function PlanMetadataFields({
  form,
  context,
  disabled = false,
}: {
  form: UseFormReturn<PlanForm>;
  context?: PlanContext;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="inspection-form-grid">
      <legend>Datos del borrador</legend>
      <label className="field">
        Nombre del plan
        <input {...form.register('name', { required: true, minLength: 3, maxLength: 200 })} />
      </label>
      <label className="field">
        Descripción del plan
        <textarea {...form.register('description', { maxLength: 2000 })} />
      </label>
      <label className="field">
        Inicio del período
        <input type="date" {...form.register('periodStart', { required: true })} />
      </label>
      <label className="field">
        Fin del período
        <input type="date" {...form.register('periodEnd', { required: true })} />
      </label>
      <label className="field">
        Responsable general
        <select {...form.register('responsibleUserId')}>
          <option value="">Sin asignar</option>
          {context?.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
