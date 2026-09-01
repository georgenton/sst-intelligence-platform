import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InspectionCriterionOutcome, InspectionDomain } from '@prisma/client';
import {
  CONVERSATIONAL_ACTION_KEYS,
  FINDING_CATEGORIES,
  type ConversationActionKey,
  type ConversationCitationType,
} from '@sst/contracts';
import { z } from 'zod';
import {
  INCIDENTS_FEATURE_KEY,
  PPE_FEATURE_KEY,
  TRAINING_FEATURE_KEY,
  WORK_PERMITS_FEATURE_KEY,
} from '../catalog/entitlement';
import { EntitlementService } from '../catalog/entitlement.service';
import { IncidentsService } from '../incidents/incidents.service';
import { InspectionBasisService } from '../inspection-basis/inspection-basis.service';
import { INSPECTION_WRITE_ROLES } from '../inspections/inspection-policy';
import { InspectionsService } from '../inspections/inspections.service';
import { OperationalExecutionService } from '../operational-execution/operational-execution.service';
import { PpeService } from '../ppe/ppe.service';
import { RegulatorySourceService } from '../regulatory-sources/regulatory-source.service';
import { TrainingService } from '../training/training.service';
import { WorkPermitsService } from '../work-permits/work-permits.service';
import { WorkQueueService } from '../work-queue/work-queue.service';
import { WorkersService } from '../workers/workers.service';

type AuditContext = { requestId: string; ip?: string; userAgent?: string };
type Actor = { organizationId: string; userId: string; role: string; audit: AuditContext };

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'borrador',
  ACTIVE: 'activo',
  INACTIVE: 'inactivo',
  RETIRED: 'retirado',
  OPEN: 'abierto',
  REPORTED: 'reportado',
  UNDER_INVESTIGATION: 'en investigación',
  ACTIONS_IN_PROGRESS: 'con acciones en progreso',
  IN_PROGRESS: 'en progreso',
  BLOCKED: 'bloqueado',
  READY_FOR_REVIEW: 'listo para revisión',
  PENDING_APPROVAL: 'pendiente de aprobación',
  AUTHORIZED: 'autorizado',
  SUSPENDED: 'suspendido',
  CLOSED: 'cerrado',
  COMPLETED: 'completado',
  CANCELLED: 'cancelado',
  CANCELED: 'cancelado',
  CONFORME: 'conforme',
  NO_CONFORME: 'no conforme',
  NO_APLICA: 'no aplica',
  NO_VERIFICADO: 'no verificado',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'baja',
  MEDIUM: 'media',
  HIGH: 'alta',
  URGENT: 'urgente',
};

const ORIGIN_LABELS: Record<string, string> = {
  APPROVED_REQUIREMENT: 'requisito aprobado',
  CANDIDATE_REQUIREMENT: 'requisito candidato',
  INTERNAL_PROGRAM: 'programa interno',
  MANUAL: 'registro manual',
};

function humanState(value: string) {
  return STATE_LABELS[value] ?? 'registrado';
}

function humanPriority(value: string) {
  return PRIORITY_LABELS[value] ?? 'registrada';
}

function humanOrigin(value: string) {
  return ORIGIN_LABELS[value] ?? (value.includes('_') ? 'actividad operativa' : value);
}

export type ConversationalCitation = {
  type: ConversationCitationType;
  referenceId: string;
  label: string;
  deepLink?: string;
  sourceSnapshot?: unknown;
};

export type ConversationalActionResult = {
  summary: string;
  data: unknown;
  citations: ConversationalCitation[];
  resultReference?: { type: string; id: string };
  attachmentReference?: { destinationType: string; destinationId: string; label: string };
};

const uuid = z.string().uuid();
const queueInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.string().max(80).optional(),
  workCenterId: uuid.optional(),
  assignedToUserId: uuid.optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
  module: z
    .enum([
      'INSPECTIONS',
      'TECHNICAL_RISK',
      'REGULATORY',
      'OPERATIONAL_EXECUTION',
      'WORK_PERMITS',
      'INCIDENTS',
      'PPE',
      'TRAINING',
    ])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});
const sourceIdInput = z.object({
  sourceId: z.string().min(1),
  type: z.string().max(80).optional(),
});
const inspectionInput = z.object({ inspectionId: uuid });
const basisInput = z
  .object({
    basisVersionId: uuid.optional(),
    inspectionDomain: z
      .enum([
        'ELECTRICAL',
        'FIRE_PROTECTION',
        'MACHINERY',
        'CHEMICAL_STORAGE',
        'EMERGENCY',
        'INFRASTRUCTURE',
      ])
      .optional(),
  })
  .refine(({ basisVersionId, inspectionDomain }) => Boolean(basisVersionId || inspectionDomain), {
    message: 'Indica la versión o el dominio de la base de inspección.',
  });
const criterionInput = z.object({ inspectionId: uuid, criterionId: uuid });
const regulatoryUnitInput = z.object({ unitId: uuid });
const evidenceContextInput = z.object({ inspectionId: uuid, evidenceId: uuid });
const workerInput = z.object({ workerId: uuid });
const incidentInput = z.object({ incidentId: uuid });
const workPermitInput = z.object({ workPermitId: uuid });
const obligationInput = z.object({ obligationId: uuid });
const createInspectionInput = z.object({
  workCenterId: uuid,
  riskMethodVersionId: uuid,
  inspectionDomain: z.enum([
    'ELECTRICAL',
    'FIRE_PROTECTION',
    'MACHINERY',
    'CHEMICAL_STORAGE',
    'EMERGENCY',
    'INFRASTRUCTURE',
  ]),
  workAreaId: uuid.optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2_000).optional(),
  scheduledFor: z.string().datetime().optional(),
});
const recordCriterionInput = z.object({
  inspectionId: uuid,
  criterionId: uuid,
  outcome: z.enum(['CONFORME', 'NO_CONFORME', 'NO_APLICA', 'NO_VERIFICADO']),
  note: z.string().trim().min(1).max(2_000).optional(),
  evidenceReferences: z.array(z.string().trim().min(1).max(1_000)).max(20).optional(),
});
const attachEvidenceInput = z.discriminatedUnion('targetType', [
  z.object({
    targetType: z.literal('INSPECTION_CRITERION'),
    inspectionId: uuid,
    criterionId: uuid,
    reference: z.string().trim().min(3).max(1_000),
  }),
  z.object({
    targetType: z.literal('CORRECTIVE_ACTION'),
    inspectionId: uuid,
    findingId: uuid,
    actionId: uuid,
    type: z.enum(['NOTE', 'EXTERNAL_LINK']),
    note: z.string().trim().min(1).max(2_000).optional(),
    externalUrl: z.string().url().startsWith('https://').optional(),
  }),
]);
const createFindingInput = z.object({
  inspectionId: uuid,
  criterionResultId: uuid.optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(4_000),
  category: z.enum(FINDING_CATEGORIES),
  methodInput: z.record(z.string(), z.unknown()).optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  consequence: z.number().int().min(1).max(5).optional(),
});
const createActionInput = z.object({
  inspectionId: uuid,
  findingId: uuid,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2_000).optional(),
  assignedToUserId: uuid.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueAt: z.string().datetime().optional(),
});
const assignActionInput = z.object({
  inspectionId: uuid,
  findingId: uuid,
  actionId: uuid,
  assignedToUserId: uuid,
});

@Injectable()
export class ConversationalActionRegistryService {
  constructor(
    private readonly queue: WorkQueueService,
    private readonly inspections: InspectionsService,
    private readonly bases: InspectionBasisService,
    private readonly regulatory: RegulatorySourceService,
    private readonly workers: WorkersService,
    private readonly incidents: IncidentsService,
    private readonly ppe: PpeService,
    private readonly training: TrainingService,
    private readonly permits: WorkPermitsService,
    private readonly obligations: OperationalExecutionService,
    private readonly entitlements: EntitlementService,
  ) {}

  keys() {
    return [...CONVERSATIONAL_ACTION_KEYS];
  }

  async execute(actionKey: ConversationActionKey, rawInput: unknown, actor: Actor) {
    switch (actionKey) {
      case 'get_my_work_queue':
        return this.getMyWorkQueue(rawInput, actor);
      case 'get_work_item_context':
      case 'explain_work_item':
        return this.getWorkItem(rawInput, actor, actionKey === 'explain_work_item');
      case 'get_inspection_context':
        return this.getInspection(rawInput, actor);
      case 'get_inspection_basis':
        return this.getBasis(rawInput, actor);
      case 'get_criterion_context':
      case 'get_criterion_provenance':
        return this.getCriterion(rawInput, actor, actionKey === 'get_criterion_provenance');
      case 'get_regulatory_unit':
        return this.getRegulatoryUnit(rawInput);
      case 'get_evidence_context':
        return this.getEvidence(rawInput, actor);
      case 'get_worker_context':
        return this.getWorker(rawInput, actor);
      case 'get_incident_context':
        return this.getIncident(rawInput, actor);
      case 'get_ppe_context':
        return this.getPpe(rawInput, actor);
      case 'get_training_context':
        return this.getTraining(rawInput, actor);
      case 'get_work_permit_context':
        return this.getWorkPermit(rawInput, actor);
      case 'get_obligation_context':
        return this.getObligation(rawInput, actor);
      case 'create_inspection':
        return this.createInspection(rawInput, actor);
      case 'start_inspection':
        return this.startInspection(rawInput, actor);
      case 'record_criterion_result':
        return this.recordCriterion(rawInput, actor);
      case 'attach_evidence':
        return this.attachEvidence(rawInput, actor);
      case 'create_finding':
        return this.createFinding(rawInput, actor);
      case 'create_action':
        return this.createAction(rawInput, actor);
      case 'assign_action':
        return this.assignAction(rawInput, actor);
    }
  }

  private async getMyWorkQueue(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    const input = this.parse(queueInput, rawInput);
    const result = await this.queue.list(actor.organizationId, input);
    return {
      summary: result.items.length
        ? `Encontré ${result.items.length} elementos autorizados en tu cola de trabajo.`
        : 'No encontré elementos pendientes con esos filtros.',
      data: result,
      citations: result.items.map((item) => this.workItemCitation(item)),
    };
  }

  private async getWorkItem(
    rawInput: unknown,
    actor: Actor,
    explanation: boolean,
  ): Promise<ConversationalActionResult> {
    const input = this.parse(sourceIdInput, rawInput);
    const queue = await this.queue.list(actor.organizationId, { page: 1, pageSize: 100 });
    const item = queue.items.find(
      (candidate) =>
        candidate.sourceId === input.sourceId && (!input.type || candidate.type === input.type),
    );
    if (!item)
      throw new NotFoundException('Elemento de trabajo no encontrado en la organización activa.');
    const citations = [this.workItemCitation(item)];
    if (item.module === 'INSPECTIONS') {
      const inspectionId = item.deepLink.match(/\/app\/inspections\/([^?]+)/)?.[1];
      if (inspectionId) {
        const inspection = await this.inspections.get(actor.organizationId, inspectionId);
        citations.push(...this.inspectionCitations(inspection));
      }
    }
    return {
      summary: explanation
        ? `${item.title}: ${item.summary} Prioridad ${humanPriority(item.priority)}; origen ${humanOrigin(item.origin)}.`
        : `Contexto autorizado de ${item.title}.`,
      data: item,
      citations,
      resultReference: { type: 'WORK_ITEM', id: item.sourceId },
    };
  }

  private async getInspection(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    await this.requireInspection(actor.organizationId);
    const { inspectionId } = this.parse(inspectionInput, rawInput);
    const inspection = await this.inspections.get(actor.organizationId, inspectionId);
    return {
      summary: `Inspección ${inspection.title}: estado ${humanState(inspection.status)}.`,
      data: inspection,
      citations: this.inspectionCitations(inspection),
      resultReference: { type: 'INSPECTION', id: inspection.id },
    };
  }

  private async getBasis(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    await this.requireInspection(actor.organizationId);
    const input = this.parse(basisInput, rawInput);
    const basis = input.basisVersionId
      ? await this.bases.getVersion(actor.organizationId, input.basisVersionId)
      : await this.bases.activeOrNull(
          actor.organizationId,
          input.inspectionDomain as InspectionDomain,
        );
    if (!basis)
      throw new NotFoundException('No hay una Base de inspección activa para ese dominio.');
    return {
      summary: `Base ${basis.definition.name}, versión ${basis.version}, estado ${humanState(basis.status)}.`,
      data: basis,
      citations: this.basisCitations(basis),
      resultReference: { type: 'INSPECTION_BASIS_VERSION', id: basis.id },
    };
  }

  private async getCriterion(
    rawInput: unknown,
    actor: Actor,
    provenanceOnly: boolean,
  ): Promise<ConversationalActionResult> {
    await this.requireInspection(actor.organizationId);
    const { inspectionId, criterionId } = this.parse(criterionInput, rawInput);
    const inspection = await this.inspections.get(actor.organizationId, inspectionId);
    const result = inspection.criterionResults.find(
      ({ criterion }) => criterion.id === criterionId,
    );
    if (!result) throw new NotFoundException('Criterio no encontrado en esta inspección.');
    const basis = inspection.inspectionBasisVersionId
      ? await this.bases.getVersion(actor.organizationId, inspection.inspectionBasisVersionId)
      : null;
    const regulatoryLinks =
      basis?.criterionRegulatoryLinks.filter(({ criterion }) => criterion.id === criterionId) ?? [];
    const citations: ConversationalCitation[] = [
      {
        type: 'INSPECTION_STANDARD_CRITERION',
        referenceId: result.criterion.id,
        label: `${result.criterion.code} · ${result.criterion.title}`,
        deepLink: `/app/inspections/${inspection.id}#criterion-${result.criterion.id}`,
        sourceSnapshot: {
          sourceLocator: result.criterion.sourceLocator,
          standardVersionId: result.criterion.standardVersionId,
        },
      },
      {
        type: 'INSPECTION_STANDARD_VERSION',
        referenceId: result.criterion.standardVersion.id,
        label: `${result.criterion.standardVersion.source.name} · ${result.criterion.standardVersion.editionLabel}`,
        sourceSnapshot: {
          jurisdiction: result.criterion.standardVersion.source.originCountry,
          referenceUrl: result.criterion.standardVersion.source.referenceUrl,
          rightsType: result.criterion.standardVersion.source.rightsType,
        },
      },
      ...regulatoryLinks.map(({ regulatoryUnit }) => this.regulatoryCitation(regulatoryUnit)),
    ];
    if (basis) citations.unshift(...this.basisCitations(basis).slice(0, 1));
    return {
      summary: provenanceOnly
        ? 'Esta explicación usa únicamente las relaciones de procedencia almacenadas.'
        : `${result.criterion.title} Resultado actual: ${humanState(result.outcome)}.`,
      data: { result, regulatoryLinks, semanticBoundary: 'STORED_RELATIONSHIPS_ONLY' },
      citations,
      resultReference: { type: 'INSPECTION_STANDARD_CRITERION', id: criterionId },
    };
  }

  private async getRegulatoryUnit(rawInput: unknown): Promise<ConversationalActionResult> {
    const { unitId } = this.parse(regulatoryUnitInput, rawInput);
    const result = await this.regulatory.getUnit(unitId);
    const safe = {
      unit: {
        id: result.unit.id,
        unitType: result.unit.unitType,
        identifier: result.unit.identifier,
        heading: result.unit.heading,
        locator: result.unit.locator,
        reviewStatus: result.unit.reviewStatus,
      },
      source: result.source,
      sourceVersion: result.sourceVersion,
      textBoundary: result.textBoundary,
    };
    return {
      summary: `${result.unit.identifier}: ${result.unit.heading ?? result.unit.locator}.`,
      data: safe,
      citations: [
        this.regulatoryCitation({ ...result.unit, sourceVersion: { source: result.source } }),
      ],
      resultReference: { type: 'REGULATORY_UNIT', id: unitId },
    };
  }

  private async getEvidence(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    await this.requireInspection(actor.organizationId);
    const { inspectionId, evidenceId } = this.parse(evidenceContextInput, rawInput);
    const inspection = await this.inspections.get(actor.organizationId, inspectionId);
    const evidence = inspection.findings
      .flatMap(({ actions }) => actions.flatMap(({ evidence }) => evidence))
      .find(({ id }) => id === evidenceId);
    if (!evidence) throw new NotFoundException('Referencia de evidencia no encontrada.');
    return {
      summary: 'Evidencia canónica vinculada a la inspección.',
      data: evidence,
      citations: [],
      resultReference: { type: 'ACTION_EVIDENCE', id: evidence.id },
    };
  }

  private async getWorker(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    const { workerId } = this.parse(workerInput, rawInput);
    const worker = await this.workers.get(actor.organizationId, workerId);
    const safe = {
      id: worker.id,
      displayName: worker.displayName,
      status: worker.status,
      jobTitle: worker.jobTitle,
      workCenter: worker.workCenter,
      startDate: worker.startDate,
      endDate: worker.endDate,
    };
    return {
      summary: `${worker.displayName}: estado ${humanState(worker.status)}.`,
      data: safe,
      citations: [],
      resultReference: { type: 'WORKER', id: worker.id },
    };
  }

  private async getIncident(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    await this.entitlements.require(actor.organizationId, INCIDENTS_FEATURE_KEY);
    const { incidentId } = this.parse(incidentInput, rawInput);
    const incident = await this.incidents.get(actor.organizationId, incidentId);
    return {
      summary: `Incidente ${incident.title}: estado ${humanState(incident.status)}.`,
      data: incident,
      citations: [],
      resultReference: { type: 'INCIDENT', id: incident.id },
    };
  }

  private async getPpe(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    await this.entitlements.require(actor.organizationId, PPE_FEATURE_KEY);
    const { workerId } = this.parse(workerInput, rawInput);
    const workspace = await this.ppe.workerWorkspace(actor.organizationId, workerId);
    return {
      summary: `${workspace.worker.displayName}: ${workspace.requirements.length} requerimientos y ${workspace.issues.length} entregas de EPP registradas.`,
      data: workspace,
      citations: [],
      resultReference: { type: 'WORKER_PPE_CONTEXT', id: workerId },
    };
  }

  private async getTraining(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    await this.entitlements.require(actor.organizationId, TRAINING_FEATURE_KEY);
    const { workerId } = this.parse(workerInput, rawInput);
    const workspace = await this.training.workerWorkspace(actor.organizationId, workerId);
    return {
      summary: `${workspace.worker.displayName}: ${workspace.requirements.length} competencias y ${workspace.completions.length} completaciones registradas.`,
      data: workspace,
      citations: [],
      resultReference: { type: 'WORKER_TRAINING_CONTEXT', id: workerId },
    };
  }

  private async getWorkPermit(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    await this.entitlements.require(actor.organizationId, WORK_PERMITS_FEATURE_KEY);
    const { workPermitId } = this.parse(workPermitInput, rawInput);
    const permit = await this.permits.get(actor.organizationId, workPermitId);
    return {
      summary: `Permiso ${permit.activity}: estado ${humanState(permit.status)}.`,
      data: permit,
      citations: [],
      resultReference: { type: 'WORK_PERMIT', id: permit.id },
    };
  }

  private async getObligation(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    const { obligationId } = this.parse(obligationInput, rawInput);
    const obligation = await this.obligations.get(actor.organizationId, obligationId);
    const citations = obligation.regulatoryUnit
      ? [this.regulatoryCitation(obligation.regulatoryUnit)]
      : [];
    return {
      summary: `Actividad ${obligation.title}: estado ${humanState(obligation.status)}.`,
      data: obligation,
      citations,
      resultReference: { type: 'OBLIGATION_EXECUTION', id: obligation.id },
    };
  }

  private async createInspection(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    await this.requireInspectionWrite(actor);
    const input = this.parse(createInspectionInput, rawInput);
    const activeBasis = await this.bases.activeOrNull(actor.organizationId, input.inspectionDomain);
    if (!activeBasis) {
      throw new BadRequestException({
        code: 'ACTIVE_INSPECTION_BASIS_REQUIRED',
        message: 'Configura una Base de inspección activa antes de iniciar desde el asistente.',
      });
    }
    const inspection = await this.inspections.create(
      actor.organizationId,
      actor.userId,
      input,
      actor.audit,
    );
    return {
      summary: `Inspección ${inspection.title} creada en borrador.`,
      data: inspection,
      citations: this.basisCitations(activeBasis),
      resultReference: { type: 'INSPECTION', id: inspection.id },
    };
  }

  private async startInspection(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    await this.requireInspectionWrite(actor);
    const { inspectionId } = this.parse(inspectionInput, rawInput);
    const result = await this.inspections.transition(
      actor.organizationId,
      inspectionId,
      'IN_PROGRESS',
      actor.userId,
      actor.audit,
    );
    return {
      summary: 'Inspección iniciada. Ya puedes registrar criterios.',
      data: result,
      citations: [],
      resultReference: { type: 'INSPECTION', id: inspectionId },
    };
  }

  private async recordCriterion(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    await this.requireInspectionWrite(actor);
    const input = this.parse(recordCriterionInput, rawInput);
    const result = await this.inspections.updateCriterionResult(
      actor.organizationId,
      input.inspectionId,
      input.criterionId,
      actor.userId,
      {
        outcome: input.outcome as InspectionCriterionOutcome,
        note: input.note,
        evidenceReferences: input.evidenceReferences,
      },
      actor.audit,
    );
    return {
      summary: `Criterio registrado como ${humanState(result.outcome)}.`,
      data: result,
      citations: [
        {
          type: 'INSPECTION_STANDARD_CRITERION',
          referenceId: result.criterion.id,
          label: `${result.criterion.code} · ${result.criterion.title}`,
          deepLink: `/app/inspections/${input.inspectionId}#criterion-${result.criterion.id}`,
        },
      ],
      resultReference: { type: 'INSPECTION_CRITERION_RESULT', id: result.id },
    };
  }

  private async attachEvidence(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    await this.requireInspectionWrite(actor);
    const input = this.parse(attachEvidenceInput, rawInput);
    if (input.targetType === 'INSPECTION_CRITERION') {
      const inspection = await this.inspections.get(actor.organizationId, input.inspectionId);
      const current = inspection.criterionResults.find(
        ({ criterion }) => criterion.id === input.criterionId,
      );
      if (!current) throw new NotFoundException('Criterio no encontrado en esta inspección.');
      const currentReferences = Array.isArray(current.evidenceReferences)
        ? current.evidenceReferences.filter(
            (reference): reference is string => typeof reference === 'string',
          )
        : [];
      const references = [...new Set([...currentReferences, input.reference])];
      const result = await this.inspections.updateCriterionResult(
        actor.organizationId,
        input.inspectionId,
        input.criterionId,
        actor.userId,
        {
          outcome: current.outcome,
          note: current.note ?? undefined,
          evidenceReferences: references,
        },
        actor.audit,
      );
      return {
        summary: 'Referencia de evidencia vinculada al criterio canónico.',
        data: result,
        citations: [],
        resultReference: { type: 'INSPECTION_CRITERION_RESULT', id: result.id },
        attachmentReference: {
          destinationType: 'INSPECTION_CRITERION_RESULT',
          destinationId: result.id,
          label: input.reference,
        },
      };
    }
    const evidence = await this.inspections.addEvidence(
      actor.organizationId,
      input.inspectionId,
      input.findingId,
      input.actionId,
      actor.userId,
      { type: input.type, note: input.note, externalUrl: input.externalUrl },
    );
    return {
      summary: 'Evidencia vinculada a la acción correctiva canónica.',
      data: evidence,
      citations: [
        {
          type: 'ACTION',
          referenceId: input.actionId,
          label: 'Acción correctiva',
          deepLink: `/app/inspections/${input.inspectionId}?finding=${input.findingId}&action=${input.actionId}`,
        },
      ],
      resultReference: { type: 'ACTION_EVIDENCE', id: evidence.id },
      attachmentReference: {
        destinationType: 'ACTION_EVIDENCE',
        destinationId: evidence.id,
        label: evidence.externalUrl ?? evidence.note ?? evidence.type,
      },
    };
  }

  private async createFinding(
    rawInput: unknown,
    actor: Actor,
  ): Promise<ConversationalActionResult> {
    await this.requireInspectionWrite(actor);
    const input = this.parse(createFindingInput, rawInput);
    const finding = await this.inspections.createFinding(
      actor.organizationId,
      input.inspectionId,
      actor.userId,
      input,
      actor.audit,
    );
    return {
      summary: `Hallazgo ${finding.title} creado con cálculo de riesgo canónico.`,
      data: finding,
      citations: [
        {
          type: 'FINDING',
          referenceId: finding.id,
          label: finding.title,
          deepLink: `/app/inspections/${input.inspectionId}?finding=${finding.id}`,
        },
      ],
      resultReference: { type: 'FINDING', id: finding.id },
    };
  }

  private async createAction(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    await this.requireInspectionWrite(actor);
    const input = this.parse(createActionInput, rawInput);
    const action = await this.inspections.createAction(
      actor.organizationId,
      input.inspectionId,
      input.findingId,
      actor.userId,
      input,
      actor.audit,
    );
    return {
      summary: `Acción ${action.title} creada${action.assignedTo ? ` y asignada a ${action.assignedTo.displayName}` : ''}.`,
      data: action,
      citations: [
        {
          type: 'ACTION',
          referenceId: action.id,
          label: action.title,
          deepLink: `/app/inspections/${input.inspectionId}?finding=${input.findingId}&action=${action.id}`,
        },
      ],
      resultReference: { type: 'ACTION', id: action.id },
    };
  }

  private async assignAction(rawInput: unknown, actor: Actor): Promise<ConversationalActionResult> {
    await this.requireInspectionWrite(actor);
    const input = this.parse(assignActionInput, rawInput);
    const action = await this.inspections.updateAction(
      actor.organizationId,
      input.inspectionId,
      input.findingId,
      input.actionId,
      actor.userId,
      { assignedToUserId: input.assignedToUserId },
      actor.audit,
    );
    return {
      summary: `Acción asignada a ${action.assignedTo?.displayName ?? 'la persona seleccionada'}.`,
      data: action,
      citations: [
        {
          type: 'ACTION',
          referenceId: action.id,
          label: action.title,
          deepLink: `/app/inspections/${input.inspectionId}?finding=${input.findingId}&action=${action.id}`,
        },
      ],
      resultReference: { type: 'ACTION', id: action.id },
    };
  }

  private async requireInspection(organizationId: string) {
    return this.entitlements.require(organizationId, 'module.inspections');
  }

  private async requireInspectionWrite(actor: Actor) {
    await this.requireInspection(actor.organizationId);
    if (!(INSPECTION_WRITE_ROLES as readonly string[]).includes(actor.role)) {
      throw new ForbiddenException({
        code: 'CONVERSATIONAL_ACTION_ROLE_FORBIDDEN',
        message: 'Tu rol actual no permite esta acción desde la interfaz normal ni conversacional.',
      });
    }
  }

  private inspectionCitations(inspection: Awaited<ReturnType<InspectionsService['get']>>) {
    const citations: ConversationalCitation[] = [];
    if (inspection.inspectionBasisVersion) {
      citations.push({
        type: 'INSPECTION_BASIS_VERSION',
        referenceId: inspection.inspectionBasisVersion.id,
        label: `${inspection.inspectionBasisVersion.definition.name} · v${inspection.inspectionBasisVersion.version}`,
        deepLink: `/app/settings/inspection-bases?version=${inspection.inspectionBasisVersion.id}`,
        sourceSnapshot: inspection.inspectionBasisSnapshot,
      });
      for (const { standardVersion } of inspection.inspectionBasisVersion.technicalSources) {
        citations.push({
          type: 'INSPECTION_STANDARD_VERSION',
          referenceId: standardVersion.id,
          label: `${standardVersion.source.name} · ${standardVersion.editionLabel}`,
          sourceSnapshot: {
            role: 'TECHNICAL_SOURCE',
            jurisdiction: standardVersion.source.originCountry,
            referenceUrl: standardVersion.source.referenceUrl,
          },
        });
      }
      citations.push(
        ...inspection.inspectionBasisVersion.regulatoryUnits.map(({ regulatoryUnit }) =>
          this.regulatoryCitation(regulatoryUnit),
        ),
      );
    } else if (inspection.standardVersion) {
      citations.push({
        type: 'INSPECTION_STANDARD_VERSION',
        referenceId: inspection.standardVersion.id,
        label: `${inspection.standardVersion.source.name} · ${inspection.standardVersion.editionLabel}`,
        sourceSnapshot: inspection.standardSnapshot,
      });
    }
    return citations;
  }

  private basisCitations(basis: Awaited<ReturnType<InspectionBasisService['getVersion']>>) {
    return [
      {
        type: 'INSPECTION_BASIS_VERSION' as const,
        referenceId: basis.id,
        label: `${basis.definition.name} · v${basis.version}`,
        deepLink: `/app/settings/inspection-bases?version=${basis.id}`,
        sourceSnapshot: {
          inspectionDomain: basis.inspectionDomain,
          contentDigest: basis.contentDigest,
          semanticBoundary: basis.semanticBoundary,
        },
      },
      ...basis.technicalSources.map(({ standardVersion }) => ({
        type: 'INSPECTION_STANDARD_VERSION' as const,
        referenceId: standardVersion.id,
        label: `${standardVersion.source.name} · ${standardVersion.editionLabel}`,
        sourceSnapshot: {
          jurisdiction: standardVersion.source.originCountry,
          referenceUrl: standardVersion.source.referenceUrl,
          rightsType: standardVersion.source.rightsType,
        },
      })),
      ...basis.regulatoryUnits.map(({ regulatoryUnit }) => this.regulatoryCitation(regulatoryUnit)),
    ];
  }

  private regulatoryCitation(unit: {
    id: string;
    identifier: string;
    locator: string;
    sourceVersion: { source: { canonicalTitle: string; countryCode?: string | null } };
  }): ConversationalCitation {
    return {
      type: 'REGULATORY_UNIT',
      referenceId: unit.id,
      label: `${unit.identifier} · ${unit.locator}`,
      deepLink: `/app/applicability/sources?unit=${unit.id}`,
      sourceSnapshot: {
        source: unit.sourceVersion.source.canonicalTitle,
        jurisdiction: unit.sourceVersion.source.countryCode ?? null,
      },
    };
  }

  private workItemCitation(item: {
    type: string;
    sourceId: string;
    title: string;
    deepLink: string;
    origin: string;
    regulatoryContext: { label: string; candidate: boolean } | null;
  }): ConversationalCitation {
    return {
      type: 'WORK_ITEM',
      referenceId: item.sourceId,
      label: item.title,
      deepLink: item.deepLink,
      sourceSnapshot: {
        type: item.type,
        origin: item.origin,
        regulatoryContext: item.regulatoryContext,
      },
    };
  }

  private parse<T>(schema: z.ZodType<T>, rawInput: unknown): T {
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_CONVERSATIONAL_ACTION_INPUT',
        message: parsed.error.issues[0]?.message ?? 'Los datos de la acción no son válidos.',
      });
    }
    return parsed.data;
  }
}
