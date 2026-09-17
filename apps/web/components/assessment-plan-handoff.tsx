'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SstCapabilityKey } from '@sst/contracts';
import { Card } from '@sst/ui';
import Link from 'next/link';
import { queryKeys } from '@/lib/query-keys';
import type { AssessmentSession } from '@/lib/sst-assessment-types';
import {
  canCreateAssessmentPlan,
  operationalPlanError,
  planHandoffRetryKey,
  planHandoffStorageKey,
} from '@/lib/operational-plan-handoff';
import { humanPriorityLabel } from '@/lib/human-lexicon';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  InspectionPageHeader,
  InspectionSkeleton,
  InspectionState,
} from './inspection-experience-ui';
import {
  PlanMetadataFields,
  type PlanContext,
  type PlanForm,
  planWriteRoles,
} from './operational-plans-ui';

export function AssessmentPlanHandoff({ assessmentId }: { assessmentId: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId;
  const router = useRouter();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<SstCapabilityKey[]>([]);
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);
  const form = useForm<PlanForm>({
    defaultValues: {
      name: 'Plan Operativo SST',
      description: '',
      periodStart: new Date().toISOString().slice(0, 10),
      periodEnd: `${new Date().getUTCFullYear()}-12-31`,
      responsibleUserId: '',
      items: [],
    },
  });
  const session = useQuery({
    queryKey: queryKeys.organization.sstAssessmentSession(
      organizationId ?? 'inactive',
      assessmentId,
    ),
    queryFn: ({ signal }) =>
      auth.request<AssessmentSession>(
        `/sst-assessment/sessions/${assessmentId}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const context = useQuery({
    queryKey: queryKeys.organization.operationalPlanContext(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<PlanContext>('/operational-plans/context', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const create = useMutation({
    mutationFn: async (values: PlanForm) => {
      if (!auth.user || !organizationId || !selected.length)
        throw new Error('PLAN_SELECTION_REQUIRED');
      const scope = planHandoffStorageKey(auth.user.id, organizationId, assessmentId);
      if (!key.current) {
        try {
          key.current = planHandoffRetryKey(window.sessionStorage, scope, () =>
            crypto.randomUUID(),
          );
        } catch {
          key.current = crypto.randomUUID();
        }
      }
      const plan = await auth.request<{ id: string }>(
        `/operational-plans/from-assessment/${assessmentId}`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': key.current },
          body: JSON.stringify({
            name: values.name,
            description: values.description || undefined,
            periodStart: values.periodStart,
            periodEnd: values.periodEnd,
            responsibleUserId: values.responsibleUserId || undefined,
            selectedCapabilityKeys: selected,
          }),
        },
        organizationId,
      );
      try {
        window.sessionStorage.removeItem(scope);
      } catch {
        /* The in-memory key also protects this tab. */
      }
      return plan;
    },
    onSuccess: (plan) => {
      void cache.invalidateQueries({ queryKey: queryKeys.organization.scope(organizationId!) });
      router.push(`/app/plans/${plan.id}`);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  if (session.isLoading || context.isLoading)
    return <InspectionSkeleton label="Cargando propuestas del diagnóstico" />;
  if (session.isError || context.isError)
    return (
      <InspectionState
        kind="error"
        title="No pudimos cargar las propuestas"
        description="Actualiza la vista e inténtalo nuevamente."
      />
    );
  if (
    !session.data ||
    !canCreateAssessmentPlan(
      // This resource is read through the authenticated tenant endpoint. A claimed
      // diagnosis retains PUBLIC as its historical origin, not its access mode.
      'AUTHENTICATED',
      session.data.status,
      session.data.result?.capabilityEvaluation,
    )
  )
    return (
      <InspectionState
        kind="empty"
        title="Este diagnóstico no tiene propuestas disponibles"
        description="Este diagnóstico fue generado antes de esta función o aún no está finalizado. Puedes realizar una nueva evaluación para crear un plan desde el diagnóstico."
        action={<Link href="/app/evaluation">Ir a evaluaciones</Link>}
      />
    );
  if (!planWriteRoles.has(organization.currentRole ?? ''))
    return (
      <InspectionState
        kind="empty"
        title="Necesitas permisos para crear el plan"
        description="Solicita la revisión de una persona responsable de SST."
      />
    );
  const recommendations = session.data.result!.capabilityEvaluation!.recommendations;
  return (
    <div className="inspection-task-page stack">
      <InspectionPageHeader
        eyebrow="Plan Operativo"
        title="Elige qué incluir en tu plan"
        description="El diagnóstico propone capacidades. Tú decides qué trabajo planificar; nada se incluye automáticamente."
      />
      <form
        className="inspection-form"
        onSubmit={form.handleSubmit((values) => {
          if (!selected.length || inFlight.current) return;
          inFlight.current = true;
          create.mutate(values);
        })}
      >
        <div className="stack-sm">
          {recommendations.map((r) => (
            <Card key={r.capabilityKey} className="inspection-summary-card">
              <h2>{r.title}</h2>
              <p>{r.description}</p>
              <p>Prioridad {humanPriorityLabel(r.priority).toLowerCase()}</p>
              <ul>
                {r.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <label className="field">
                <input
                  type="checkbox"
                  disabled={create.isPending}
                  checked={selected.includes(r.capabilityKey)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, r.capabilityKey]
                        : current.filter((k) => k !== r.capabilityKey),
                    )
                  }
                />
                Incluir {r.title} en el plan
              </label>
            </Card>
          ))}
        </div>
        <p role="status">{selected.length} capacidades seleccionadas</p>
        <PlanMetadataFields form={form} context={context.data} disabled={create.isPending} />
        <p>
          Crearemos un borrador para tu revisión. No activa módulos, cambia la suscripción ni
          convierte estas propuestas en obligaciones legales.
        </p>
        {create.isError ? <p role="alert">{operationalPlanError()}</p> : null}
        <button className="button" disabled={!selected.length || create.isPending}>
          Crear borrador
        </button>
        <Link href="/app/plans">Ver planes existentes</Link>
      </form>
    </div>
  );
}
