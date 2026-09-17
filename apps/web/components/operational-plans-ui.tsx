'use client';

import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { useRef, useState } from 'react';
import { operationalPlanError } from '@/lib/operational-plan-handoff';
import { queryKeys } from '@/lib/query-keys';
import {
  isInheritedPlanItem,
  planDate,
  planVersionSource,
  type ActivePlanContext,
  type Plan,
  type PlanItem,
  type PlanList,
  type PlanVersion,
} from '@/lib/operational-plan-presentation';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  InspectionPageHeader,
  InspectionSkeleton,
  InspectionState,
} from './inspection-experience-ui';
import {
  PlanActivity,
  PlanBadge,
  PlanDialog,
  PlanHeader,
  PlanMissingReview,
  PlanPriority,
  PlanVersionBanner,
} from './operational-plan-surfaces';
import styles from './operational-plans.module.css';

export type PlanContext = {
  workCenters: Array<{ id: string; name: string }>;
  members: Array<{ id: string; displayName: string; role: string }>;
  activePlan?: ActivePlanContext | null;
};
export type PlanForm = {
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  responsibleUserId: string;
  provenance?: Record<string, unknown>;
  items: Array<{
    sourceItemId?: string;
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
type ActivityForm = PlanForm['items'][number];
const emptyActivity: ActivityForm = {
  title: '',
  description: '',
  dueAt: '',
  frequency: '',
  priority: 'MEDIUM',
  workCenterId: '',
  responsibleUserId: '',
  evidenceReferencesText: '',
};
export const planWriteRoles = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
const activators = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

function reviewValues(version: PlanVersion): PlanForm {
  return {
    name: version.name,
    description: version.description ?? '',
    periodStart: version.periodStart.slice(0, 10),
    periodEnd: version.periodEnd.slice(0, 10),
    responsibleUserId: version.responsibleUserId ?? '',
    provenance: version.provenance,
    items: version.items.map((item) => ({
      sourceItemId: item.id,
      title: item.title,
      description: item.description ?? '',
      startsAt: item.startsAt?.slice(0, 10) ?? '',
      dueAt: item.dueAt?.slice(0, 10) ?? '',
      frequency: item.frequency ?? '',
      priority: item.priority as ActivityForm['priority'],
      workCenterId: item.workCenter?.id ?? '',
      responsibleUserId: item.responsible?.id ?? '',
      evidenceReferencesText: item.evidenceReferences.join('\n'),
      provenanceType: item.provenanceType,
      provenanceReference: item.provenanceReference ?? undefined,
      provenanceSnapshot: item.provenanceSnapshot,
    })),
  };
}
function previewActivity(
  value: ActivityForm,
  index: number,
  context?: PlanContext,
  source?: PlanVersion,
): PlanItem {
  const original = source?.items.find((item) => item.id === value.sourceItemId);
  return {
    id: `preparing-${index}`,
    ...value,
    evidenceReferences: value.evidenceReferencesText.split('\n').filter(Boolean),
    provenanceType: value.provenanceType ?? 'MANUAL',
    provenanceSnapshot: value.provenanceSnapshot ?? {},
    workCenter:
      context?.workCenters.find((center) => center.id === value.workCenterId) ??
      (value.workCenterId && original?.workCenter?.id === value.workCenterId
        ? original.workCenter
        : undefined),
    responsible:
      context?.members.find((member) => member.id === value.responsibleUserId) ??
      (value.responsibleUserId && original?.responsible?.id === value.responsibleUserId
        ? original.responsible
        : undefined),
    execution: original?.execution ?? {
      status: 'PLANNED',
      version: 1,
    },
  };
}

export function OperationalPlans({
  planId,
  manual = false,
}: {
  planId?: string;
  manual?: boolean;
}) {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId;
  const router = useRouter();
  const cache = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const submission = useRef(false);
  const request = <T,>(path: string, init?: RequestInit) =>
    auth.request<T>(path, init, organizationId ?? undefined);
  const plans = useQuery({
    queryKey: planId
      ? queryKeys.organization.operationalPlan(organizationId ?? 'inactive', planId)
      : queryKeys.organization.operationalPlans(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      request<Plan | PlanList>(planId ? `/operational-plans/${planId}` : '/operational-plans', {
        signal,
      }),
    enabled: Boolean(organizationId) && !manual,
  });
  const context = useQuery({
    queryKey: queryKeys.organization.operationalPlanContext(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => request<PlanContext>('/operational-plans/context', { signal }),
    enabled: Boolean(organizationId),
  });
  const form = useForm<PlanForm>({
    defaultValues: {
      name: 'Plan Operativo SST',
      description: '',
      periodStart: new Date().toISOString().slice(0, 10),
      periodEnd: `${new Date().getUTCFullYear()}-12-31`,
      responsibleUserId: '',
      items: [{ ...emptyActivity }],
    },
  });
  const fields = useFieldArray({ control: form.control, name: 'items' });
  const values = form.watch();
  const refresh = () =>
    cache.invalidateQueries({ queryKey: queryKeys.organization.scope(organizationId!) });
  const create = useMutation({
    mutationFn: (input: PlanForm) =>
      request<Plan>(
        reviewing && planId ? `/operational-plans/${planId}/versions` : '/operational-plans',
        {
          method: 'POST',
          body: JSON.stringify({
            ...input,
            responsibleUserId: input.responsibleUserId || undefined,
            items: input.items.map(({ evidenceReferencesText, ...item }) => ({
              ...item,
              startsAt: item.startsAt || undefined,
              dueAt: item.dueAt || undefined,
              frequency: item.frequency || undefined,
              workCenterId: item.workCenterId || undefined,
              responsibleUserId: item.responsibleUserId || undefined,
              evidenceReferences: evidenceReferencesText
                .split('\n')
                .map((value) => value.trim())
                .filter(Boolean),
              provenanceType: item.provenanceType ?? 'MANUAL',
            })),
          }),
        },
      ),
    onSuccess: async (plan) => {
      setReviewing(false);
      setAnnouncement('Nueva versión borrador guardada.');
      await refresh();
      if (manual) router.push(`/app/plans/${plan.id}`);
    },
    onSettled: () => {
      submission.current = false;
    },
  });
  const activate = useMutation({
    mutationFn: (versionId: string) =>
      request(`/operational-plans/${planId}/versions/${versionId}/activate`, { method: 'POST' }),
    onSuccess: async () => {
      setConfirmation(false);
      setAnnouncement('Plan Operativo activo.');
      await refresh();
      requestAnimationFrame(() => document.getElementById('operational-plan-title')?.focus());
    },
  });
  const transition = useMutation({
    mutationFn: ({ item, status }: { item: PlanItem; status: string }) =>
      request(`/operational-plans/items/${item.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, expectedVersion: item.execution?.version }),
      }),
    onSuccess: async (_result, { item, status }) => {
      await refresh();
      setAnnouncement(`${item.title}: ${status === 'COMPLETED' ? 'completado' : 'en curso'}.`);
      requestAnimationFrame(() => {
        document.getElementById(`item-title-${item.id}`)?.setAttribute('tabindex', '-1');
        document.getElementById(`item-title-${item.id}`)?.focus();
      });
    },
    onError: () => {
      void refresh();
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
  const plan = planId ? list[0] : undefined;
  const version = plan?.versions[0];
  const active = plan?.versions.find((entry) => entry.status === 'ACTIVE');
  const inheritedSource = plan?.versions.find(
    (entry) => entry.id === version?.provenance.sourceVersionId,
  );
  const canWrite = planWriteRoles.has(organization.currentRole ?? '');
  const next = (version?.version ?? 0) + 1;
  function beginReview(index?: number) {
    if (!version) return;
    form.reset(reviewValues(version));
    setReviewing(true);
    if (index !== undefined) setEditing(index);
  }
  const preview = values.items.map((item, index) =>
    previewActivity(item, index, context.data, version),
  );
  const submit = form.handleSubmit((input) => {
    if (submission.current || !input.items.length) return;
    submission.current = true;
    create.mutate(input);
  });
  const renderEditor =
    editing !== null && values.items[editing] ? (
      <ActivityEditor
        key={fields.fields[editing]?.id}
        item={values.items[editing]!}
        index={editing}
        context={context.data}
        removable={values.items.length > 1}
        onClose={() => {
          setEditing(null);
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(`[data-plan-edit="${editing}"]`)?.focus(),
          );
        }}
        onRemove={() => {
          fields.remove(editing);
          setEditing(null);
        }}
        onSave={(item) => {
          form.setValue(`items.${editing}`, item, { shouldDirty: true });
          setEditing(null);
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(`[data-plan-edit="${editing}"]`)?.focus(),
          );
        }}
      />
    ) : null;
  return (
    <div className={`${styles.surface} inspection-task-page stack`}>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {!planId ? (
        <InspectionPageHeader
          eyebrow="Plan Operativo"
          title={manual ? 'Crear plan manual' : 'Planifica el trabajo SST'}
          description="El plan organiza lo que decidimos hacer. La Cola de trabajo muestra únicamente lo que requiere atención."
          actions={
            !manual && canWrite ? (
              <Link className="button secondary" href="/app/plans/new">
                Crear plan manual
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Link href="/app/plans">← Todos los planes</Link>
      )}
      {create.isError || transition.isError || (activate.isError && !confirmation) ? (
        <p role="alert">{operationalPlanError()}</p>
      ) : null}
      {(manual || reviewing) && canWrite ? (
        <>
          {version && reviewing ? (
            <PlanVersionBanner source={version} next={next} preparing />
          ) : null}
          <Card className={styles.header}>
            {reviewing ? (
              <h1>
                {values.name} · v{next} en preparación
              </h1>
            ) : (
              <h2>Tu plan, organizado para trabajar</h2>
            )}
            <PlanMetadataFields form={form} context={context.data} disabled={create.isPending} />
            <p>
              {reviewing
                ? 'Los cambios se guardarán en una nueva versión.'
                : 'Crear un borrador no activa módulos ni modifica tu suscripción.'}
            </p>
          </Card>
          <PlanMissingReview items={preview} />
          <section className="stack-sm" aria-label="Actividades en preparación">
            <h2>Actividades · {preview.length}</h2>
            {preview.map((item, index) => (
              <PlanActivity key={fields.fields[index]?.id} item={item}>
                <button
                  type="button"
                  className="button secondary"
                  disabled={create.isPending}
                  data-plan-edit={index}
                  aria-label={`Editar actividad ${index + 1}`}
                  onClick={() => setEditing(index)}
                >
                  Editar
                </button>
              </PlanActivity>
            ))}
          </section>
          <button
            type="button"
            className="button secondary"
            disabled={create.isPending || preview.length >= 100}
            onClick={() => {
              fields.append({ ...emptyActivity });
              setEditing(preview.length);
            }}
          >
            Agregar actividad
          </button>
          <div className={`${styles.actions} ${styles.mobileAction}`}>
            <button
              className="button"
              disabled={create.isPending || !preview.length}
              onClick={() => void submit()}
            >
              {create.isPending
                ? 'Guardando…'
                : reviewing
                  ? `Guardar como v${next}`
                  : 'Crear borrador manual'}
            </button>
            {reviewing ? (
              <button
                className="button secondary"
                disabled={create.isPending}
                onClick={() => setReviewing(false)}
              >
                Descartar cambios
              </button>
            ) : (
              <Link href="/app/plans">Volver a planes</Link>
            )}
          </div>
          {renderEditor}
        </>
      ) : planId && version ? (
        <>
          {inheritedSource && version.status === 'DRAFT' ? (
            <PlanVersionBanner source={inheritedSource} next={version.version} />
          ) : null}
          <PlanHeader version={version}>
            <div className={styles.actions}>
              {version.status === 'ACTIVE' ? (
                <Link className="button" href="/app/work?module=PLAN">
                  Ver lo que requiere atención
                </Link>
              ) : null}
              {canWrite && version.status !== 'RETIRED' ? (
                <button className="button secondary" onClick={() => beginReview()}>
                  Revisar y crear nueva versión
                </button>
              ) : null}
              {version.status === 'DRAFT' && activators.has(organization.currentRole ?? '') ? (
                <button
                  className={`button ${styles.activateAction}`}
                  onClick={() => setConfirmation(true)}
                >
                  Activar plan
                </button>
              ) : null}
            </div>
            {version.status === 'DRAFT' && !activators.has(organization.currentRole ?? '') ? (
              <p>Activar corresponde a Propietario, Administrador o Responsable SST.</p>
            ) : null}
            {active && active.id !== version.id ? (
              <p>
                v{active.version} sigue vigente mientras revisas v{version.version}.
              </p>
            ) : null}
            {plan && plan.versions.length > 1 ? (
              <p>
                v{version.version} {version.status === 'ACTIVE' ? 'vigente' : 'guardada'} · anterior
                v{plan.versions[1]!.version}
              </p>
            ) : null}
          </PlanHeader>
          {version.status === 'DRAFT' ? (
            <PlanMissingReview
              items={
                inheritedSource
                  ? version.items.filter((item) => !isInheritedPlanItem(item))
                  : version.items
              }
              newOnly={Boolean(inheritedSource)}
            />
          ) : null}
          <ActivityGroups
            version={version}
            inheritedSource={inheritedSource}
            renderActions={(item) => (
              <div className={styles.actions}>
                {canWrite && version.status !== 'RETIRED' ? (
                  <button
                    className="button secondary"
                    data-plan-edit={version.items.indexOf(item)}
                    aria-label={`Editar ${item.title}`}
                    onClick={() => beginReview(version.items.indexOf(item))}
                  >
                    Editar
                  </button>
                ) : null}
                {canWrite &&
                version.status === 'ACTIVE' &&
                ['PLANNED', 'IN_PROGRESS'].includes(item.execution?.status ?? '') ? (
                  <button
                    className="button secondary"
                    disabled={transition.isPending}
                    onClick={() =>
                      transition.mutate({
                        item,
                        status: item.execution?.status === 'PLANNED' ? 'IN_PROGRESS' : 'COMPLETED',
                      })
                    }
                  >
                    {item.execution?.status === 'PLANNED' ? 'Iniciar' : 'Completar'}
                  </button>
                ) : null}
              </div>
            )}
          />
          <section className="stack-sm" aria-label="Historial de versiones">
            <h2>Historial de versiones</h2>
            <p>Las versiones guardadas no cambian. Cada revisión crea una nueva.</p>
            {plan?.versions.map((entry) => (
              <div className={styles.row} key={entry.id}>
                <strong>
                  Versión {entry.version} ·{' '}
                  {entry.status === 'ACTIVE'
                    ? 'Activo'
                    : entry.status === 'RETIRED'
                      ? 'Histórico'
                      : 'Borrador'}
                </strong>
                <span>
                  {entry.items.length} actividades · {planDate(entry.periodStart)} –{' '}
                  {planDate(entry.periodEnd)}
                </span>
              </div>
            ))}
            <details className={styles.technical}>
              <summary>Detalle técnico de la versión</summary>
              <p>{version.contentDigest}</p>
            </details>
          </section>
          <PlanDialog
            open={confirmation}
            title="Activar Plan Operativo"
            onClose={() => {
              if (!activate.isPending) setConfirmation(false);
            }}
          >
            <div className={styles.dialogBody}>
              <p>Esta versión se convertirá en tu Plan Operativo vigente.</p>
              {context.data?.activePlan ? (
                <p>
                  {context.data.activePlan.name} · v{context.data.activePlan.version} pasará a
                  histórico y {version.name} · v{version.version} será vigente. La versión vigente
                  se conserva completa con sus actividades y su estado.
                </p>
              ) : null}
              <strong>
                {version.name} · v{version.version}
              </strong>
              <p>
                {planDate(version.periodStart)} – {planDate(version.periodEnd)}
              </p>
              <p>Responsable general: {version.responsible?.displayName ?? 'Sin asignar'}</p>
              <p>{version.items.length} actividades</p>
              <PlanMissingReview items={version.items} />
              <p>Las actividades heredadas conservan su estado de ejecución.</p>
              <p>Activar el plan no activa módulos ni modifica tu suscripción.</p>
              {activate.isError ? <p role="alert">{operationalPlanError()}</p> : null}
            </div>
            <div className={styles.dialogFooter}>
              <button
                className="button"
                disabled={activate.isPending}
                onClick={() => activate.mutate(version.id)}
              >
                {activate.isPending ? 'Activando…' : 'Activar Plan Operativo'}
              </button>
              <button
                className="button secondary"
                disabled={activate.isPending}
                onClick={() => setConfirmation(false)}
              >
                Seguir revisando
              </button>
            </div>
          </PlanDialog>
        </>
      ) : !manual ? (
        <PlanListing list={list} canWrite={canWrite} />
      ) : null}
    </div>
  );
}

function ActivityGroups({
  version,
  inheritedSource,
  renderActions,
}: {
  version: PlanVersion;
  inheritedSource?: PlanVersion;
  renderActions(item: PlanItem): React.ReactNode;
}) {
  const groups =
    version.status === 'ACTIVE'
      ? ['IN_PROGRESS', 'PLANNED', 'COMPLETED', 'CANCELED'].map((status) => ({
          title: (
            {
              IN_PROGRESS: 'En curso',
              PLANNED: 'Planificadas',
              COMPLETED: 'Completadas',
              CANCELED: 'Canceladas',
            } as Record<string, string>
          )[status],
          items: version.items.filter((item) => (item.execution?.status ?? 'PLANNED') === status),
          newProposal: false,
        }))
      : inheritedSource
        ? [
            {
              title: 'Nuevas propuestas del diagnóstico',
              items: version.items.filter((item) => !isInheritedPlanItem(item)),
              newProposal: true,
            },
            {
              title: `Actividades heredadas de v${inheritedSource.version}`,
              items: version.items.filter(isInheritedPlanItem),
              newProposal: false,
            },
          ]
        : [{ title: 'Actividades del plan', items: version.items, newProposal: false }];
  return (
    <>
      {groups
        .filter((group) => group.items.length)
        .map((group) => (
          <section key={group.title} className="stack-sm">
            <h2>
              {group.title} · {group.items.length}
            </h2>
            {group.items.map((item) => (
              <PlanActivity key={item.id} item={item} newProposal={group.newProposal}>
                {renderActions(item)}
              </PlanActivity>
            ))}
          </section>
        ))}
    </>
  );
}
function PlanListing({ list, canWrite }: { list: Plan[]; canWrite: boolean }) {
  if (!list.length)
    return (
      <InspectionState
        kind="empty"
        title="Todavía no hay planes"
        description="Convierte un diagnóstico finalizado en un borrador o ingresa tu plan manualmente."
        action={
          <div className={styles.actions}>
            <Link className="button" href="/app/evaluation">
              Ir a Evaluación SST
            </Link>
            {canWrite ? (
              <Link className="button secondary" href="/app/plans/new">
                Ingresar plan manualmente
              </Link>
            ) : null}
          </div>
        }
      />
    );
  const groups = [
    {
      title: 'Plan vigente',
      plans: list.filter((plan) => plan.versions.some((version) => version.status === 'ACTIVE')),
    },
    {
      title: 'Borradores',
      plans: list.filter(
        (plan) =>
          !plan.versions.some((version) => version.status === 'ACTIVE') &&
          plan.versions[0]?.status === 'DRAFT',
      ),
    },
    {
      title: 'Históricos',
      plans: list.filter(
        (plan) =>
          !plan.versions.some((version) => version.status === 'ACTIVE') &&
          plan.versions[0]?.status !== 'DRAFT',
      ),
    },
  ];
  return (
    <>
      {groups
        .filter((group) => group.plans.length)
        .map((group) => (
          <section className="stack-sm" key={group.title}>
            <h2>{group.title}</h2>
            {group.plans.map((plan) => {
              const version =
                plan.versions.find((entry) => entry.status === 'ACTIVE') ?? plan.versions[0];
              if (!version) return null;
              return (
                <Card
                  key={plan.id}
                  className={`${styles.header} ${version.status === 'ACTIVE' ? styles.activePlan : ''}`}
                >
                  <div className={styles.row}>
                    <h3>
                      <Link href={`/app/plans/${plan.id}`}>{version.name}</Link>
                    </h3>
                    <PlanBadge version={version.version} status={version.status} />
                  </div>
                  <p>
                    {planDate(version.periodStart)} – {planDate(version.periodEnd)}
                  </p>
                  <p>
                    Responsable general: {version.responsible?.displayName ?? 'Sin asignar'} ·{' '}
                    {version.items.length} actividades
                  </p>
                  <p>Origen: {planVersionSource(version)}</p>
                  {plan.versions[0]?.id !== version.id ? (
                    <p>Nuevo borrador v{plan.versions[0]?.version} disponible para revisar.</p>
                  ) : null}
                </Card>
              );
            })}
          </section>
        ))}
    </>
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
  const [expanded, setExpanded] = useState(false);
  const values = form.watch();
  return (
    <section className={styles.metadata}>
      <div className={styles.row}>
        <h3>Datos del plan</h3>
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Cerrar datos del plan' : 'Editar datos del plan'}
        </button>
      </div>
      {!expanded ? (
        <>
          <strong>{values.name}</strong>
          <p>
            {planDate(values.periodStart)} – {planDate(values.periodEnd)}
          </p>
          <p>
            Responsable general:{' '}
            {context?.members.find((member) => member.id === values.responsibleUserId)
              ?.displayName ?? 'Sin asignar'}
          </p>
        </>
      ) : (
        <fieldset disabled={disabled} className={styles.metadataGrid}>
          <legend className="sr-only">Datos del borrador</legend>
          <label className="field">
            Nombre del plan
            <input {...form.register('name', { required: true, minLength: 3, maxLength: 200 })} />
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
          <label className="field">
            Inicio del período
            <input type="date" {...form.register('periodStart', { required: true })} />
          </label>
          <label className="field">
            Fin del período
            <input
              type="date"
              {...form.register('periodEnd', {
                required: true,
                validate: (end) => end >= form.getValues('periodStart') || 'Revisa el período.',
              })}
            />
          </label>
          <label className="field">
            Descripción del plan
            <textarea {...form.register('description', { maxLength: 2000 })} />
          </label>
        </fieldset>
      )}
      {Object.keys(form.formState.errors).some((key) => key !== 'items') ? (
        <p role="alert">Revisa el nombre y las fechas del plan.</p>
      ) : null}
    </section>
  );
}
function ActivityEditor({
  item,
  index,
  context,
  removable,
  onClose,
  onSave,
  onRemove,
}: {
  item: ActivityForm;
  index: number;
  context?: PlanContext;
  removable: boolean;
  onClose(): void;
  onSave(item: ActivityForm): void;
  onRemove(): void;
}) {
  const form = useForm<ActivityForm>({ defaultValues: item });
  return (
    <PlanDialog open title={`Editar actividad ${index + 1}`} onClose={onClose} drawer>
      <form className={styles.editorForm} onSubmit={form.handleSubmit(onSave)}>
        <div className={styles.dialogBody}>
          <label className="field">
            Actividad
            <input {...form.register('title', { required: true, minLength: 3, maxLength: 240 })} />
          </label>
          <label className="field">
            Descripción de actividad {index + 1}
            <textarea rows={3} {...form.register('description', { maxLength: 2000 })} />
          </label>
          <div className="field">
            <label htmlFor="plan-activity-work-center">
              Centro de trabajo de actividad {index + 1}
            </label>
            <select id="plan-activity-work-center" {...form.register('workCenterId')}>
              <option value="">Toda la organización</option>
              {context?.workCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="plan-activity-responsible">Responsable de actividad {index + 1}</label>
            <select id="plan-activity-responsible" {...form.register('responsibleUserId')}>
              <option value="">Sin asignar</option>
              {context?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
          <label className="field">
            Inicio de actividad {index + 1}
            <input type="date" {...form.register('startsAt')} />
          </label>
          <label className="field">
            Fecha límite de actividad {index + 1}
            <input
              type="date"
              {...form.register('dueAt', {
                validate: (due) =>
                  !due ||
                  !form.getValues('startsAt') ||
                  due >= form.getValues('startsAt')! ||
                  'Revisa las fechas de la actividad.',
              })}
            />
          </label>
          <label className="field">
            Frecuencia de actividad {index + 1}
            <input {...form.register('frequency', { maxLength: 120 })} />
          </label>
          <div className={styles.chips} role="group" aria-label="Frecuencias habituales">
            {['Mensual', 'Trimestral', 'Anual'].map((frequency) => (
              <button
                type="button"
                key={frequency}
                onClick={() => form.setValue('frequency', frequency)}
              >
                {frequency}
              </button>
            ))}
          </div>
          <div className="field">
            <span>Prioridad de actividad {index + 1}</span>
            <div
              className={styles.chips}
              role="group"
              aria-label={`Prioridad de actividad ${index + 1}`}
            >
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
                <button
                  key={priority}
                  type="button"
                  aria-pressed={form.watch('priority') === priority}
                  onClick={() => form.setValue('priority', priority)}
                >
                  <PlanPriority priority={priority} />
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            Referencias de evidencia de actividad {index + 1}
            <textarea
              placeholder="Una referencia por línea"
              {...form.register('evidenceReferencesText')}
            />
          </label>
          {Object.keys(form.formState.errors).length ? (
            <p role="alert">Revisa el título y las fechas de la actividad.</p>
          ) : null}
        </div>
        <div className={styles.dialogFooter}>
          <button className="button">Guardar cambios</button>
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          {removable ? (
            <button className="button secondary" type="button" onClick={onRemove}>
              Quitar del plan
            </button>
          ) : null}
        </div>
      </form>
    </PlanDialog>
  );
}
