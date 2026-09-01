'use client';

import { ApiClientError } from '@sst/api-client';
import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import { ContextSummary, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from './workspace';

type PpeCategory =
  | 'HEAD'
  | 'EYE_FACE'
  | 'HEARING'
  | 'RESPIRATORY'
  | 'HAND_ARM'
  | 'FOOT'
  | 'BODY'
  | 'FALL_PROTECTION'
  | 'OTHER';
type CatalogItem = {
  id: string;
  name: string;
  category: PpeCategory;
  description?: string | null;
  manufacturerModel?: string | null;
  referenceStandard?: string | null;
  defaultReplacementIntervalDays?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
};
type CatalogResponse = { items: CatalogItem[]; total: number };
type PpeRequirement = {
  id: string;
  reason: string;
  status: 'REQUIRED' | 'FULFILLED' | 'CANCELLED';
  assignedAt: string;
  ppeCatalogItem: Pick<CatalogItem, 'id' | 'name' | 'category' | 'status'>;
  workCenter?: { id: string; name: string } | null;
  linkedAssessment?: { id: string; title: string } | null;
  linkedFinding?: { id: string; title: string; inspectionId: string } | null;
};
type PpeIssue = {
  id: string;
  status: 'ISSUED' | 'IN_SERVICE' | 'REPLACEMENT_DUE' | 'REPLACED' | 'RETIRED' | 'LOST_DAMAGED';
  acknowledgementStatus: 'PENDING' | 'RECORDED';
  acknowledgementNote?: string | null;
  issuedAt: string;
  expectedReplacementAt?: string | null;
  assetReference?: string | null;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
  replacesIssueId?: string | null;
  version: number;
  replacementDue: boolean;
  ppeCatalogItem: Pick<CatalogItem, 'id' | 'name' | 'category' | 'referenceStandard'>;
  requirement?: { id: string; reason: string; status: string } | null;
  inspections: Array<{
    id: string;
    inspectedAt: string;
    condition: 'SERVICEABLE' | 'REVIEW_REQUIRED' | 'UNSERVICEABLE';
    note?: string | null;
  }>;
};
type WorkerPpeWorkspace = {
  worker: { id: string; displayName: string; status: 'ACTIVE' | 'INACTIVE' };
  requirements: PpeRequirement[];
  issues: PpeIssue[];
};
type CatalogForm = {
  name: string;
  category: PpeCategory;
  description: string;
  referenceStandard: string;
  defaultReplacementIntervalDays: string;
};
type RequirementForm = { ppeCatalogItemId: string; reason: string };
type IssueForm = {
  requirementId: string;
  issuedAt: string;
  expectedReplacementAt: string;
  assetReference: string;
  evidenceNote: string;
};
type Operation = { path: string; body: Record<string, unknown> };

const CATEGORY_LABELS: Record<PpeCategory, string> = {
  HEAD: 'Cabeza',
  EYE_FACE: 'Ojos y rostro',
  HEARING: 'Protección auditiva',
  RESPIRATORY: 'Protección respiratoria',
  HAND_ARM: 'Manos y brazos',
  FOOT: 'Pies',
  BODY: 'Cuerpo',
  FALL_PROTECTION: 'Protección contra caídas',
  OTHER: 'Otro',
};
const ISSUE_LABELS: Record<PpeIssue['status'], string> = {
  ISSUED: 'Entregado, pendiente de confirmación',
  IN_SERVICE: 'En servicio',
  REPLACEMENT_DUE: 'Reemplazo requerido',
  REPLACED: 'Reemplazado',
  RETIRED: 'Retirado',
  LOST_DAMAGED: 'Perdido o dañado',
};
const WRITE_ROLES = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
const REVIEW_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.payload.message
    : 'No pudimos completar la operación. Intenta nuevamente.';
}

export function PpeCatalog() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canManage = REVIEW_ROLES.has(organization.currentRole ?? '');
  const catalog = useQuery({
    queryKey: queryKeys.organization.ppeCatalog(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<CatalogResponse>('/ppe/catalog?pageSize=100', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const form = useForm<CatalogForm>({
    defaultValues: {
      name: '',
      category: 'HEAD',
      description: '',
      referenceStandard: '',
      defaultReplacementIntervalDays: '',
    },
  });
  const create = useMutation({
    mutationFn: (values: CatalogForm) =>
      auth.request(
        '/ppe/catalog',
        {
          method: 'POST',
          body: JSON.stringify({
            name: values.name,
            category: values.category,
            ...(values.description ? { description: values.description } : {}),
            ...(values.referenceStandard ? { referenceStandard: values.referenceStandard } : {}),
            ...(values.defaultReplacementIntervalDays
              ? { defaultReplacementIntervalDays: Number(values.defaultReplacementIntervalDays) }
              : {}),
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });

  return (
    <WorkspaceShell className="workforce-shell">
      <WorkspaceHeader
        eyebrow="Operación · Protección personal"
        title="Catálogo de EPP"
        description="Define referencias internas para requisitos y entregas. Este espacio no administra inventario, compras, proveedores ni certificaciones."
      />
      <ContextSummary>
        <span>{catalog.data?.total ?? 0} elementos del catálogo</span>
        <span>Metadatos técnicos informativos</span>
        <span>Sin contenido propietario de normas</span>
      </ContextSummary>
      {canManage ? (
        <WorkspaceSection eyebrow="Catálogo interno" title="Nuevo elemento de EPP">
          <form
            className="workforce-form"
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
          >
            <label className="field">
              <span>Nombre del elemento</span>
              <input {...form.register('name', { required: true, minLength: 2 })} />
            </label>
            <label className="field">
              <span>Categoría</span>
              <select {...form.register('category')}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field workforce-form__wide">
              <span>Descripción interna</span>
              <textarea rows={3} {...form.register('description')} />
            </label>
            <label className="field">
              <span>Referencia técnica (metadato opcional)</span>
              <input {...form.register('referenceStandard')} />
            </label>
            <label className="field">
              <span>Intervalo orientativo de reemplazo (días)</span>
              <input min="1" type="number" {...form.register('defaultReplacementIntervalDays')} />
            </label>
            <div className="workforce-form__actions">
              <button className="button" disabled={create.isPending} type="submit">
                {create.isPending ? 'Guardando…' : 'Agregar al catálogo'}
              </button>
              {create.isError ? <p role="alert">{errorMessage(create.error)}</p> : null}
              {create.isSuccess ? (
                <p role="status">Elemento agregado al catálogo interno.</p>
              ) : null}
            </div>
          </form>
        </WorkspaceSection>
      ) : null}
      <WorkspaceSection eyebrow="Disponibilidad" title="Elementos registrados">
        {catalog.isLoading ? <p role="status">Cargando catálogo…</p> : null}
        {catalog.isError ? (
          <Card role="alert">
            <p>{errorMessage(catalog.error)}</p>
          </Card>
        ) : null}
        <div className="worker-list">
          {(catalog.data?.items ?? []).map((item) => (
            <article className="worker-row" key={item.id}>
              <div>
                <div className="worker-row__title">
                  <h3>{item.name}</h3>
                  <span className="status-badge" data-status={item.status.toLowerCase()}>
                    {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p>
                  {CATEGORY_LABELS[item.category]} ·{' '}
                  {item.description ?? 'Sin descripción adicional'}
                </p>
                <small>
                  {item.referenceStandard
                    ? `Referencia informativa: ${item.referenceStandard}`
                    : 'Sin referencia técnica registrada'}
                  {item.defaultReplacementIntervalDays
                    ? ` · intervalo ${item.defaultReplacementIntervalDays} días`
                    : ''}
                </small>
              </div>
            </article>
          ))}
        </div>
      </WorkspaceSection>
    </WorkspaceShell>
  );
}

export function WorkerPpePanel({
  workerId,
  workerStatus,
}: {
  workerId: string;
  workerStatus: 'ACTIVE' | 'INACTIVE';
}) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '') && workerStatus === 'ACTIVE';
  const canReplace = REVIEW_ROLES.has(organization.currentRole ?? '') && workerStatus === 'ACTIVE';
  const [acknowledgements, setAcknowledgements] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [conditionNotes, setConditionNotes] = useState<Record<string, string>>({});
  const [replacementEvidence, setReplacementEvidence] = useState<Record<string, string>>({});
  const workspace = useQuery({
    queryKey: queryKeys.organization.workerPpe(organizationId ?? 'inactive', workerId),
    queryFn: ({ signal }) =>
      auth.request<WorkerPpeWorkspace>(`/ppe/workers/${workerId}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const catalog = useQuery({
    queryKey: queryKeys.organization.ppeCatalog(organizationId ?? 'inactive', 'status=ACTIVE'),
    queryFn: ({ signal }) =>
      auth.request<CatalogResponse>(
        '/ppe/catalog?status=ACTIVE&pageSize=100',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite),
  });
  const requirementForm = useForm<RequirementForm>({
    defaultValues: { ppeCatalogItemId: '', reason: '' },
  });
  const issueForm = useForm<IssueForm>({
    defaultValues: {
      requirementId: '',
      issuedAt: '',
      expectedReplacementAt: '',
      assetReference: '',
      evidenceNote: '',
    },
  });
  const operation = useMutation({
    mutationFn: ({ path, body }: Operation) =>
      auth.request(path, { method: 'POST', body: JSON.stringify(body) }, organizationId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });
  const run = (path: string, body: Record<string, unknown>, after?: () => void) =>
    operation.mutate({ path, body }, { onSuccess: () => after?.() });
  const requirements = workspace.data?.requirements ?? [];
  const issues = workspace.data?.issues ?? [];
  const required = requirements.filter((item) => item.status === 'REQUIRED');

  return (
    <WorkspaceSection eyebrow="Protección personal" title="EPP" id="epp">
      <p>
        Requisitos profesionales, entregas, condición y reemplazos conservan una historia
        independiente del acceso al SaaS.
      </p>
      {workspace.isLoading ? <p role="status">Cargando historia de EPP…</p> : null}
      {workspace.isError ? (
        <Card role="alert">
          <p>{errorMessage(workspace.error)}</p>
        </Card>
      ) : null}
      {operation.isError ? <p role="alert">{errorMessage(operation.error)}</p> : null}
      {operation.isSuccess ? <p role="status">Cambio de EPP guardado.</p> : null}
      <ContextSummary>
        <span>{required.length} requisitos pendientes</span>
        <span>{issues.filter((item) => item.status === 'IN_SERVICE').length} en servicio</span>
        <span>{issues.filter((item) => item.replacementDue).length} con reemplazo requerido</span>
      </ContextSummary>

      {canWrite ? (
        <form
          className="workforce-form workforce-compact-form"
          onSubmit={requirementForm.handleSubmit((values) =>
            run('/ppe/requirements', { workerId, ...values }, () => requirementForm.reset()),
          )}
        >
          <label className="field">
            <span>Elemento requerido</span>
            <select {...requirementForm.register('ppeCatalogItemId', { required: true })}>
              <option value="">Selecciona del catálogo</option>
              {(catalog.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Motivo profesional del requisito</span>
            <textarea
              rows={2}
              {...requirementForm.register('reason', { required: true, minLength: 3 })}
            />
          </label>
          <button className="button secondary" disabled={operation.isPending} type="submit">
            Añadir requisito de EPP
          </button>
        </form>
      ) : null}

      {canWrite && required.length ? (
        <form
          className="workforce-form workforce-compact-form"
          onSubmit={issueForm.handleSubmit((values) => {
            const requirement = requirements.find((item) => item.id === values.requirementId);
            if (!requirement) return;
            run(
              '/ppe/issues',
              {
                workerId,
                ppeCatalogItemId: requirement.ppeCatalogItem.id,
                requirementId: requirement.id,
                issuedAt: new Date(values.issuedAt).toISOString(),
                ...(values.expectedReplacementAt
                  ? { expectedReplacementAt: new Date(values.expectedReplacementAt).toISOString() }
                  : {}),
                ...(values.assetReference ? { assetReference: values.assetReference } : {}),
                ...(values.evidenceNote ? { evidenceNote: values.evidenceNote } : {}),
              },
              () => issueForm.reset(),
            );
          })}
        >
          <label className="field">
            <span>Requisito a entregar</span>
            <select {...issueForm.register('requirementId', { required: true })}>
              <option value="">Selecciona un requisito</option>
              {required.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.ppeCatalogItem.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha y hora de entrega</span>
            <input type="datetime-local" {...issueForm.register('issuedAt', { required: true })} />
          </label>
          <label className="field">
            <span>Fecha prevista de reemplazo</span>
            <input type="datetime-local" {...issueForm.register('expectedReplacementAt')} />
          </label>
          <label className="field">
            <span>Referencia del elemento</span>
            <input {...issueForm.register('assetReference')} />
          </label>
          <label className="field workforce-form__wide">
            <span>Evidencia narrativa de entrega</span>
            <textarea rows={2} {...issueForm.register('evidenceNote')} />
          </label>
          <button className="button" disabled={operation.isPending} type="submit">
            Registrar entrega de EPP
          </button>
        </form>
      ) : null}

      <div className="worker-list">
        {issues.map((issue) => (
          <article className="incident-action-card" id={`epp-issue-${issue.id}`} key={issue.id}>
            <div className="worker-row__title">
              <h3>{issue.ppeCatalogItem.name}</h3>
              <span className="status-badge" data-status={issue.status.toLowerCase()}>
                {issue.replacementDue && !['REPLACED', 'RETIRED'].includes(issue.status)
                  ? 'Reemplazo requerido'
                  : ISSUE_LABELS[issue.status]}
              </span>
            </div>
            <p>
              Entregado el {new Date(issue.issuedAt).toLocaleDateString('es-EC')}
              {issue.assetReference ? ` · referencia ${issue.assetReference}` : ''}
            </p>
            {issue.evidenceNote ? <small>Evidencia: {issue.evidenceNote}</small> : null}
            {issue.acknowledgementStatus === 'RECORDED' ? (
              <p>Entrega confirmada: {issue.acknowledgementNote}</p>
            ) : null}
            {issue.inspections.map((inspection) => (
              <p key={inspection.id}>
                {new Date(inspection.inspectedAt).toLocaleDateString('es-EC')} ·{' '}
                {inspection.condition === 'SERVICEABLE'
                  ? 'Condición apta'
                  : inspection.condition === 'REVIEW_REQUIRED'
                    ? 'Requiere revisión'
                    : 'No apto para servicio'}
                {inspection.note ? ` · ${inspection.note}` : ''}
              </p>
            ))}
            {issue.replacesIssueId ? (
              <small>
                Esta entrega reemplaza un elemento anterior; ambos registros se conservan.
              </small>
            ) : null}
            {canWrite && issue.acknowledgementStatus === 'PENDING' && issue.status === 'ISSUED' ? (
              <div className="workforce-form workforce-compact-form">
                <label className="field">
                  <span>{`Confirmación de entrega de ${issue.ppeCatalogItem.name}`}</span>
                  <textarea
                    rows={2}
                    value={acknowledgements[issue.id] ?? ''}
                    onChange={(event) =>
                      setAcknowledgements((current) => ({
                        ...current,
                        [issue.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={!acknowledgements[issue.id]?.trim() || operation.isPending}
                  onClick={() =>
                    run(
                      `/ppe/issues/${issue.id}/acknowledge`,
                      { expectedVersion: issue.version, note: acknowledgements[issue.id] },
                      () => setAcknowledgements((current) => ({ ...current, [issue.id]: '' })),
                    )
                  }
                  type="button"
                >
                  Confirmar entrega registrada
                </button>
              </div>
            ) : null}
            {canWrite && !['REPLACED', 'RETIRED'].includes(issue.status) ? (
              <div className="workforce-form workforce-compact-form">
                <label className="field">
                  <span>{`Condición de ${issue.ppeCatalogItem.name}`}</span>
                  <select
                    value={conditions[issue.id] ?? 'SERVICEABLE'}
                    onChange={(event) =>
                      setConditions((current) => ({ ...current, [issue.id]: event.target.value }))
                    }
                  >
                    <option value="SERVICEABLE">Apto para servicio</option>
                    <option value="REVIEW_REQUIRED">Requiere revisión</option>
                    <option value="UNSERVICEABLE">No apto; requiere reemplazo</option>
                  </select>
                </label>
                <label className="field">
                  <span>{`Nota de inspección de ${issue.ppeCatalogItem.name}`}</span>
                  <textarea
                    rows={2}
                    value={conditionNotes[issue.id] ?? ''}
                    onChange={(event) =>
                      setConditionNotes((current) => ({
                        ...current,
                        [issue.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={operation.isPending}
                  onClick={() =>
                    run(
                      `/ppe/issues/${issue.id}/inspect`,
                      {
                        expectedVersion: issue.version,
                        inspectedAt: new Date().toISOString(),
                        condition: conditions[issue.id] ?? 'SERVICEABLE',
                        ...(conditionNotes[issue.id] ? { note: conditionNotes[issue.id] } : {}),
                      },
                      () => setConditionNotes((current) => ({ ...current, [issue.id]: '' })),
                    )
                  }
                  type="button"
                >
                  Registrar inspección de condición
                </button>
              </div>
            ) : null}
            {canReplace && issue.status === 'REPLACEMENT_DUE' ? (
              <div className="workforce-form workforce-compact-form">
                <label className="field">
                  <span>{`Evidencia de reemplazo de ${issue.ppeCatalogItem.name}`}</span>
                  <textarea
                    rows={2}
                    value={replacementEvidence[issue.id] ?? ''}
                    onChange={(event) =>
                      setReplacementEvidence((current) => ({
                        ...current,
                        [issue.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="button"
                  disabled={!replacementEvidence[issue.id]?.trim() || operation.isPending}
                  onClick={() =>
                    run(
                      `/ppe/issues/${issue.id}/replace`,
                      {
                        expectedVersion: issue.version,
                        issuedAt: new Date().toISOString(),
                        evidenceNote: replacementEvidence[issue.id],
                      },
                      () => setReplacementEvidence((current) => ({ ...current, [issue.id]: '' })),
                    )
                  }
                  type="button"
                >
                  Registrar reemplazo
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {!workspace.isLoading && !issues.length ? (
        <p>Aún no hay entregas de EPP para esta persona.</p>
      ) : null}
      {workerStatus === 'INACTIVE' ? (
        <Card>
          <p>
            La persona está inactiva. La historia permanece visible, pero no se permiten nuevas
            asignaciones o reemplazos.
          </p>
        </Card>
      ) : null}
    </WorkspaceSection>
  );
}
