import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  adaptiveContentHash,
  deriveGapAnalysisItems,
  gapAnalysisItemSchema,
  operationalPlanVersionInputSchema,
  type GapCandidate,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { OperationalPlansService } from '../operational-plans/operational-plans.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ConvertGapToPlanDto, CreateGapAnalysisDto, GapAnalysisQueryDto } from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

@Injectable()
export class AdaptiveIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: OperationalPlansService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: GapAnalysisQueryDto) {
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.organizationGapAnalysis.findMany({
        where,
        orderBy: { version: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.organizationGapAnalysis.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(organizationId: string, id: string) {
    const item = await this.prisma.organizationGapAnalysis.findFirst({
      where: { id, organizationId },
    });
    if (!item) throw new NotFoundException('Análisis de brechas no encontrado.');
    return item;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateGapAnalysisDto,
    context: Context,
  ) {
    const resolved =
      input.sourceType === 'ADAPTIVE_CONFIGURATION'
        ? await this.fromAdaptiveProposal(organizationId, input.sourceId)
        : await this.fromUnifiedEvaluation(organizationId, input.sourceId);
    const items = deriveGapAnalysisItems(
      { type: input.sourceType, id: input.sourceId },
      resolved.candidates,
    );
    const inputHash = adaptiveContentHash({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      candidates: resolved.candidates,
    });
    const outputHash = adaptiveContentHash(items);
    const created = await this.createVersion(organizationId, userId, {
      profileVersionId: resolved.profileVersionId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      inputHash,
      outputHash,
      items,
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'GAP_ANALYSIS_CREATED',
      entityType: 'OrganizationGapAnalysis',
      entityId: created.id,
      metadata: {
        version: created.version,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        itemCount: items.length,
      },
      ...context,
    });
    return created;
  }

  async convertToPlan(
    organizationId: string,
    userId: string,
    id: string,
    input: ConvertGapToPlanDto,
    context: Context,
  ) {
    const analysis = await this.get(organizationId, id);
    const allItems = (Array.isArray(analysis.items) ? analysis.items : []).map((item) =>
      gapAnalysisItemSchema.parse(item),
    );
    const selectedKeys = [...new Set(input.selectedItemKeys)];
    if (!selectedKeys.length || selectedKeys.length > 50)
      throw new BadRequestException('Selecciona entre 1 y 50 brechas.');
    const selected = selectedKeys.map((key) => allItems.find((item) => item.key === key));
    if (selected.some((item) => !item))
      throw new BadRequestException('Una brecha seleccionada no pertenece al análisis activo.');
    const planInput = operationalPlanVersionInputSchema.parse({
      name: input.name,
      description: input.description,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      origin: 'DETERMINISTIC_DRAFT',
      provenance: {
        sourceType: 'GAP_ANALYSIS',
        analysisId: analysis.id,
        analysisVersion: analysis.version,
        outputHash: analysis.outputHash,
        explicitSelection: true,
      },
      items: selected.map((item) => ({
        title: item!.title,
        description: item!.explanation,
        priority: 'MEDIUM',
        workCenterId: item!.workCenterId ?? undefined,
        evidenceReferences: item!.evidenceReferences,
        provenanceType: 'GAP_ANALYSIS',
        provenanceReference: `${analysis.id}:${item!.key}`.slice(0, 240),
        provenanceSnapshot: {
          analysisId: analysis.id,
          analysisVersion: analysis.version,
          gapKey: item!.key,
          gapType: item!.type,
          expectedState: item!.expectedState,
          knownState: item!.knownState,
        },
      })),
    });
    return this.plans.createGapDraft(organizationId, userId, planInput, context);
  }

  private async fromAdaptiveProposal(organizationId: string, id: string) {
    const proposal = await this.prisma.adaptiveConfigurationProposal.findFirst({
      where: { id, organizationId },
      include: {
        session: { select: { profileVersionId: true } },
        items: {
          include: {
            scope: true,
            targetVersion: { include: { targetDefinition: true } },
            currentState: { include: { evidence: true } },
          },
        },
      },
    });
    if (!proposal) throw new NotFoundException('Propuesta adaptativa no encontrada.');
    const candidates: GapCandidate[] = proposal.items.map((item) => ({
      itemId: item.id,
      targetKey: item.targetVersion.targetDefinition.targetKey,
      title: item.targetVersion.title,
      expectedState: item.state,
      currentState:
        item.currentState?.status === 'IMPLEMENTED'
          ? 'IMPLEMENTED'
          : item.currentState?.status === 'NOT_IMPLEMENTED'
            ? 'NOT_IMPLEMENTED'
            : ['PLANNED', 'IN_PROGRESS', 'PARTIALLY_IMPLEMENTED'].includes(
                  item.currentState?.status ?? '',
                )
              ? 'PARTIALLY_IMPLEMENTED'
              : 'UNKNOWN',
      evidenceReferences: item.currentState?.evidence.map(
        (evidence) => evidence.externalUrl ?? evidence.note ?? evidence.id,
      ),
      missingFacts: Array.isArray(item.missingFacts) ? item.missingFacts.map(String) : [],
      professionalReviewRequired: item.professionalReview,
      workCenterId: item.scope.kind === 'WORK_CENTER' ? item.scope.workCenterId : null,
    }));
    return { profileVersionId: proposal.session.profileVersionId, candidates };
  }

  private async fromUnifiedEvaluation(organizationId: string, id: string) {
    const evaluation = await this.prisma.unifiedSstEvaluation.findFirst({
      where: { id, organizationId },
      include: { items: { include: { requirement: true } } },
    });
    if (!evaluation) throw new NotFoundException('Evaluación SST no encontrada.');
    const candidates: GapCandidate[] = evaluation.items.map((item) => {
      const state =
        item.currentStateSnapshot &&
        typeof item.currentStateSnapshot === 'object' &&
        !Array.isArray(item.currentStateSnapshot) &&
        'status' in item.currentStateSnapshot
          ? String(item.currentStateSnapshot.status)
          : 'UNKNOWN';
      return {
        itemId: item.id,
        targetKey: item.requirement.requirementKey,
        title: item.requirement.title,
        expectedState: item.proposedState,
        currentState:
          state === 'IMPLEMENTED'
            ? 'IMPLEMENTED'
            : state === 'NOT_IMPLEMENTED'
              ? 'NOT_IMPLEMENTED'
              : ['PLANNED', 'IN_PROGRESS', 'PARTIALLY_IMPLEMENTED'].includes(state)
                ? 'PARTIALLY_IMPLEMENTED'
                : 'UNKNOWN',
        evidenceReferences: Array.isArray(item.organizationEvidence)
          ? item.organizationEvidence
              .map((entry) =>
                typeof entry === 'object' && entry && 'externalUrl' in entry
                  ? String(entry.externalUrl ?? '')
                  : '',
              )
              .filter(Boolean)
          : [],
        professionalReviewRequired: item.professionalReviewRequired,
      };
    });
    return { profileVersionId: evaluation.profileVersionId, candidates };
  }

  private async createVersion(
    organizationId: string,
    userId: string,
    data: Omit<
      Prisma.OrganizationGapAnalysisUncheckedCreateInput,
      'id' | 'organizationId' | 'version' | 'createdById'
    >,
  ) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
            const latest = await tx.organizationGapAnalysis.findFirst({
              where: { organizationId },
              orderBy: { version: 'desc' },
              select: { version: true },
            });
            return tx.organizationGapAnalysis.create({
              data: {
                ...data,
                organizationId,
                createdById: userId,
                version: (latest?.version ?? 0) + 1,
                items: data.items as Prisma.InputJsonValue,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2002');
        if (!retryable || attempt === 3)
          throw retryable
            ? new ConflictException('No se pudo asignar una versión de análisis.')
            : error;
      }
    }
    throw new ConflictException('No se pudo asignar una versión de análisis.');
  }
}
