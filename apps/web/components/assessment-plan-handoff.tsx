'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
import { planDate } from '@/lib/operational-plan-presentation';
import { PlanPriority } from './operational-plan-surfaces';
import styles from './operational-plans.module.css';
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
  const [destination, setDestination] = useState<'EXISTING' | 'NEW' | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [recent, setRecent] = useState<SstCapabilityKey | null>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
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
  const target = destination === 'EXISTING' ? context.data?.activePlan : null;
  const create = useMutation({
    mutationFn: async (values: PlanForm) => {
      if (!auth.user || !organizationId || !selected.length)
        throw new Error('PLAN_SELECTION_REQUIRED');
      const scope = planHandoffStorageKey(
        auth.user.id,
        organizationId,
        target ? `${assessmentId}:${target.planId}` : assessmentId,
      );
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
        target
          ? `/operational-plans/${target.planId}/from-assessment/${assessmentId}`
          : `/operational-plans/from-assessment/${assessmentId}`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': key.current },
          body: JSON.stringify({
            name: !target || form.getFieldState('name').isDirty ? values.name : undefined,
            description: form.getFieldState('description').isDirty
              ? values.description
              : !target
                ? values.description || undefined
                : undefined,
            periodStart:
              !target || form.getFieldState('periodStart').isDirty ? values.periodStart : undefined,
            periodEnd:
              !target || form.getFieldState('periodEnd').isDirty ? values.periodEnd : undefined,
            responsibleUserId:
              !target || form.getFieldState('responsibleUserId').isDirty
                ? values.responsibleUserId || undefined
                : undefined,
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
  useEffect(() => {
    if (!create.isPending) return;
    const timer = setTimeout(() => setShowPending(true), 250);
    return () => {
      clearTimeout(timer);
      setShowPending(false);
    };
  }, [create.isPending]);
  useEffect(() => {
    if (!recent) return;
    const timer = setTimeout(() => setRecent(null), 4000);
    return () => clearTimeout(timer);
  }, [recent]);
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
  const active = context.data?.activePlan;
  function choose(value: 'EXISTING' | 'NEW') {
    setDestination(value);
    setSelected([]);
    key.current = null;
    if (value === 'EXISTING' && active) {
      form.reset({
        name: active.name,
        description: '',
        periodStart: active.periodStart.slice(0, 10),
        periodEnd: active.periodEnd.slice(0, 10),
        responsibleUserId: active.responsible?.id ?? '',
        items: [],
      });
    } else {
      form.reset({
        name: 'Plan Operativo SST',
        description: '',
        periodStart: new Date().toISOString().slice(0, 10),
        periodEnd: `${new Date().getUTCFullYear()}-12-31`,
        responsibleUserId: '',
        items: [],
      });
    }
  }
  function toggle(capabilityKey: SstCapabilityKey) {
    if (create.isPending) return;
    setSelected((current) =>
      current.includes(capabilityKey)
        ? current.filter((key) => key !== capabilityKey)
        : [...current, capabilityKey],
    );
    setRecent(capabilityKey);
  }
  const selectedRecommendations = recommendations.filter((recommendation) =>
    selected.includes(recommendation.capabilityKey),
  );
  return (
    <div className={`${styles.surface} inspection-task-page stack`}>
      <InspectionPageHeader
        eyebrow="Plan Operativo"
        title={
          active && !destination
            ? 'Ya tienes un Plan Operativo vigente.'
            : target
              ? `Elige qué incorporar a v${target.nextVersion}`
              : 'Elige qué incluir en tu plan'
        }
        description="El diagnóstico propone capacidades. Tú decides qué trabajo planificar; nada se incluye automáticamente."
      />
      {active && !destination ? (
        <>
          <Card className={`${styles.header} ${styles.activePlan}`}>
            <p className="eyebrow">Plan vigente · v{active.version} · Activo</p>
            <h2>{active.name}</h2>
            <dl className={styles.facts}>
              <div>
                <dt>Período</dt>
                <dd>
                  {planDate(active.periodStart)} – {planDate(active.periodEnd)}
                </dd>
              </div>
              <div>
                <dt>Responsable general</dt>
                <dd>{active.responsible?.displayName ?? 'Sin asignar'}</dd>
              </div>
              <div>
                <dt>Contenido</dt>
                <dd>{active.itemCount} actividades</dd>
              </div>
              <div>
                <dt>Versión</dt>
                <dd>v{active.version} vigente</dd>
              </div>
            </dl>
            <Link href={`/app/plans/${active.planId}`}>Abrir plan vigente</Link>
          </Card>
          <p>Tu plan vigente no cambia. Tú eliges cómo usar las propuestas del diagnóstico.</p>
          <section className={styles.decision} aria-label="Cómo usar el diagnóstico">
            <button type="button" onClick={() => choose('EXISTING')}>
              <strong>Incorporar al plan vigente</strong>
              <span>
                Prepararemos una nueva versión borrador. Tu plan vigente seguirá activo mientras la
                revisas.
              </span>
            </button>
            <button type="button" onClick={() => choose('NEW')}>
              <strong>Crear un plan nuevo</strong>
              <span>Un borrador independiente con las propuestas que elijas.</span>
            </button>
            <button type="button" onClick={() => router.push(`/app/evaluation/${assessmentId}`)}>
              <strong>Ahora no</strong>
              <span>El diagnóstico queda guardado y tu plan sigue vigente.</span>
            </button>
          </section>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={form.handleSubmit((values) => {
            if (!selected.length || inFlight.current) return;
            inFlight.current = true;
            create.mutate(values);
          })}
        >
          {target ? (
            <section className={styles.versionBanner}>
              <strong>
                v{target.version} · Activo → v{target.nextVersion} · Nuevo borrador
              </strong>
              <p>
                Se conservarán las {target.itemCount} actividades heredadas, con su estado y
                procedencia. Tu versión vigente no se modifica.
              </p>
            </section>
          ) : null}
          {active ? (
            <button
              type="button"
              className="button secondary"
              disabled={create.isPending}
              onClick={() => {
                setDestination(null);
                setSelected([]);
              }}
            >
              Cambiar elección
            </button>
          ) : null}
          <div className={styles.selectionLayout}>
            <section
              className={styles.selectionList}
              aria-label="Propuestas del diagnóstico"
              aria-busy={create.isPending}
            >
              {recommendations.map((r) => {
                const included = selected.includes(r.capabilityKey);
                return (
                  <article key={r.capabilityKey} aria-labelledby={`proposal-${r.capabilityKey}`}>
                    <Card className={styles.proposal} data-selected={included}>
                      <div className={styles.proposalTitle}>
                        <h2 id={`proposal-${r.capabilityKey}`}>{r.title}</h2>
                        <button
                          type="button"
                          className={`button ${included ? '' : 'secondary'}`}
                          aria-pressed={included}
                          aria-label={`${included ? 'Incluida' : 'Incluir'} ${r.title}${target ? ` en v${target.nextVersion}` : ' en el plan'}`}
                          disabled={create.isPending}
                          onClick={() => toggle(r.capabilityKey)}
                        >
                          <span aria-hidden="true">{included ? '✓' : '□'}</span>{' '}
                          {included ? 'Incluida' : 'Incluir'}
                          {target ? ` en v${target.nextVersion}` : ''}
                        </button>
                      </div>
                      <p>{r.description}</p>
                      <div className={styles.reasons}>
                        <strong>Por qué aparece</strong>
                        <ul>
                          {r.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                      <div className={styles.row}>
                        <PlanPriority priority={r.priority} suggested />
                        <span className={styles.source}>Origen · Diagnóstico SST</span>
                      </div>
                    </Card>
                  </article>
                );
              })}
            </section>
            <Card
              className={styles.preparation}
              data-expanded={summaryOpen}
              aria-label="Plan en preparación"
            >
              <h2>Plan en preparación{target ? ` · v${target.nextVersion}` : ''}</h2>
              <p ref={summaryRef} tabIndex={-1} role="status" aria-live="polite">
                {create.isPending && showPending
                  ? 'Guardando tu borrador…'
                  : `${selected.length} líneas de trabajo seleccionadas`}
              </p>
              <button
                type="button"
                className={`button secondary ${styles.summaryToggle}`}
                aria-expanded={summaryOpen}
                onClick={() => setSummaryOpen(!summaryOpen)}
              >
                {summaryOpen ? 'Ocultar resumen' : 'Ver resumen del plan'}
              </button>
              <div className={`${styles.summaryBody} stack-sm`} data-open={summaryOpen}>
                {!selected.length ? (
                  <p>Aún no has elegido nada. Aquí aparecerán las líneas de trabajo de tu plan.</p>
                ) : (
                  <ul className={styles.selectedList}>
                    {selectedRecommendations.map((r) => (
                      <li key={r.capabilityKey} data-recent={r.capabilityKey === recent}>
                        <span>✓ {r.title}</span>
                        <button
                          type="button"
                          aria-label={`Quitar ${r.title} del plan`}
                          disabled={create.isPending}
                          onClick={() => {
                            toggle(r.capabilityKey);
                            summaryRef.current?.focus();
                          }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {target ? (
                  <p>
                    {target.itemCount} actividades heredadas de v{target.version}
                  </p>
                ) : null}
                <PlanMetadataFields
                  form={form}
                  context={context.data}
                  disabled={create.isPending}
                />
              </div>
              {create.isError ? <p role="alert">{operationalPlanError()}</p> : null}
              <button
                className={`button ${styles.prepareSubmit}`}
                disabled={!selected.length || create.isPending}
              >
                {create.isPending
                  ? 'Guardando…'
                  : target
                    ? `Preparar v${target.nextVersion}`
                    : 'Crear borrador'}
              </button>
              {!selected.length ? (
                <p>Elige al menos una propuesta para continuar.</p>
              ) : (
                <p>
                  Se creará un borrador con {selected.length + (target?.itemCount ?? 0)} actividades
                  {target ? `; v${target.version} seguirá vigente` : ', una por línea de trabajo'}.
                </p>
              )}
              {showPending && create.isPending ? (
                <div className={styles.pending} aria-hidden="true">
                  Guardando la selección y preparando el borrador para tu revisión.
                </div>
              ) : null}
            </Card>
          </div>
          <p>
            Estas propuestas ayudan a organizar el trabajo. No activan módulos, no cambian tu
            suscripción ni son obligaciones legales.
          </p>
          <Link href="/app/plans">Ver planes existentes</Link>
        </form>
      )}
    </div>
  );
}
