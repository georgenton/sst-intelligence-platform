'use client';

import { Card } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import {
  ISSUE_LABELS,
  REPLACEMENT_REASON_LABELS,
  REVIEW_ROLES,
  WRITE_ROLES,
  ppeDate,
  ppeScope,
  type CatalogItem,
  type IncidentChoice,
  type PpeIssue,
  type PpeRequirement,
  type PositionRequirement,
  type WorkerPpeWorkspace,
} from '@/lib/ppe-presentation';
import { useOrganization } from './app-shell';
import {
  CatalogChoiceSummary,
  PpeCommandFeedback,
  PpeDialog,
  PpeFlow,
  PpeSubmit,
  usePpeApi,
  usePpeCommand,
} from './ppe-experience-ui';
import { PpeServerSelection as ServerSelection } from './ppe-server-selection';
import { ApplyPositionRequirement } from './ppe-positions-experience';
import { WorkspaceSection } from './workspace';
import styles from './ppe.module.css';

export function WorkerPpePanel({
  workerId,
  workerStatus,
}: {
  workerId: string;
  workerStatus: 'ACTIVE' | 'INACTIVE';
}) {
  const organization = useOrganization();
  if (!organization.activeId || organization.transitioning)
    return <p>Consultando el contexto de la organización…</p>;
  return (
    <PpeFlow>
      <WorkerPpeExperience
        key={`${organization.activeId}:${workerId}`}
        workerId={workerId}
        workerStatus={workerStatus}
      />
    </PpeFlow>
  );
}

function WorkerPpeExperience({
  workerId,
  workerStatus,
}: {
  workerId: string;
  workerStatus: 'ACTIVE' | 'INACTIVE';
}) {
  const api = usePpeApi();
  const workspace = useQuery({
    queryKey: queryKeys.organization.workerPpe(api.organizationId, workerId),
    queryFn: ({ signal }) =>
      api.request<WorkerPpeWorkspace>(`/ppe/workers/${workerId}`, { signal }),
  });
  const positionRequirements = useQuery({
    queryKey: queryKeys.organization.positionPpeRequirements(api.organizationId),
    queryFn: ({ signal }) =>
      api.request<PositionRequirement[]>('/ppe/position-requirements', { signal }),
    enabled: Boolean(workspace.data?.worker.positionId),
    // A position decision can be created immediately before opening a worker
    // workspace. Always refresh this shared list on mount so a cached empty
    // result never hides a newly persisted decision from the continuity flow.
    refetchOnMount: 'always',
  });
  const [dialog, setDialog] = useState<
    | { type: 'requirement' }
    | { type: 'position'; requirement: PositionRequirement }
    | { type: 'delivery'; requirement: PpeRequirement }
    | { type: 'ack'; issue: PpeIssue }
    | { type: 'condition'; issue: PpeIssue }
    | { type: 'replacement'; issue: PpeIssue }
    | null
  >(null);
  const canWrite = WRITE_ROLES.has(api.role) && workerStatus === 'ACTIVE';
  const canReplace = REVIEW_ROLES.has(api.role) && workerStatus === 'ACTIVE';
  if (workspace.isPending)
    return (
      <WorkspaceSection title="Protección personal">
        <p role="status">Cargando historia de EPP…</p>
      </WorkspaceSection>
    );
  if (workspace.isError || !workspace.data)
    return (
      <WorkspaceSection title="Protección personal">
        <div role="alert" className={styles.warning}>
          <p>No pudimos cargar la historia de EPP.</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => void workspace.refetch()}
          >
            Reintentar
          </button>
        </div>
      </WorkspaceSection>
    );
  const { worker, requirements, issues } = workspace.data;
  const pending = requirements.filter((item) => item.status === 'REQUIRED');
  const assignedPositionRequirementIds = new Set(
    requirements
      .filter((item) => item.status !== 'CANCELLED' && item.positionRequirementId)
      .map((item) => item.positionRequirementId),
  );
  const availablePositionRequirements = (positionRequirements.data ?? []).filter(
    (item) =>
      item.position.id === worker.positionId && !assignedPositionRequirementIds.has(item.id),
  );
  const inService = issues.filter((item) => item.status === 'IN_SERVICE').length;
  const attention = issues.filter((item) => item.replacementDue).length;
  return (
    <WorkspaceSection eyebrow="Protección personal" title="Protección de la persona" id="epp">
      <div className={styles.context}>
        <strong>{worker.displayName}</strong>
        <p>
          {worker.position?.name ?? 'Sin cargo registrado'} ·{' '}
          {worker.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </p>
        <p>
          {pending.length} requisitos pendientes · {inService} en servicio · {attention} requieren
          atención
        </p>
      </div>
      {canWrite ? (
        <button
          type="button"
          className="button secondary"
          onClick={() => setDialog({ type: 'requirement' })}
        >
          Añadir requisito
        </button>
      ) : null}
      {workerStatus === 'INACTIVE' ? (
        <Card>
          <p>
            La persona está inactiva. La historia permanece visible; no se permiten nuevas
            asignaciones o reemplazos.
          </p>
        </Card>
      ) : null}

      {canWrite && positionRequirements.isPending ? (
        <p role="status">Consultando decisiones del cargo…</p>
      ) : null}
      {canWrite && positionRequirements.isError ? (
        <div role="alert" className={styles.warning}>
          <p>No pudimos cargar las decisiones del cargo.</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => void positionRequirements.refetch()}
          >
            Reintentar decisiones
          </button>
        </div>
      ) : null}
      {canWrite &&
      !positionRequirements.isPending &&
      !positionRequirements.isError &&
      availablePositionRequirements.length ? (
        <section className={styles.stack} aria-labelledby={`decisions-${workerId}`}>
          <h3 id={`decisions-${workerId}`}>Decisiones del cargo</h3>
          <p>
            Estas decisiones profesionales pueden aplicarse a esta persona. La asignación sigue
            requiriendo una confirmación humana.
          </p>
          {availablePositionRequirements.map((requirement) => (
            <article key={requirement.id} className={styles.row}>
              <div>
                <strong>{requirement.ppeCatalogItem.name}</strong>
                <p>{requirement.reason}</p>
                <small>
                  {requirement.position.name} · {ppeScope(requirement)}
                </small>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog({ type: 'position', requirement })}
              >
                Aplicar requisito a esta persona
              </button>
            </article>
          ))}
        </section>
      ) : null}

      <section className={styles.stack} aria-labelledby={`pending-${workerId}`}>
        <h3 id={`pending-${workerId}`}>Requisitos pendientes</h3>
        {pending.length ? (
          <ul className={styles.list}>
            {pending.map((requirement) => (
              <li key={requirement.id} className={styles.row}>
                <div>
                  <strong>{requirement.ppeCatalogItem.name}</strong>
                  <p>{requirement.reason}</p>
                  <small>
                    {requirement.positionRequirement
                      ? `${requirement.positionRequirement.position.name} · ${ppeScope(requirement.positionRequirement)}`
                      : 'Origen registrado en la persona'}
                  </small>
                </div>
                {canWrite ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setDialog({ type: 'delivery', requirement })}
                  >
                    Preparar entrega
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay requisitos pendientes.</p>
        )}
      </section>

      <section className={styles.stack} aria-labelledby={`current-${workerId}`}>
        <h3 id={`current-${workerId}`}>Protección actual e historia</h3>
        {issues.length ? (
          <div className={styles.stack}>
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                canWrite={canWrite}
                canReplace={canReplace}
                onAction={setDialog}
              />
            ))}
          </div>
        ) : (
          <p>Aún no hay entregas de EPP para esta persona.</p>
        )}
      </section>
      {dialog?.type === 'requirement' ? (
        <RequirementDialog
          api={api}
          workerId={workerId}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void workspace.refetch();
          }}
        />
      ) : null}
      {dialog?.type === 'position' ? (
        <ApplyPositionRequirement
          api={api}
          requirement={dialog.requirement}
          worker={{
            id: worker.id,
            displayName: worker.displayName,
            status: worker.status,
            position: worker.position,
          }}
          onClose={() => setDialog(null)}
          onApplied={() => {
            setDialog(null);
            void workspace.refetch();
            void positionRequirements.refetch();
          }}
        />
      ) : null}
      {dialog?.type === 'delivery' ? (
        <DeliveryDialog
          api={api}
          workerId={workerId}
          requirement={dialog.requirement}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void workspace.refetch();
          }}
        />
      ) : null}
      {dialog?.type === 'ack' ? (
        <AcknowledgementDialog
          api={api}
          issue={dialog.issue}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void workspace.refetch();
          }}
        />
      ) : null}
      {dialog?.type === 'condition' ? (
        <ConditionDialog
          api={api}
          issue={dialog.issue}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void workspace.refetch();
          }}
        />
      ) : null}
      {dialog?.type === 'replacement' ? (
        <ReplacementDialog
          api={api}
          issue={dialog.issue}
          workerId={workerId}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void workspace.refetch();
          }}
        />
      ) : null}
    </WorkspaceSection>
  );
}

function IssueCard({
  issue,
  canWrite,
  canReplace,
  onAction,
}: {
  issue: PpeIssue;
  canWrite: boolean;
  canReplace: boolean;
  onAction: (
    value:
      | { type: 'ack'; issue: PpeIssue }
      | { type: 'condition'; issue: PpeIssue }
      | { type: 'replacement'; issue: PpeIssue },
  ) => void;
}) {
  const historical = ['REPLACED', 'RETIRED'].includes(issue.status);
  return (
    <article
      className={`${styles.selected} ${styles.issue}`}
      id={`epp-issue-${issue.id}`}
      tabIndex={-1}
    >
      <div className={styles.row}>
        <div>
          <strong>{issue.ppeCatalogItem.name}</strong>
          <p>
            {ISSUE_LABELS[issue.status]} · entregado {ppeDate(issue.issuedAt)}
          </p>
        </div>
        <span
          className={styles.badge}
          data-tone={
            issue.replacementDue ? 'danger' : issue.status === 'IN_SERVICE' ? 'success' : 'warning'
          }
        >
          {issue.replacementDue && !historical ? 'Reemplazo requerido' : ISSUE_LABELS[issue.status]}
        </span>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Actor de entrega</dt>
          <dd>{issue.issuedBy?.displayName ?? 'Sin registro'}</dd>
        </div>
        <div>
          <dt>Referencia</dt>
          <dd>{issue.assetReference ?? 'Sin registro'}</dd>
        </div>
        <div>
          <dt>Evidencia</dt>
          <dd>{issue.evidenceNote ?? issue.evidenceUrl ?? 'Sin evidencia registrada'}</dd>
        </div>
        <div>
          <dt>Condición más reciente</dt>
          <dd>
            {issue.inspections[0]
              ? `${issue.inspections[0].condition} · ${ppeDate(issue.inspections[0].inspectedAt)}`
              : 'Sin revisión registrada'}
          </dd>
        </div>
      </dl>
      {issue.replacesIssue ? (
        <p>
          Reemplaza una entrega anterior de {ppeDate(issue.replacesIssue.issuedAt)}. El registro
          anterior permanece en la historia.
        </p>
      ) : null}
      {issue.replacementIssue ? (
        <p>
          Fue reemplazado por una entrega posterior de {ppeDate(issue.replacementIssue.issuedAt)}.
        </p>
      ) : null}
      {issue.incidentLinks.length ? (
        <p>
          Incidente relacionado: {issue.incidentLinks.map((link) => link.incident.title).join(', ')}
        </p>
      ) : null}
      {!historical && canWrite ? (
        <div className={styles.actions}>
          {issue.acknowledgementStatus === 'PENDING' && issue.status === 'ISSUED' ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => onAction({ type: 'ack', issue })}
            >
              Confirmar entrega
            </button>
          ) : null}
          {!['REPLACED', 'RETIRED'].includes(issue.status) ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => onAction({ type: 'condition', issue })}
            >
              Revisar condición
            </button>
          ) : null}
          {canReplace && issue.replacementDue ? (
            <button
              type="button"
              className="button"
              onClick={() => onAction({ type: 'replacement', issue })}
            >
              Preparar reemplazo
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function RequirementDialog({
  api,
  workerId,
  onClose,
  onSaved,
}: {
  api: ReturnType<typeof usePpeApi>;
  workerId: string;
  onClose(): void;
  onSaved(): void;
}) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const form = useForm<{ reason: string }>({ defaultValues: { reason: '' } });
  const command = usePpeCommand(api, 'Requisito registrado.', onSaved);
  return (
    <PpeDialog
      title="Añadir requisito de EPP"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <ServerSelection<CatalogItem>
        api={api}
        path="/ppe/catalog"
        filters={{ status: 'ACTIVE' }}
        label="Buscar elemento"
        selected={item}
        onSelect={setItem}
        name={(row) => row.name}
        detail={(row) => <CatalogChoiceSummary item={row} />}
      />
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit(
          (values) =>
            item &&
            command.run('/ppe/requirements', {
              workerId,
              ppeCatalogItemId: item.id,
              reason: values.reason.trim(),
            }),
        )}
      >
        <label className="field">
          <span>Motivo del requisito</span>
          <textarea
            required
            minLength={3}
            maxLength={2000}
            {...form.register('reason', { required: true, minLength: 3 })}
          />
        </label>
        <PpeCommandFeedback command={command} />
        <PpeSubmit command={command}>Registrar requisito</PpeSubmit>
      </form>
    </PpeDialog>
  );
}

function DeliveryDialog({
  api,
  workerId,
  requirement,
  onClose,
  onSaved,
}: {
  api: ReturnType<typeof usePpeApi>;
  workerId: string;
  requirement: PpeRequirement;
  onClose(): void;
  onSaved(): void;
}) {
  const form = useForm<{
    issuedAt: string;
    expectedReplacementAt: string;
    assetReference: string;
    evidenceNote: string;
    evidenceUrl: string;
  }>({
    defaultValues: {
      issuedAt: '',
      expectedReplacementAt: '',
      assetReference: '',
      evidenceNote: '',
      evidenceUrl: '',
    },
  });
  const command = usePpeCommand(api, 'Entrega registrada. Confirmación pendiente.', onSaved);
  const note = form.watch('evidenceNote');
  const url = form.watch('evidenceUrl');
  return (
    <PpeDialog
      title="Preparar entrega"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <div className={styles.context}>
        <strong>{requirement.ppeCatalogItem.name}</strong>
        <p>Persona: requisito ya seleccionado; solo completa los datos de entrega.</p>
      </div>
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit((values) =>
          command.run('/ppe/issues', {
            workerId,
            ppeCatalogItemId: requirement.ppeCatalogItem.id,
            requirementId: requirement.id,
            issuedAt: new Date(values.issuedAt).toISOString(),
            ...(values.expectedReplacementAt
              ? { expectedReplacementAt: new Date(values.expectedReplacementAt).toISOString() }
              : {}),
            ...(values.assetReference.trim()
              ? { assetReference: values.assetReference.trim() }
              : {}),
            ...(values.evidenceNote.trim() ? { evidenceNote: values.evidenceNote.trim() } : {}),
            ...(values.evidenceUrl.trim() ? { evidenceUrl: values.evidenceUrl.trim() } : {}),
          }),
        )}
      >
        <label className="field">
          <span>Fecha y hora de entrega</span>
          <input
            type="datetime-local"
            required
            {...form.register('issuedAt', { required: true })}
          />
        </label>
        <label className="field">
          <span>Fecha prevista de reemplazo (opcional)</span>
          <input type="datetime-local" {...form.register('expectedReplacementAt')} />
        </label>
        <label className="field">
          <span>Referencia del elemento (opcional)</span>
          <input maxLength={160} {...form.register('assetReference')} />
        </label>
        <fieldset className={styles.fieldset}>
          <legend>Evidencia: elige una opción</legend>
          <label className="field">
            <span>Nota</span>
            <textarea disabled={Boolean(url)} maxLength={2000} {...form.register('evidenceNote')} />
          </label>
          <label className="field">
            <span>Enlace HTTPS</span>
            <input
              disabled={Boolean(note)}
              type="url"
              placeholder="https://"
              {...form.register('evidenceUrl', { pattern: /^https:\/\//i })}
            />
          </label>
          <p>La evidencia es opcional; si la registras, usa una nota o un enlace HTTPS.</p>
        </fieldset>
        <PpeCommandFeedback command={command} />
        <PpeSubmit command={command}>Registrar entrega</PpeSubmit>
      </form>
    </PpeDialog>
  );
}

function AcknowledgementDialog({
  api,
  issue,
  onClose,
  onSaved,
}: {
  api: ReturnType<typeof usePpeApi>;
  issue: PpeIssue;
  onClose(): void;
  onSaved(): void;
}) {
  const form = useForm<{ note: string }>({ defaultValues: { note: '' } });
  const command = usePpeCommand(api, 'Entrega confirmada. El elemento está en servicio.', onSaved);
  return (
    <PpeDialog
      title="Confirmar entrega"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <p>{issue.ppeCatalogItem.name} · confirmación humana requerida.</p>
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit((values) =>
          command.run(`/ppe/issues/${issue.id}/acknowledge`, {
            expectedVersion: issue.version,
            note: values.note.trim(),
          }),
        )}
      >
        <label className="field">
          <span>Nota de confirmación</span>
          <textarea
            required
            minLength={3}
            maxLength={2000}
            {...form.register('note', { required: true, minLength: 3 })}
          />
        </label>
        <PpeCommandFeedback command={command} />
        <PpeSubmit command={command}>Confirmar y pasar a servicio</PpeSubmit>
      </form>
    </PpeDialog>
  );
}

function ConditionDialog({
  api,
  issue,
  onClose,
  onSaved,
}: {
  api: ReturnType<typeof usePpeApi>;
  issue: PpeIssue;
  onClose(): void;
  onSaved(): void;
}) {
  const form = useForm<{
    condition: 'SERVICEABLE' | 'REVIEW_REQUIRED' | 'UNSERVICEABLE';
    inspectedAt: string;
    note: string;
    evidenceUrl: string;
  }>({ defaultValues: { condition: 'SERVICEABLE', inspectedAt: '', note: '', evidenceUrl: '' } });
  const command = usePpeCommand(api, 'Condición registrada.', onSaved);
  return (
    <PpeDialog
      title="Revisar condición del EPP"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <p>Esta es una revisión de condición del EPP entregado, no una inspección general.</p>
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit((values) =>
          command.run(`/ppe/issues/${issue.id}/inspect`, {
            expectedVersion: issue.version,
            condition: values.condition,
            inspectedAt: new Date(values.inspectedAt).toISOString(),
            ...(values.note.trim() ? { note: values.note.trim() } : {}),
            ...(values.evidenceUrl.trim() ? { evidenceUrl: values.evidenceUrl.trim() } : {}),
          }),
        )}
      >
        <label className="field">
          <span>Condición</span>
          <select {...form.register('condition')}>
            <option value="SERVICEABLE">Apto para servicio</option>
            <option value="REVIEW_REQUIRED">Requiere revisión</option>
            <option value="UNSERVICEABLE">No apto para servicio</option>
          </select>
        </label>
        <label className="field">
          <span>Fecha de revisión</span>
          <input
            type="datetime-local"
            required
            {...form.register('inspectedAt', { required: true })}
          />
        </label>
        <label className="field">
          <span>Nota (opcional)</span>
          <textarea maxLength={2000} {...form.register('note')} />
        </label>
        <label className="field">
          <span>Enlace HTTPS de evidencia (opcional)</span>
          <input
            type="url"
            placeholder="https://"
            {...form.register('evidenceUrl', { pattern: /^https:\/\//i })}
          />
        </label>
        <PpeCommandFeedback command={command} />
        <PpeSubmit command={command}>Registrar condición</PpeSubmit>
      </form>
    </PpeDialog>
  );
}

function ReplacementDialog({
  api,
  issue,
  workerId,
  onClose,
  onSaved,
}: {
  api: ReturnType<typeof usePpeApi>;
  issue: PpeIssue;
  workerId: string;
  onClose(): void;
  onSaved(): void;
}) {
  const form = useForm<{
    reason: keyof typeof REPLACEMENT_REASON_LABELS;
    issuedAt: string;
    assetReference: string;
    reasonNote: string;
    evidenceNote: string;
    evidenceUrl: string;
  }>({
    defaultValues: {
      reason: 'WEAR',
      issuedAt: '',
      assetReference: '',
      reasonNote: '',
      evidenceNote: '',
      evidenceUrl: '',
    },
  });
  const [incident, setIncident] = useState<IncidentChoice | null>(null);
  const reason = form.watch('reason');
  const command = usePpeCommand(
    api,
    'Reemplazo registrado. La continuidad queda en la historia.',
    onSaved,
  );
  const note = form.watch('evidenceNote');
  const url = form.watch('evidenceUrl');
  return (
    <PpeDialog
      title="Preparar reemplazo"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <div className={styles.context}>
        <strong>{issue.ppeCatalogItem.name}</strong>
        <p>
          La entrega anterior se conserva como historia. No se cambia la política por una fecha
          prevista.
        </p>
      </div>
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit((values) =>
          command.run(`/ppe/issues/${issue.id}/replace`, {
            expectedVersion: issue.version,
            issuedAt: new Date(values.issuedAt).toISOString(),
            reason: values.reason,
            ...(values.assetReference.trim()
              ? { assetReference: values.assetReference.trim() }
              : {}),
            ...(values.reasonNote.trim() ? { reasonNote: values.reasonNote.trim() } : {}),
            ...(values.evidenceNote.trim() ? { evidenceNote: values.evidenceNote.trim() } : {}),
            ...(values.evidenceUrl.trim() ? { evidenceUrl: values.evidenceUrl.trim() } : {}),
            ...(incident ? { linkedIncidentId: incident.id } : {}),
          }),
        )}
      >
        <label className="field">
          <span>Razón</span>
          <select {...form.register('reason')}>
            {Object.entries(REPLACEMENT_REASON_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {reason === 'OTHER_JUSTIFIED' ? (
          <label className="field">
            <span>Justificación</span>
            <textarea
              required
              minLength={1}
              maxLength={1000}
              {...form.register('reasonNote', { required: true })}
            />
          </label>
        ) : null}
        <label className="field">
          <span>Fecha de la nueva entrega</span>
          <input
            type="datetime-local"
            required
            {...form.register('issuedAt', { required: true })}
          />
        </label>
        <label className="field">
          <span>Referencia del nuevo elemento (opcional)</span>
          <input maxLength={160} {...form.register('assetReference')} />
        </label>
        {reason === 'DAMAGE' ? (
          <ServerSelection<IncidentChoice>
            api={api}
            path="/incidents"
            filters={{ workerId }}
            label="Incidente relacionado (opcional)"
            selected={incident}
            onSelect={setIncident}
            name={(row) => row.title}
            detail={(row) => `${row.status} · ${ppeDate(row.occurredAt)}`}
          />
        ) : null}
        <fieldset className={styles.fieldset}>
          <legend>Evidencia: nota o enlace</legend>
          <label className="field">
            <span>Nota</span>
            <textarea disabled={Boolean(url)} maxLength={2000} {...form.register('evidenceNote')} />
          </label>
          <label className="field">
            <span>Enlace HTTPS</span>
            <input
              disabled={Boolean(note)}
              type="url"
              placeholder="https://"
              {...form.register('evidenceUrl', { pattern: /^https:\/\//i })}
            />
          </label>
        </fieldset>
        <PpeCommandFeedback command={command} />
        <PpeSubmit command={command}>Registrar reemplazo</PpeSubmit>
      </form>
    </PpeDialog>
  );
}
