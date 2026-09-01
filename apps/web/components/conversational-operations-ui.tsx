'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { queryKeys } from '@/lib/query-keys';
import {
  INSPECTION_DOMAINS,
  INSPECTION_DOMAIN_LABELS,
} from '@/lib/inspection-standard-presentation';
import { humanOperationalPriorityLabel, humanRoleLabel } from '@/lib/human-lexicon';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextSummary,
  TechnicalDetailsDisclosure,
  WorkspaceHeader,
  WorkspaceShell,
} from './workspace';

type ConversationContextType =
  | 'GLOBAL'
  | 'WORK_ITEM'
  | 'INSPECTION'
  | 'FINDING'
  | 'WORKER'
  | 'INCIDENT'
  | 'PPE'
  | 'TRAINING'
  | 'WORK_PERMIT'
  | 'OBLIGATION';

type ConversationActionKey =
  | 'get_my_work_queue'
  | 'get_work_item_context'
  | 'get_inspection_context'
  | 'get_inspection_basis'
  | 'get_criterion_context'
  | 'get_criterion_provenance'
  | 'get_regulatory_unit'
  | 'get_evidence_context'
  | 'get_worker_context'
  | 'get_incident_context'
  | 'get_ppe_context'
  | 'get_training_context'
  | 'get_work_permit_context'
  | 'get_obligation_context'
  | 'explain_work_item'
  | 'create_inspection'
  | 'start_inspection'
  | 'record_criterion_result'
  | 'attach_evidence'
  | 'create_finding'
  | 'create_action'
  | 'assign_action';

type Citation = {
  id: string;
  type: string;
  label: string;
  referenceId: string;
  deepLink?: string | null;
  sourceSnapshot?: Record<string, unknown> | null;
};

type AttachmentReference = {
  id: string;
  destinationType: string;
  destinationId: string;
  label: string;
};

type ConversationMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM_EVENT';
  content: string;
  createdAt: string;
  structuredData?: { result?: unknown; actionKey?: string } | null;
  citations: Citation[];
  attachments: AttachmentReference[];
};

type ActionRun = {
  id: string;
  actionKey: ConversationActionKey;
  request: Record<string, unknown>;
  status: 'AWAITING_CONFIRMATION' | 'EXECUTING' | 'SUCCEEDED' | 'FAILED' | 'REJECTED';
  confirmationState: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'NOT_REQUIRED';
  result?: unknown;
  resultType?: string | null;
  resultId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

type ConversationThreadSummary = {
  id: string;
  title: string;
  contextType: ConversationContextType;
  contextId?: string | null;
  updatedAt: string;
  _count: { messages: number; actionRuns: number };
};

type ConversationThread = ConversationThreadSummary & {
  messages: ConversationMessage[];
  actionRuns: ActionRun[];
  provider: string;
};

type WorkQueueItem = {
  type: string;
  sourceId: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  dueAt?: string | null;
  overdue: boolean;
  origin: string;
  module: string;
  deepLink: string;
  assignee?: { id: string; displayName: string } | null;
};

type InspectionContext = {
  workCenters: Array<{
    id: string;
    name: string;
    city?: string | null;
    workAreas: Array<{ id: string; name: string }>;
  }>;
  members: Array<{ id: string; displayName: string; role: string }>;
};

type RiskMethod = {
  id: string;
  methodKey: 'DEMO_5X5' | 'GUIDED_5X5' | 'GTC45_2010';
  displayName: string;
  semanticVersion: string;
  disclaimer: string;
};

type InspectionBasis = {
  id: string;
  version: number;
  status: string;
  definition: { name: string; inspectionDomain: string };
  technicalSources: Array<{
    id: string;
    role: 'PRIMARY_TECHNICAL' | 'SUPPLEMENTAL_TECHNICAL' | 'INTERNAL_ORGANIZATION';
    standardVersion: {
      editionLabel: string;
      source: { name: string; originCountry?: string | null; referenceUrl?: string | null };
    };
  }>;
  regulatoryUnits: Array<{
    id: string;
    regulatoryUnit: {
      identifier: string;
      locator: string;
      sourceVersion: { source: { canonicalTitle: string; countryCode: string } };
    };
  }>;
};

type CriterionResult = {
  id: string;
  outcome: 'CONFORME' | 'NO_CONFORME' | 'NO_APLICA' | 'NO_VERIFICADO';
  note?: string | null;
  evidenceReferences: unknown;
  finding?: { id: string; title: string; status: string } | null;
  criterion: {
    id: string;
    code: string;
    title: string;
    guidance: string;
    evidenceExpectation?: string | null;
    sourceLocator?: string | null;
    notApplicableAllowed: boolean;
    standardVersion: {
      editionLabel: string;
      source: { name: string; originCountry?: string | null; referenceUrl?: string | null };
    };
  };
};

type Finding = {
  id: string;
  title: string;
  status: string;
  initialResultLabel?: string | null;
  initialRiskLevel?: string | null;
  actions: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueAt?: string | null;
    assignedTo?: { id: string; displayName: string } | null;
  }>;
};

type Inspection = {
  id: string;
  title: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  inspectionDomain?: string | null;
  workCenter: { id: string; name: string };
  riskMethodVersion: {
    id: string;
    displayName: string;
    disclaimer: string;
    methodDefinition: { methodKey: RiskMethod['methodKey'] };
  };
  inspectionBasisVersion?: InspectionBasis | null;
  criterionResults: CriterionResult[];
  findings: Finding[];
};

const WRITE_ROLES = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);

const CONTEXT_LABELS: Record<ConversationContextType, string> = {
  GLOBAL: 'Organización activa',
  WORK_ITEM: 'Elemento de trabajo',
  INSPECTION: 'Inspección',
  FINDING: 'Hallazgo',
  WORKER: 'Persona / trabajador',
  INCIDENT: 'Incidente',
  PPE: 'EPP de una persona',
  TRAINING: 'Capacitación de una persona',
  WORK_PERMIT: 'Permiso de trabajo',
  OBLIGATION: 'Actividad regulatoria',
};

const READ_CONTEXT_ACTIONS: Partial<Record<ConversationContextType, ConversationActionKey>> = {
  WORK_ITEM: 'get_work_item_context',
  INSPECTION: 'get_inspection_context',
  WORKER: 'get_worker_context',
  INCIDENT: 'get_incident_context',
  PPE: 'get_ppe_context',
  TRAINING: 'get_training_context',
  WORK_PERMIT: 'get_work_permit_context',
  OBLIGATION: 'get_obligation_context',
};

const READ_CONTEXT_INPUTS: Partial<Record<ConversationContextType, string>> = {
  WORK_ITEM: 'sourceId',
  INSPECTION: 'inspectionId',
  WORKER: 'workerId',
  INCIDENT: 'incidentId',
  PPE: 'workerId',
  TRAINING: 'workerId',
  WORK_PERMIT: 'workPermitId',
  OBLIGATION: 'obligationId',
};

const ACTION_LABELS: Partial<Record<ConversationActionKey, string>> = {
  create_inspection: 'Crear inspección',
  start_inspection: 'Iniciar inspección',
  record_criterion_result: 'Registrar resultado del criterio',
  attach_evidence: 'Vincular evidencia',
  create_finding: 'Crear hallazgo',
  create_action: 'Crear acción',
  assign_action: 'Asignar acción',
};

const INSPECTION_STATUS_LABELS: Record<Inspection['status'], string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELED: 'Cancelada',
};

const CRITERION_OUTCOME_LABELS: Record<CriterionResult['outcome'], string> = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No conforme',
  NO_APLICA: 'No aplica',
  NO_VERIFICADO: 'No verificado',
};

const WORK_ORIGIN_LABELS: Record<string, string> = {
  APPROVED_REQUIREMENT: 'Requisito aprobado',
  CANDIDATE_REQUIREMENT: 'Requisito candidato',
  INTERNAL_PROGRAM: 'Programa interno',
  MANUAL: 'Registro manual',
};

function humanWorkOrigin(origin: string) {
  return WORK_ORIGIN_LABELS[origin] ?? (origin.includes('_') ? 'Actividad operativa' : origin);
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error ? error.message : 'La operación no pudo completarse.';
}

function displayDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Sin fecha definida';
}

function idempotencyKey(actionKey: string) {
  return `${actionKey}:${crypto.randomUUID()}`;
}

function queueItems(value: unknown): WorkQueueItem[] {
  if (!value || typeof value !== 'object') return [];
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? (items as WorkQueueItem[]) : [];
}

function MessageResult({
  message,
  onExplain,
  busy,
}: {
  message: ConversationMessage;
  onExplain(item: WorkQueueItem): void;
  busy: boolean;
}) {
  const items = queueItems(message.structuredData?.result);
  if (!items.length) return null;
  return (
    <div className="conversation-result-list" aria-label="Resultados de la cola de trabajo">
      {items.map((item) => (
        <article className="conversation-work-item" key={`${item.type}:${item.sourceId}`}>
          <div>
            <span className="conversation-kicker">{humanWorkOrigin(item.origin)}</span>
            <h4>{item.title}</h4>
            <p>{item.summary}</p>
          </div>
          <dl className="conversation-compact-facts">
            <div>
              <dt>Prioridad</dt>
              <dd>{humanOperationalPriorityLabel(item.priority)}</dd>
            </div>
            <div>
              <dt>Vence</dt>
              <dd>{displayDate(item.dueAt)}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>{item.assignee?.displayName ?? 'Sin asignar'}</dd>
            </div>
          </dl>
          <div className="conversation-inline-actions">
            <Button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => onExplain(item)}
            >
              ¿Por qué está pendiente?
            </Button>
            <Link className="button secondary" href={item.deepLink}>
              Abrir registro
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function Citations({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="conversation-citations" aria-label="Fuentes verificables">
      <span>Fuentes:</span>
      {citations.map((citation) =>
        citation.deepLink ? (
          <Link className="conversation-citation" href={citation.deepLink} key={citation.id}>
            {citation.label}
          </Link>
        ) : (
          <span className="conversation-citation" key={citation.id}>
            {citation.label}
          </span>
        ),
      )}
    </div>
  );
}

function ConfirmationCard({
  run,
  busy,
  onDecision,
}: {
  run: ActionRun;
  busy: boolean;
  onDecision(id: string, decision: 'confirm' | 'reject'): void;
}) {
  return (
    <Card className="conversation-confirmation-card">
      <span className="conversation-kicker">Confirmación requerida</span>
      <h4>{ACTION_LABELS[run.actionKey] ?? 'Acción estructurada'}</h4>
      <p>Revisa los datos. El dominio todavía no ha recibido ningún cambio.</p>
      <TechnicalDetailsDisclosure summary="Ver solicitud estructurada">
        <pre>{JSON.stringify(run.request, null, 2)}</pre>
      </TechnicalDetailsDisclosure>
      <div className="conversation-inline-actions">
        <Button disabled={busy} type="button" onClick={() => onDecision(run.id, 'confirm')}>
          Confirmar acción
        </Button>
        <Button
          disabled={busy}
          className="secondary"
          type="button"
          onClick={() => onDecision(run.id, 'reject')}
        >
          Rechazar
        </Button>
      </div>
    </Card>
  );
}

function BasisSummary({ basis }: { basis: InspectionBasis }) {
  const primary = basis.technicalSources.find(({ role }) => role === 'PRIMARY_TECHNICAL');
  const supplemental = basis.technicalSources.filter(
    ({ role }) => role === 'SUPPLEMENTAL_TECHNICAL',
  );
  const internal = basis.technicalSources.filter(({ role }) => role === 'INTERNAL_ORGANIZATION');
  return (
    <Card className="conversation-basis-card">
      <div className="conversation-card-heading">
        <div>
          <span className="conversation-kicker">Base de inspección activa</span>
          <h3>{basis.definition.name}</h3>
        </div>
        <StatusBadge>Versión {basis.version}</StatusBadge>
      </div>
      <dl className="conversation-source-groups">
        <div>
          <dt>Base técnica principal</dt>
          <dd>
            {primary
              ? `${primary.standardVersion.source.name} · ${primary.standardVersion.editionLabel}`
              : 'No configurada'}
          </dd>
          <small>
            Jurisdicción: {primary?.standardVersion.source.originCountry ?? 'No informada'}
          </small>
        </div>
        <div>
          <dt>Referencias técnicas suplementarias</dt>
          <dd>
            {supplemental.length
              ? supplemental.map(({ standardVersion }) => standardVersion.source.name).join(', ')
              : 'Ninguna'}
          </dd>
        </div>
        <div>
          <dt>Fundamento normativo</dt>
          <dd>
            {basis.regulatoryUnits.length
              ? basis.regulatoryUnits
                  .map(
                    ({ regulatoryUnit }) =>
                      `${regulatoryUnit.identifier} · ${regulatoryUnit.sourceVersion.source.countryCode}`,
                  )
                  .join(', ')
              : 'Sin unidades regulatorias seleccionadas'}
          </dd>
        </div>
        <div>
          <dt>Referencias de la organización</dt>
          <dd>{internal.length ? internal.length : 'Ninguna'}</dd>
        </div>
      </dl>
      <p className="conversation-boundary-note">
        Una referencia extranjera aporta contexto técnico; no se presenta automáticamente como ley
        aplicable en Ecuador.
      </p>
    </Card>
  );
}

function GuidedRiskFields({ methodKey }: { methodKey: RiskMethod['methodKey'] }) {
  if (methodKey === 'GTC45_2010') {
    return (
      <fieldset className="conversation-field-grid">
        <legend>Valoración determinística GTC 45</legend>
        <label>
          Nivel de deficiencia
          <select name="deficiency" defaultValue="HIGH" required>
            <option value="VERY_HIGH">Muy alto</option>
            <option value="HIGH">Alto</option>
            <option value="MEDIUM">Medio</option>
            <option value="LOW">Bajo</option>
          </select>
        </label>
        <label>
          Exposición
          <select name="exposure" defaultValue="3" required>
            <option value="4">Continua</option>
            <option value="3">Frecuente</option>
            <option value="2">Ocasional</option>
            <option value="1">Esporádica</option>
          </select>
        </label>
        <label>
          Consecuencia
          <select name="consequence" defaultValue="25" required>
            <option value="100">Mortal o catastrófica</option>
            <option value="60">Muy grave</option>
            <option value="25">Grave</option>
            <option value="10">Leve</option>
          </select>
        </label>
        <label className="conversation-field-wide">
          Justificación profesional
          <textarea name="professionalRationale" rows={3} required />
        </label>
      </fieldset>
    );
  }
  if (methodKey === 'GUIDED_5X5') {
    return (
      <fieldset className="conversation-field-grid">
        <legend>Guía 5×5 determinística</legend>
        <label>
          Probabilidad
          <select name="probability" defaultValue="3" required>
            {[1, 2, 3, 4, 5].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severidad humana
          <select name="severity" defaultValue="3" required>
            {[1, 2, 3, 4, 5].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="conversation-field-wide">
          Razonamiento de selección
          <textarea name="selectionRationale" rows={3} required />
        </label>
      </fieldset>
    );
  }
  return (
    <fieldset className="conversation-field-grid">
      <legend>Matriz demostrativa 5×5</legend>
      <label>
        Probabilidad
        <select name="likelihood" defaultValue="3" required>
          {[1, 2, 3, 4, 5].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Consecuencia
        <select name="consequence" defaultValue="3" required>
          {[1, 2, 3, 4, 5].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

export function ConversationalOperationsWorkspace() {
  const auth = useAuth();
  const organization = useOrganization();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canWrite = WRITE_ROLES.has(organization.currentRole ?? '');
  const requestedContextType =
    (searchParams.get('contextType') as ConversationContextType) ?? 'GLOBAL';
  const requestedContextId = searchParams.get('contextId');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [domain, setDomain] = useState<(typeof INSPECTION_DOMAINS)[number]>('ELECTRICAL');
  const [criterionIndex, setCriterionIndex] = useState(0);
  const [inspectionId, setInspectionId] = useState<string | null>(
    requestedContextType === 'INSPECTION' ? requestedContextId : null,
  );
  const [notice, setNotice] = useState('');

  const request = <T,>(path: string, init: RequestInit = {}) =>
    auth.request<T>(path, init, organizationId!);

  const threads = useQuery({
    queryKey: queryKeys.organization.conversationThreads(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => request<ConversationThreadSummary[]>('/conversations', { signal }),
    enabled: Boolean(organizationId),
  });
  const thread = useQuery({
    queryKey: queryKeys.organization.conversationThread(
      organizationId ?? 'inactive',
      activeThreadId ?? 'none',
    ),
    queryFn: ({ signal }) =>
      request<ConversationThread>(`/conversations/${activeThreadId}`, { signal }),
    enabled: Boolean(organizationId && activeThreadId),
  });
  const inspectionContext = useQuery({
    queryKey: queryKeys.organization.inspectionContext(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => request<InspectionContext>('/inspections/context', { signal }),
    enabled: Boolean(organizationId && canWrite),
  });
  const riskMethods = useQuery({
    queryKey: queryKeys.organization.riskMethods(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => request<RiskMethod[]>('/risk-methods', { signal }),
    enabled: Boolean(organizationId && canWrite),
  });
  const activeBasis = useQuery({
    queryKey: queryKeys.organization.inspectionBasisActive(organizationId ?? 'inactive', domain),
    queryFn: ({ signal }) =>
      request<InspectionBasis>(`/inspection-bases/active/${domain}`, { signal }),
    enabled: Boolean(organizationId && canWrite),
    retry: false,
  });
  const inspection = useQuery({
    queryKey: queryKeys.organization.inspection(
      organizationId ?? 'inactive',
      inspectionId ?? 'none',
    ),
    queryFn: ({ signal }) => request<Inspection>(`/inspections/${inspectionId}`, { signal }),
    enabled: Boolean(organizationId && inspectionId),
  });

  useEffect(() => {
    if (activeThreadId || !threads.data?.length) return;
    const contextual = threads.data.find(
      ({ contextType, contextId }) =>
        contextType === requestedContextType && (contextId ?? null) === requestedContextId,
    );
    setActiveThreadId(contextual?.id ?? threads.data[0]!.id);
  }, [activeThreadId, requestedContextId, requestedContextType, threads.data]);

  useEffect(() => {
    const created = [...(thread.data?.actionRuns ?? [])]
      .reverse()
      .find(
        ({ status, resultType, resultId }) =>
          status === 'SUCCEEDED' && resultType === 'INSPECTION' && Boolean(resultId),
      );
    if (created?.resultId && created.resultId !== inspectionId) setInspectionId(created.resultId);
  }, [inspectionId, thread.data?.actionRuns]);

  useEffect(() => setCriterionIndex(0), [inspectionId]);

  async function refreshConversation(threadId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.conversationThreads(organizationId!),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.conversationThread(organizationId!, threadId),
      }),
    ]);
  }

  const createThread = useMutation({
    mutationFn: (input: {
      title: string;
      contextType: ConversationContextType;
      contextId?: string;
    }) =>
      request<ConversationThread>('/conversations', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (created) => {
      setActiveThreadId(created.id);
      await refreshConversation(created.id);
    },
  });

  async function ensureThread() {
    if (activeThreadId) return activeThreadId;
    const created = await createThread.mutateAsync({
      title:
        requestedContextType === 'GLOBAL' ? 'Operación SST' : CONTEXT_LABELS[requestedContextType],
      contextType: requestedContextType,
      ...(requestedContextId ? { contextId: requestedContextId } : {}),
    });
    return created.id;
  }

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const threadId = await ensureThread();
      await request(`/conversations/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      return threadId;
    },
    onSuccess: refreshConversation,
  });

  const runAction = useMutation({
    mutationFn: async ({
      actionKey,
      input,
    }: {
      actionKey: ConversationActionKey;
      input: Record<string, unknown>;
    }) => {
      const threadId = await ensureThread();
      await request(`/conversations/${threadId}/actions`, {
        method: 'POST',
        body: JSON.stringify({ actionKey, input, idempotencyKey: idempotencyKey(actionKey) }),
      });
      return threadId;
    },
    onSuccess: refreshConversation,
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'confirm' | 'reject' }) => {
      await request(`/conversations/action-runs/${id}/${decision}`, { method: 'POST' });
      return activeThreadId!;
    },
    onSuccess: async (threadId) => {
      setNotice('La decisión fue procesada por el servicio de dominio.');
      await refreshConversation(threadId);
      if (inspectionId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.organization.inspection(organizationId!, inspectionId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workQueueRoot(organizationId!),
      });
    },
  });

  const busy =
    createThread.isPending || sendMessage.isPending || runAction.isPending || decide.isPending;
  const mutationError =
    createThread.error ?? sendMessage.error ?? runAction.error ?? decide.error ?? null;
  const currentCriterion = inspection.data?.criterionResults[criterionIndex];
  const relatedFinding = currentCriterion?.finding
    ? inspection.data?.findings.find(({ id }) => id === currentCriterion.finding?.id)
    : undefined;

  function handleMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get('content') ?? '').trim();
    if (!content) return;
    sendMessage.mutate(content, { onSuccess: () => form.reset() });
  }

  function proposeInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    runAction.mutate({
      actionKey: 'create_inspection',
      input: {
        title: String(data.get('title')),
        workCenterId: String(data.get('workCenterId')),
        riskMethodVersionId: String(data.get('riskMethodVersionId')),
        inspectionDomain: domain,
      },
    });
  }

  function proposeFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inspection.data || !currentCriterion) return;
    const data = new FormData(event.currentTarget);
    const methodKey = inspection.data.riskMethodVersion.methodDefinition.methodKey;
    let methodInput: Record<string, unknown>;
    if (methodKey === 'GTC45_2010') {
      methodInput = {
        deficiency: String(data.get('deficiency')),
        exposure: Number(data.get('exposure')),
        consequence: Number(data.get('consequence')),
        professionalRationale: String(data.get('professionalRationale')),
      };
    } else if (methodKey === 'GUIDED_5X5') {
      methodInput = {
        probability: Number(data.get('probability')),
        severity: Number(data.get('severity')),
        severityDimension: 'HUMAN',
        checkedProbabilityCueKeys: [],
        checkedSeverityCueKeys: [],
        selectionRationale: String(data.get('selectionRationale')),
      };
    } else {
      methodInput = {
        likelihood: Number(data.get('likelihood')),
        consequence: Number(data.get('consequence')),
      };
    }
    runAction.mutate({
      actionKey: 'create_finding',
      input: {
        inspectionId: inspection.data.id,
        criterionResultId: currentCriterion.id,
        title: String(data.get('title')),
        description: String(data.get('description')),
        category: String(data.get('category')),
        methodInput,
      },
    });
  }

  function proposeCorrectiveAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inspection.data || !relatedFinding) return;
    const data = new FormData(event.currentTarget);
    const dueAt = String(data.get('dueAt') ?? '');
    runAction.mutate({
      actionKey: 'create_action',
      input: {
        inspectionId: inspection.data.id,
        findingId: relatedFinding.id,
        title: String(data.get('title')),
        description: String(data.get('description') ?? ''),
        assignedToUserId: String(data.get('assignedToUserId')),
        priority: String(data.get('priority')),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      },
    });
  }

  function readContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contextType = String(data.get('contextType')) as ConversationContextType;
    const contextId = String(data.get('contextId')).trim();
    const actionKey = READ_CONTEXT_ACTIONS[contextType];
    const inputKey = READ_CONTEXT_INPUTS[contextType];
    if (actionKey && inputKey && contextId)
      runAction.mutate({ actionKey, input: { [inputKey]: contextId } });
  }

  if (!organizationId) {
    return (
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Operación asistida"
          title="Preguntar / Operar"
          description="Selecciona una organización para abrir tu espacio conversacional privado."
        />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell className="conversation-workspace">
      <WorkspaceHeader
        eyebrow="Operación asistida"
        title="Preguntar / Operar"
        description="Consulta información autorizada y prepara acciones SST con confirmación explícita."
        actions={
          <Button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              createThread.mutate({ title: 'Nueva operación SST', contextType: 'GLOBAL' })
            }
          >
            Nueva conversación
          </Button>
        }
      />
      <ContextSummary>
        <span>Organización activa</span>
        <span>Contexto: {CONTEXT_LABELS[thread.data?.contextType ?? requestedContextType]}</span>
        <span>Procesamiento local controlado · sin IA externa</span>
      </ContextSummary>
      {notice ? (
        <p role="status" className="conversation-notice">
          {notice}
        </p>
      ) : null}
      {mutationError ? (
        <p role="alert" className="conversation-error">
          {errorMessage(mutationError)}
        </p>
      ) : null}

      <div className="conversation-layout">
        <nav className="conversation-thread-list" aria-label="Conversaciones privadas">
          <div className="conversation-panel-heading">
            <h2>Conversaciones</h2>
            <span>{threads.data?.length ?? 0}</span>
          </div>
          {threads.isLoading ? <p>Cargando conversaciones…</p> : null}
          {(threads.data ?? []).map((item) => (
            <button
              aria-current={item.id === activeThreadId ? 'page' : undefined}
              className="conversation-thread-button"
              key={item.id}
              type="button"
              onClick={() => setActiveThreadId(item.id)}
            >
              <strong>{item.title}</strong>
              <span>{CONTEXT_LABELS[item.contextType]}</span>
              <small>{item._count.messages} mensajes</small>
            </button>
          ))}
          {!threads.isLoading && !threads.data?.length ? (
            <p className="conversation-empty-copy">Inicia una consulta o una inspección guiada.</p>
          ) : null}
        </nav>

        <main className="conversation-chat" aria-label="Conversación SST">
          <header className="conversation-panel-heading">
            <div>
              <span className="conversation-kicker">Contexto visible</span>
              <h2>{thread.data?.title ?? 'Nueva operación SST'}</h2>
            </div>
            {thread.data?.contextId ? <span>Registro vinculado</span> : null}
          </header>
          <div className="conversation-quick-actions" aria-label="Consultas rápidas">
            <Button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => sendMessage.mutate('¿Qué tengo pendiente?')}
            >
              ¿Qué tengo pendiente?
            </Button>
            {thread.data?.contextType &&
            thread.data.contextId &&
            READ_CONTEXT_ACTIONS[thread.data.contextType] ? (
              <Button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  const contextType = thread.data!.contextType;
                  const actionKey = READ_CONTEXT_ACTIONS[contextType];
                  const inputKey = READ_CONTEXT_INPUTS[contextType];
                  if (actionKey && inputKey)
                    runAction.mutate({ actionKey, input: { [inputKey]: thread.data!.contextId } });
                }}
              >
                Consultar este contexto
              </Button>
            ) : null}
          </div>

          <div className="conversation-log" aria-live="polite">
            {!thread.data?.messages.length ? (
              <div className="conversation-empty-state">
                <h3>Empieza por una pregunta verificable</h3>
                <p>
                  Puedes consultar tu cola o usar la guía de inspección. Las fuentes aparecerán como
                  citas persistidas; si no podemos verificar algo, lo indicaremos.
                </p>
              </div>
            ) : null}
            {(thread.data?.messages ?? []).map((message) => (
              <article
                className={`conversation-message is-${message.role.toLowerCase()}`}
                key={message.id}
              >
                <span className="conversation-message-author">
                  {message.role === 'USER'
                    ? 'Tú'
                    : message.role === 'ASSISTANT'
                      ? 'Operación SST'
                      : 'Sistema'}
                </span>
                <p>{message.content}</p>
                <MessageResult
                  message={message}
                  busy={busy}
                  onExplain={(item) =>
                    runAction.mutate({
                      actionKey: 'explain_work_item',
                      input: { sourceId: item.sourceId, type: item.type },
                    })
                  }
                />
                <Citations citations={message.citations} />
                {message.attachments.length ? (
                  <div className="conversation-attachments">
                    {message.attachments.map((attachment) => (
                      <span key={attachment.id}>Evidencia vinculada: {attachment.label}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {(thread.data?.actionRuns ?? [])
              .filter(({ status }) => status === 'AWAITING_CONFIRMATION')
              .map((run) => (
                <ConfirmationCard
                  run={run}
                  busy={busy}
                  key={run.id}
                  onDecision={(id, decision) => decide.mutate({ id, decision })}
                />
              ))}
            {(thread.data?.actionRuns ?? [])
              .filter(({ status }) => status === 'FAILED')
              .slice(-1)
              .map((run) => (
                <p role="alert" className="conversation-error" key={run.id}>
                  {run.errorMessage ??
                    'La acción no pudo completarse con tus permisos o datos actuales.'}
                </p>
              ))}
          </div>

          <form className="conversation-composer" onSubmit={handleMessage}>
            <label htmlFor="conversation-message">Mensaje</label>
            <div>
              <textarea
                id="conversation-message"
                name="content"
                rows={2}
                maxLength={4000}
                placeholder="Pregunta por trabajo pendiente o por el contexto actual"
                required
              />
              <Button type="submit" disabled={busy}>
                Enviar
              </Button>
            </div>
            <small>
              El texto no puede cambiar permisos, organización ni ejecutar herramientas arbitrarias.
            </small>
          </form>
        </main>

        <aside className="conversation-operations" aria-label="Operación guiada">
          <details open>
            <summary>Inspección guiada</summary>
            <div className="conversation-inspector-body">
              {!canWrite ? (
                <p className="conversation-boundary-note">
                  Tu rol es de consulta. Puedes leer información autorizada, pero no confirmar
                  escrituras de inspección.
                </p>
              ) : !inspection.data ? (
                <>
                  <label>
                    Dominio
                    <select
                      value={domain}
                      onChange={(event) => setDomain(event.target.value as typeof domain)}
                    >
                      {INSPECTION_DOMAINS.map((item) => (
                        <option value={item} key={item}>
                          {INSPECTION_DOMAIN_LABELS[item]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeBasis.isLoading ? <p>Verificando Base de inspección activa…</p> : null}
                  {activeBasis.data ? <BasisSummary basis={activeBasis.data} /> : null}
                  {activeBasis.isError ? (
                    <Card className="conversation-guidance-card">
                      <h3>Falta una Base de inspección activa</h3>
                      <p>No se usará un estándar alternativo de forma silenciosa.</p>
                      <Link className="button secondary" href="/app/settings/inspection-bases">
                        Configurar Bases de inspección
                      </Link>
                    </Card>
                  ) : null}
                  <form className="conversation-form" onSubmit={proposeInspection}>
                    <label>
                      Título
                      <input
                        name="title"
                        defaultValue={`Inspección ${INSPECTION_DOMAIN_LABELS[domain]}`}
                        required
                      />
                    </label>
                    <label>
                      Centro de trabajo
                      <select name="workCenterId" required defaultValue="">
                        <option value="" disabled>
                          Selecciona
                        </option>
                        {(inspectionContext.data?.workCenters ?? []).map((center) => (
                          <option value={center.id} key={center.id}>
                            {center.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Metodología de riesgo
                      <select name="riskMethodVersionId" required defaultValue="">
                        <option value="" disabled>
                          Selecciona
                        </option>
                        {(riskMethods.data ?? []).map((method) => (
                          <option value={method.id} key={method.id}>
                            {method.displayName} · {method.semanticVersion}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" disabled={busy || !activeBasis.data}>
                      Preparar creación
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <div className="conversation-card-heading">
                    <div>
                      <span className="conversation-kicker">Inspección actual</span>
                      <h3>{inspection.data.title}</h3>
                      <p>{inspection.data.workCenter.name}</p>
                    </div>
                    <StatusBadge>{INSPECTION_STATUS_LABELS[inspection.data.status]}</StatusBadge>
                  </div>
                  {inspection.data.inspectionBasisVersion ? (
                    <BasisSummary basis={inspection.data.inspectionBasisVersion} />
                  ) : (
                    <p className="conversation-boundary-note">
                      Inspección histórica con configuración técnica anterior; no se reescribe su
                      base.
                    </p>
                  )}
                  <Card className="conversation-method-card">
                    <span className="conversation-kicker">Metodología de riesgo</span>
                    <h3>{inspection.data.riskMethodVersion.displayName}</h3>
                    <p>{inspection.data.riskMethodVersion.disclaimer}</p>
                  </Card>
                  {inspection.data.status === 'DRAFT' ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction.mutate({
                          actionKey: 'start_inspection',
                          input: { inspectionId: inspection.data!.id },
                        })
                      }
                    >
                      Preparar inicio
                    </Button>
                  ) : null}
                  {inspection.data.status === 'IN_PROGRESS' && currentCriterion ? (
                    <section
                      className="conversation-criterion"
                      id={`criterion-${currentCriterion.criterion.id}`}
                    >
                      <div className="conversation-card-heading">
                        <div>
                          <span className="conversation-kicker">
                            Criterio {criterionIndex + 1} de{' '}
                            {inspection.data.criterionResults.length}
                          </span>
                          <h3>{currentCriterion.criterion.title}</h3>
                        </div>
                        <StatusBadge>
                          {CRITERION_OUTCOME_LABELS[currentCriterion.outcome]}
                        </StatusBadge>
                      </div>
                      <p>{currentCriterion.criterion.guidance}</p>
                      <p>
                        <strong>Fuente técnica:</strong>{' '}
                        {currentCriterion.criterion.standardVersion.source.name} ·{' '}
                        {currentCriterion.criterion.sourceLocator ?? 'localizador no informado'}
                      </p>
                      <div className="conversation-inline-actions">
                        <Button
                          className="secondary"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction.mutate({
                              actionKey: 'get_criterion_provenance',
                              input: {
                                inspectionId: inspection.data!.id,
                                criterionId: currentCriterion.criterion.id,
                              },
                            })
                          }
                        >
                          ¿Por qué este criterio?
                        </Button>
                      </div>
                      <fieldset className="conversation-outcomes">
                        <legend>Registrar resultado</legend>
                        {(['CONFORME', 'NO_CONFORME', 'NO_APLICA', 'NO_VERIFICADO'] as const).map(
                          (outcome) => (
                            <Button
                              className="secondary"
                              type="button"
                              key={outcome}
                              disabled={
                                busy ||
                                (outcome === 'NO_APLICA' &&
                                  !currentCriterion.criterion.notApplicableAllowed)
                              }
                              onClick={() =>
                                runAction.mutate({
                                  actionKey: 'record_criterion_result',
                                  input: {
                                    inspectionId: inspection.data!.id,
                                    criterionId: currentCriterion.criterion.id,
                                    outcome,
                                    note: `Resultado registrado desde la operación guiada: ${outcome}.`,
                                  },
                                })
                              }
                            >
                              {outcome === 'NO_CONFORME'
                                ? 'No conforme'
                                : outcome === 'NO_APLICA'
                                  ? 'No aplica'
                                  : outcome === 'NO_VERIFICADO'
                                    ? 'No verificado'
                                    : 'Conforme'}
                            </Button>
                          ),
                        )}
                      </fieldset>
                      <form
                        className="conversation-compact-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const reference = String(
                            new FormData(event.currentTarget).get('reference'),
                          );
                          runAction.mutate({
                            actionKey: 'attach_evidence',
                            input: {
                              targetType: 'INSPECTION_CRITERION',
                              inspectionId: inspection.data!.id,
                              criterionId: currentCriterion.criterion.id,
                              reference,
                            },
                          });
                        }}
                      >
                        <label>
                          Referencia de evidencia
                          <input
                            name="reference"
                            placeholder="Acta, foto o URL en el repositorio autorizado"
                            required
                            minLength={3}
                          />
                        </label>
                        <Button className="secondary" type="submit" disabled={busy}>
                          Preparar vínculo
                        </Button>
                      </form>
                      {currentCriterion.outcome === 'NO_CONFORME' && !currentCriterion.finding ? (
                        <form
                          className="conversation-form conversation-finding-form"
                          onSubmit={proposeFinding}
                        >
                          <h3>Crear hallazgo de forma explícita</h3>
                          <label>
                            Título
                            <input
                              name="title"
                              defaultValue={`Hallazgo: ${currentCriterion.criterion.title}`}
                              required
                            />
                          </label>
                          <label>
                            Descripción
                            <textarea
                              name="description"
                              rows={3}
                              required
                              defaultValue="Condición observada durante la inspección."
                            />
                          </label>
                          <label>
                            Categoría
                            <select
                              name="category"
                              defaultValue={domain === 'ELECTRICAL' ? 'ELECTRICAL' : 'OTHER'}
                            >
                              <option value="ELECTRICAL">Eléctrico</option>
                              <option value="FIRE">Incendio</option>
                              <option value="MECHANICAL">Mecánico</option>
                              <option value="CHEMICAL">Químico</option>
                              <option value="OTHER">Otro</option>
                            </select>
                          </label>
                          <GuidedRiskFields
                            methodKey={inspection.data.riskMethodVersion.methodDefinition.methodKey}
                          />
                          <p className="conversation-boundary-note">
                            La interfaz recopila respuestas; el backend calcula y conserva el
                            resultado canónico.
                          </p>
                          <Button type="submit" disabled={busy}>
                            Preparar hallazgo
                          </Button>
                        </form>
                      ) : null}
                      {relatedFinding ? (
                        <>
                          <Card className="conversation-finding-summary">
                            <span className="conversation-kicker">Hallazgo canónico</span>
                            <h3>{relatedFinding.title}</h3>
                            <p>
                              Riesgo:{' '}
                              {relatedFinding.initialResultLabel ??
                                relatedFinding.initialRiskLevel ??
                                'registrado'}
                            </p>
                          </Card>
                          <form className="conversation-form" onSubmit={proposeCorrectiveAction}>
                            <h3>Crear y asignar acción</h3>
                            <label>
                              Título
                              <input
                                name="title"
                                required
                                defaultValue="Corregir condición identificada"
                              />
                            </label>
                            <label>
                              Descripción
                              <textarea name="description" rows={2} />
                            </label>
                            <label>
                              Responsable
                              <select name="assignedToUserId" required defaultValue="">
                                <option value="" disabled>
                                  Selecciona un miembro
                                </option>
                                {(inspectionContext.data?.members ?? []).map((member) => (
                                  <option value={member.id} key={member.id}>
                                    {member.displayName} · {humanRoleLabel(member.role)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Prioridad
                              <select name="priority" defaultValue="HIGH">
                                <option value="LOW">Baja</option>
                                <option value="MEDIUM">Media</option>
                                <option value="HIGH">Alta</option>
                                <option value="URGENT">Urgente</option>
                              </select>
                            </label>
                            <label>
                              Fecha límite (opcional)
                              <input name="dueAt" type="datetime-local" />
                            </label>
                            <Button type="submit" disabled={busy}>
                              Preparar acción
                            </Button>
                          </form>
                        </>
                      ) : null}
                      <div className="conversation-criterion-navigation">
                        <Button
                          className="secondary"
                          type="button"
                          disabled={criterionIndex === 0}
                          onClick={() => setCriterionIndex((value) => Math.max(0, value - 1))}
                        >
                          Criterio anterior
                        </Button>
                        <Button
                          className="secondary"
                          type="button"
                          disabled={criterionIndex >= inspection.data.criterionResults.length - 1}
                          onClick={() =>
                            setCriterionIndex((value) =>
                              Math.min(inspection.data!.criterionResults.length - 1, value + 1),
                            )
                          }
                        >
                          Siguiente criterio
                        </Button>
                      </div>
                    </section>
                  ) : null}
                  <div className="conversation-inline-actions">
                    <Link
                      className="button secondary"
                      href={`/app/inspections/${inspection.data.id}`}
                    >
                      Abrir inspección completa
                    </Link>
                    <Button
                      className="secondary"
                      type="button"
                      onClick={() => setInspectionId(null)}
                    >
                      Preparar otra inspección
                    </Button>
                  </div>
                </>
              )}
            </div>
          </details>

          <details>
            <summary>Consultar otro contexto</summary>
            <form className="conversation-inspector-body conversation-form" onSubmit={readContext}>
              <label>
                Tipo de registro
                <select name="contextType" defaultValue="WORKER">
                  {Object.keys(READ_CONTEXT_ACTIONS).map((key) => (
                    <option value={key} key={key}>
                      {CONTEXT_LABELS[key as ConversationContextType]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Identificador del registro
                <input name="contextId" required placeholder="Identificador exacto" />
              </label>
              <p className="conversation-boundary-note">
                La lectura se limita a la organización activa y a los módulos habilitados.
              </p>
              <Button type="submit" className="secondary" disabled={busy}>
                Consultar
              </Button>
            </form>
          </details>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
