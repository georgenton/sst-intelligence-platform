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
  referenceJurisdiction?: string | null;
  referenceProvenance?: string | null;
  referenceReviewStatus?: 'PENDING_PROFESSIONAL_REVIEW' | 'REVIEWED' | 'REJECTED' | null;
  defaultReplacementIntervalDays?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
};
type CatalogResponse = { items: CatalogItem[]; total: number };
type Position = {
  id: string;
  name: string;
  riskContexts: Array<{ id: string; category: string; description: string }>;
};
type PositionCandidates = {
  position: Position;
  categories: PpeCategory[];
  suggestions: Array<{
    risk: { id: string; category: string; description: string };
    categories: PpeCategory[];
  }>;
  catalogItems: CatalogItem[];
  decisionBoundary: string;
};
type PositionRequirement = {
  id: string;
  reason: string;
  decision: 'SELECTED_BY_PROFESSIONAL' | 'REQUIRED_INTERNALLY';
  position: { id: string; name: string };
  ppeCatalogItem: CatalogItem;
};
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
  worker: {
    id: string;
    displayName: string;
    status: 'ACTIVE' | 'INACTIVE';
    positionId?: string | null;
    position?: { id: string; name: string } | null;
  };
  requirements: PpeRequirement[];
  issues: PpeIssue[];
};
type CatalogForm = {
  name: string;
  category: PpeCategory;
  description: string;
  referenceStandard: string;
  referenceJurisdiction: string;
  referenceProvenance: string;
  referenceReviewStatus: 'PENDING_PROFESSIONAL_REVIEW' | 'REVIEWED' | 'REJECTED';
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
type IncidentList = { items: Array<{ id: string; title: string; status: string }> };
type ReplacementReason = 'EXPIRY' | 'WEAR' | 'DAMAGE' | 'LOSS' | 'OTHER_JUSTIFIED';

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
const REPLACEMENT_REASON_LABELS: Record<ReplacementReason, string> = {
  EXPIRY: 'Vencimiento',
  WEAR: 'Desgaste',
  DAMAGE: 'Daño',
  LOSS: 'Pérdida',
  OTHER_JUSTIFIED: 'Otra razón justificada',
};

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
  const [positionId, setPositionId] = useState('');
  const [riskContextId, setRiskContextId] = useState('');
  const [riskCategory, setRiskCategory] = useState('ELECTRICAL');
  const [riskDescription, setRiskDescription] = useState('');
  const catalog = useQuery({
    queryKey: queryKeys.organization.ppeCatalog(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<CatalogResponse>('/ppe/catalog?pageSize=100', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const positions = useQuery({
    queryKey: queryKeys.organization.positions(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Position[]>('/workers/positions', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const positionRequirements = useQuery({
    queryKey: queryKeys.organization.positionPpeRequirements(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<PositionRequirement[]>(
        '/ppe/position-requirements',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const candidates = useQuery({
    queryKey: [
      ...queryKeys.organization.positions(organizationId ?? 'inactive'),
      positionId,
      'ppe-candidates',
    ],
    queryFn: ({ signal }) =>
      auth.request<PositionCandidates>(
        `/workers/positions/${positionId}/ppe-candidates`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && positionId),
  });
  const form = useForm<CatalogForm>({
    defaultValues: {
      name: '',
      category: 'HEAD',
      description: '',
      referenceStandard: '',
      referenceJurisdiction: '',
      referenceProvenance: '',
      referenceReviewStatus: 'PENDING_PROFESSIONAL_REVIEW',
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
            ...(values.referenceJurisdiction
              ? { referenceJurisdiction: values.referenceJurisdiction }
              : {}),
            ...(values.referenceProvenance
              ? { referenceProvenance: values.referenceProvenance }
              : {}),
            referenceReviewStatus: values.referenceReviewStatus,
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
  const addRisk = useMutation({
    mutationFn: () =>
      auth.request(
        `/workers/positions/${positionId}/risks`,
        {
          method: 'POST',
          body: JSON.stringify({ category: riskCategory, description: riskDescription }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      setRiskDescription('');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId!),
      });
    },
  });
  const selectRequirement = useMutation({
    mutationFn: (item: CatalogItem) =>
      auth.request(
        '/ppe/position-requirements',
        {
          method: 'POST',
          body: JSON.stringify({
            positionId,
            riskContextId,
            ppeCatalogItemId: item.id,
            reason: `Selección profesional para ${candidates.data?.position.name ?? 'el cargo'}.`,
            decision: 'SELECTED_BY_PROFESSIONAL',
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
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

      <WorkspaceSection
        eyebrow="Cargo → riesgo → EPP"
        title="Selección profesional"
        description="El motor propone categorías de forma determinística; la selección y el requisito interno siempre requieren decisión humana autorizada."
      >
        <label className="field">
          <span>Cargo</span>
          <select
            value={positionId}
            onChange={(event) => {
              setPositionId(event.target.value);
              setRiskContextId('');
            }}
          >
            <option value="">Selecciona un cargo</option>
            {(positions.data ?? []).map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </label>
        {canManage && positionId ? (
          <div className="workforce-form workforce-compact-form">
            <label className="field">
              <span>Categoría de riesgo</span>
              <select
                value={riskCategory}
                onChange={(event) => setRiskCategory(event.target.value)}
              >
                <option value="ELECTRICAL">Eléctrico</option>
                <option value="ARC_FLASH">Arco eléctrico</option>
                <option value="PROJECTION">Proyección</option>
                <option value="MECHANICAL">Mecánico</option>
                <option value="ERGONOMIC">Ergonómico</option>
                <option value="CHEMICAL">Químico</option>
                <option value="BIOLOGICAL">Biológico</option>
                <option value="PHYSICAL">Físico</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
            <label className="field">
              <span>Descripción del riesgo</span>
              <input
                value={riskDescription}
                onChange={(event) => setRiskDescription(event.target.value)}
              />
            </label>
            <button
              className="button secondary"
              type="button"
              disabled={!riskDescription.trim() || addRisk.isPending}
              onClick={() => addRisk.mutate()}
            >
              Agregar riesgo
            </button>
          </div>
        ) : null}
        {candidates.data ? <p>{candidates.data.decisionBoundary}</p> : null}
        {candidates.data?.suggestions.length ? (
          <label className="field">
            <span>Riesgo que sustenta la selección</span>
            <select
              value={riskContextId}
              onChange={(event) => setRiskContextId(event.target.value)}
            >
              <option value="">Selecciona un riesgo registrado</option>
              {candidates.data.suggestions.map(({ risk }) => (
                <option key={risk.id} value={risk.id}>
                  {risk.category} · {risk.description}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="card-grid">
          {(candidates.data?.catalogItems ?? [])
            .filter((item) => {
              if (!riskContextId) return false;
              const selected = candidates.data?.suggestions.find(
                ({ risk }) => risk.id === riskContextId,
              );
              return selected?.categories.includes(item.category);
            })
            .map((item) => (
              <Card key={item.id}>
                <h3>{item.name}</h3>
                <p>{CATEGORY_LABELS[item.category]}</p>
                {canManage ? (
                  <button
                    className="button"
                    type="button"
                    disabled={!riskContextId || selectRequirement.isPending}
                    onClick={() => selectRequirement.mutate(item)}
                  >
                    Seleccionar profesionalmente
                  </button>
                ) : null}
              </Card>
            ))}
        </div>
        <p>{positionRequirements.data?.length ?? 0} requisitos por cargo seleccionados.</p>
      </WorkspaceSection>
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
              <span>Jurisdicción o contexto de la referencia</span>
              <input {...form.register('referenceJurisdiction')} />
            </label>
            <label className="field workforce-form__wide">
              <span>Proveniencia verificable de la referencia</span>
              <textarea rows={2} {...form.register('referenceProvenance')} />
            </label>
            <label className="field">
              <span>Estado de revisión profesional</span>
              <select {...form.register('referenceReviewStatus')}>
                <option value="PENDING_PROFESSIONAL_REVIEW">Pendiente de revisión</option>
                <option value="REVIEWED">Revisada</option>
                <option value="REJECTED">Descartada</option>
              </select>
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
                {item.referenceJurisdiction ? (
                  <small>Contexto de referencia: {item.referenceJurisdiction}</small>
                ) : null}
                {item.referenceProvenance ? (
                  <small>Proveniencia: {item.referenceProvenance}</small>
                ) : null}
                {item.referenceReviewStatus ? (
                  <small>
                    Revisión:{' '}
                    {item.referenceReviewStatus === 'REVIEWED'
                      ? 'revisada profesionalmente'
                      : item.referenceReviewStatus === 'REJECTED'
                        ? 'descartada'
                        : 'pendiente de revisión profesional'}
                  </small>
                ) : null}
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
  const [replacementReasons, setReplacementReasons] = useState<Record<string, ReplacementReason>>(
    {},
  );
  const [replacementReasonNotes, setReplacementReasonNotes] = useState<Record<string, string>>({});
  const [replacementIncidentIds, setReplacementIncidentIds] = useState<Record<string, string>>({});
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
  const positionRequirements = useQuery({
    queryKey: queryKeys.organization.positionPpeRequirements(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<PositionRequirement[]>(
        '/ppe/position-requirements',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite),
  });
  const incidents = useQuery({
    queryKey: queryKeys.organization.incidents(organizationId ?? 'inactive', 'ppe-link'),
    queryFn: ({ signal }) =>
      auth.request<IncidentList>('/incidents?pageSize=100', { signal }, organizationId!),
    enabled: Boolean(organizationId && canReplace),
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

      {canWrite && workspace.data?.worker.positionId ? (
        <div className="card-grid">
          {(positionRequirements.data ?? [])
            .filter(
              (item) =>
                item.position.id === workspace.data?.worker.positionId &&
                !requirements.some(
                  (requirement) =>
                    requirement.ppeCatalogItem.id === item.ppeCatalogItem.id &&
                    requirement.status !== 'CANCELLED',
                ),
            )
            .map((item) => (
              <Card key={item.id}>
                <p className="eyebrow">Requisito del cargo {item.position.name}</p>
                <h3>{item.ppeCatalogItem.name}</h3>
                <p>{item.reason}</p>
                <button
                  className="button secondary"
                  type="button"
                  disabled={operation.isPending}
                  onClick={() =>
                    run('/ppe/requirements', {
                      workerId,
                      ppeCatalogItemId: item.ppeCatalogItem.id,
                      positionRequirementId: item.id,
                      reason: `Aplicación profesional del requisito vigente para ${item.position.name}.`,
                    })
                  }
                >
                  Asignar requisito al trabajador
                </button>
              </Card>
            ))}
        </div>
      ) : null}

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
                  <span>{`Razón de reemplazo de ${issue.ppeCatalogItem.name}`}</span>
                  <select
                    value={replacementReasons[issue.id] ?? 'WEAR'}
                    onChange={(event) =>
                      setReplacementReasons((current) => ({
                        ...current,
                        [issue.id]: event.target.value as ReplacementReason,
                      }))
                    }
                  >
                    {Object.entries(REPLACEMENT_REASON_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{`Justificación del reemplazo de ${issue.ppeCatalogItem.name}`}</span>
                  <textarea
                    rows={2}
                    value={replacementReasonNotes[issue.id] ?? ''}
                    onChange={(event) =>
                      setReplacementReasonNotes((current) => ({
                        ...current,
                        [issue.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                {(replacementReasons[issue.id] ?? 'WEAR') === 'DAMAGE' ? (
                  <label className="field">
                    <span>Accidente o incidente relacionado (opcional)</span>
                    <select
                      value={replacementIncidentIds[issue.id] ?? ''}
                      onChange={(event) =>
                        setReplacementIncidentIds((current) => ({
                          ...current,
                          [issue.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">No vincular; no se crea un incidente automáticamente</option>
                      {(incidents.data?.items ?? []).map((incident) => (
                        <option key={incident.id} value={incident.id}>
                          {incident.title} · {incident.status}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
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
                        reason: replacementReasons[issue.id] ?? 'WEAR',
                        ...(replacementReasonNotes[issue.id]?.trim()
                          ? { reasonNote: replacementReasonNotes[issue.id]!.trim() }
                          : {}),
                        ...(replacementIncidentIds[issue.id]
                          ? { linkedIncidentId: replacementIncidentIds[issue.id] }
                          : {}),
                      },
                      () => {
                        setReplacementEvidence((current) => ({ ...current, [issue.id]: '' }));
                        setReplacementReasonNotes((current) => ({ ...current, [issue.id]: '' }));
                        setReplacementIncidentIds((current) => ({ ...current, [issue.id]: '' }));
                      },
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
