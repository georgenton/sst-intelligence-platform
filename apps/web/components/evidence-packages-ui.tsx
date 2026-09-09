'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextSummary,
  TechnicalDetailsDisclosure,
  WorkspaceHeader,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type ItemType =
  | 'INSPECTION'
  | 'FINDING'
  | 'CORRECTIVE_ACTION'
  | 'ACTION_EVIDENCE'
  | 'TECHNICAL_ASSESSMENT'
  | 'INCIDENT'
  | 'PPE_ISSUE'
  | 'TRAINING_COMPLETION'
  | 'WORK_PERMIT'
  | 'OBLIGATION_EXECUTION'
  | 'GOVERNANCE_MEETING'
  | 'GOVERNANCE_DECISION'
  | 'REGULATORY_UNIT'
  | 'INSPECTION_BASIS_VERSION';
type PackageItem = {
  id: string;
  type: ItemType;
  sourceId: string;
  sourceVersion?: string | null;
  labelSnapshot: string;
  provenance: Record<string, unknown>;
  contentDigest?: string | null;
};
type Manifest = {
  schemaVersion: string;
  generatedAt: string;
  organization: { id: string; name: string };
  package: { id: string; title: string; scope: string; version: number };
  items: Array<{
    type: ItemType;
    sourceId: string;
    sourceVersion?: string | null;
    label: string;
    provenance: Record<string, unknown>;
    contentDigest?: string | null;
  }>;
  representation: string;
  certificationClaimed: false;
};
type EvidencePackage = {
  id: string;
  title: string;
  scope: string;
  status: 'DRAFT' | 'FINALIZED' | 'ARCHIVED';
  version: number;
  generatedAt?: string | null;
  finalizedAt?: string | null;
  manifest?: Manifest | null;
  manifestDigest?: string | null;
  createdBy: { id: string; displayName: string };
  items: PackageItem[];
};
type CanonicalReferenceOption = { id: string; label: string; detail: string };

const WRITE_ROLES = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
const typeLabels: Record<ItemType, string> = {
  INSPECTION: 'Inspección',
  FINDING: 'Hallazgo',
  CORRECTIVE_ACTION: 'Acción correctiva',
  ACTION_EVIDENCE: 'Evidencia de acción',
  TECHNICAL_ASSESSMENT: 'Evaluación de riesgo',
  INCIDENT: 'Incidente',
  PPE_ISSUE: 'Entrega de EPP',
  TRAINING_COMPLETION: 'Capacitación completada',
  WORK_PERMIT: 'Permiso de trabajo',
  OBLIGATION_EXECUTION: 'Actividad u obligación',
  GOVERNANCE_MEETING: 'Reunión de gobernanza',
  GOVERNANCE_DECISION: 'Decisión de gobernanza',
  REGULATORY_UNIT: 'Unidad normativa',
  INSPECTION_BASIS_VERSION: 'Versión de base de inspección',
};
const statusLabels = { DRAFT: 'Borrador', FINALIZED: 'Finalizado', ARCHIVED: 'Archivado' };

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.payload.message;
  return 'No pudimos completar la operación.';
}

function capturedState(provenance: Record<string, unknown>) {
  return typeof provenance.status === 'string' ? provenance.status : null;
}

export function EvidencePackagesWorkspace() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const packages = useQuery({
    queryKey: queryKeys.organization.evidencePackages(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<EvidencePackage[]>('/evidence-packages', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const selected = useMemo(
    () => packages.data?.find(({ id }) => id === selectedId) ?? packages.data?.[0],
    [packages.data, selectedId],
  );
  const createForm = useForm<{ title: string; scope: string }>({
    defaultValues: { title: '', scope: '' },
  });
  const itemForm = useForm<{ type: ItemType; sourceId: string }>({
    defaultValues: { type: 'INSPECTION', sourceId: '' },
  });
  const selectedType = useWatch({ control: itemForm.control, name: 'type' });
  const references = useQuery({
    queryKey: queryKeys.organization.evidencePackageReferences(
      organizationId ?? 'inactive',
      selectedType,
    ),
    queryFn: ({ signal }) =>
      auth.request<CanonicalReferenceOption[]>(
        `/evidence-packages/references/${selectedType}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && canWrite && selected?.status === 'DRAFT'),
  });

  async function refresh() {
    if (!organizationId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.organization.evidencePackages(organizationId),
    });
  }

  const operation = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      auth.request(
        path,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
        organizationId!,
      ),
    onSuccess: async () => {
      setError('');
      setNotice('Paquete actualizado.');
      await refresh();
    },
    onError: (cause) => {
      setNotice('');
      setError(errorMessage(cause));
    },
  });
  const createPackage = createForm.handleSubmit(async (body) => {
    const result = (await operation.mutateAsync({
      path: '/evidence-packages',
      body,
    })) as EvidencePackage;
    setSelectedId(result.id);
    createForm.reset();
  });
  const addItem = itemForm.handleSubmit(async (body) => {
    if (!selected) return;
    await operation.mutateAsync({ path: `/evidence-packages/${selected.id}/items`, body });
    itemForm.reset({ type: 'INSPECTION', sourceId: '' });
  });

  return (
    <WorkspaceShell className="evidence-packages-workspace">
      <WorkspaceHeader
        eyebrow="Gestión documental"
        title="Paquetes de evidencia"
        description="Agrupa referencias canónicas en un resumen documental trazable, sin certificar cumplimiento ni reemplazar los registros fuente."
        context={
          <ContextSummary>
            <span>El manifiesto final conserva el estado capturado al finalizar.</span>
            <span>Las fuentes canónicas permanecen autoritativas.</span>
          </ContextSummary>
        }
        actions={
          selected?.status === 'FINALIZED' ? (
            <Button type="button" onClick={() => window.print()}>
              Imprimir resumen
            </Button>
          ) : undefined
        }
      />
      {notice ? (
        <p role="status" className="form-success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <WorkspaceMain>
        <WorkspaceSection
          title="Paquetes"
          eyebrow="Inventario"
          description="Finalizar congela el manifiesto; una regeneración requiere un paquete nuevo."
        >
          <div className="dashboard-grid">
            {packages.data?.map((item) => (
              <button
                type="button"
                className="record-button"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selected?.id === item.id}
              >
                <strong>{item.title}</strong>
                <span>
                  {statusLabels[item.status]} · {item.items.length} referencia(s)
                </span>
              </button>
            ))}
          </div>
          {canWrite ? (
            <form className="stack-form" onSubmit={createPackage}>
              <label>
                Título
                <input {...createForm.register('title', { required: true })} />
              </label>
              <label>
                Alcance
                <textarea {...createForm.register('scope', { required: true })} />
              </label>
              <Button type="submit" disabled={operation.isPending}>
                Crear paquete
              </Button>
            </form>
          ) : null}
        </WorkspaceSection>

        {selected ? (
          <WorkspaceSection
            title={selected.title}
            eyebrow="Resumen documental"
            description={selected.scope}
            actions={<StatusBadge>{statusLabels[selected.status]}</StatusBadge>}
          >
            {canWrite && selected.status === 'DRAFT' ? (
              <form className="stack-form" onSubmit={addItem}>
                <label>
                  Tipo de registro
                  <select
                    {...itemForm.register('type', {
                      onChange: () => itemForm.setValue('sourceId', ''),
                    })}
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Registro fuente
                  <select {...itemForm.register('sourceId', { required: true })}>
                    <option value="">Selecciona un registro</option>
                    {references.data?.map((reference) => (
                      <option key={reference.id} value={reference.id}>
                        {reference.label}
                      </option>
                    ))}
                  </select>
                </label>
                {references.isSuccess && !references.data.length ? (
                  <p className="muted-copy" role="status">
                    No hay registros disponibles de este tipo en la organización activa.
                  </p>
                ) : null}
                <p className="muted-copy">
                  El servidor comprueba que el registro pertenece a la organización activa. Las
                  unidades normativas son referencias globales revisables.
                </p>
                <Button type="submit" disabled={operation.isPending}>
                  Agregar referencia
                </Button>
              </form>
            ) : null}
            <div className="stack-list">
              {selected.items.map((item) => (
                <Card key={item.id}>
                  <div className="record-heading">
                    <strong>{item.labelSnapshot}</strong>
                    <span>{typeLabels[item.type]}</span>
                  </div>
                  <p>Versión o corte: {item.sourceVersion ?? 'Identidad canónica'}</p>
                  {capturedState(item.provenance) ? (
                    <p>Estado capturado: {capturedState(item.provenance)}</p>
                  ) : null}
                  {item.contentDigest ? (
                    <p>
                      Digest de contenido: <code>{item.contentDigest}</code>
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
            {selected.status === 'DRAFT' && canWrite ? (
              <Button
                type="button"
                disabled={!selected.items.length || operation.isPending}
                onClick={() =>
                  operation.mutate({ path: `/evidence-packages/${selected.id}/finalize` })
                }
              >
                Finalizar manifiesto
              </Button>
            ) : null}
            {selected.status === 'FINALIZED' && canWrite ? (
              <Button
                type="button"
                disabled={operation.isPending}
                onClick={() =>
                  operation.mutate({ path: `/evidence-packages/${selected.id}/archive` })
                }
              >
                Archivar
              </Button>
            ) : null}
            {selected.manifest ? (
              <section className="print-report" aria-label="Representación imprimible del paquete">
                <h3>Paquete de evidencia</h3>
                <p>{selected.manifest.representation}</p>
                <dl>
                  <div>
                    <dt>Organización</dt>
                    <dd>{selected.manifest.organization.name}</dd>
                  </div>
                  <div>
                    <dt>Generado</dt>
                    <dd>{new Date(selected.manifest.generatedAt).toLocaleString('es-EC')}</dd>
                  </div>
                  <div>
                    <dt>Digest del manifiesto</dt>
                    <dd>
                      <code>{selected.manifestDigest}</code>
                    </dd>
                  </div>
                </dl>
                <h4>Referencias incluidas</h4>
                <ol>
                  {selected.manifest.items.map((item) => (
                    <li key={`${item.type}:${item.sourceId}`}>
                      <strong>{typeLabels[item.type]}</strong> · {item.label}
                      {capturedState(item.provenance) ? (
                        <>
                          <br />
                          <small>Estado capturado: {capturedState(item.provenance)}</small>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p>
                  <strong>
                    Este resumen no declara empresa certificada, cumplimiento legal garantizado ni
                    auditoría aprobada.
                  </strong>
                </p>
              </section>
            ) : null}
            <TechnicalDetailsDisclosure summary="Separación de procedencia para inspecciones">
              <p>
                Base técnica, fundamento normativo, método de riesgo y evidencia se conservan como
                referencias diferenciadas; el paquete no las aplana en una conclusión legal.
              </p>
            </TechnicalDetailsDisclosure>
          </WorkspaceSection>
        ) : null}
      </WorkspaceMain>
    </WorkspaceShell>
  );
}
