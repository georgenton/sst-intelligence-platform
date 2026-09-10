import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { evaluateAdaptiveConfiguration, organizationSstProfileSchema } from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { AddUnifiedOrganizationEvidenceDto, ReviewRegulatoryInterpretationDto } from './dto';
import {
  loadRegulatoryCandidatePack,
  normalizeRegulatoryCountryCode,
} from './regulatory-candidate-evaluator';

const workspaceInclude = {
  ruleDefinition: { select: { ruleKey: true } },
  requirements: {
    include: {
      requirement: {
        include: {
          sources: {
            include: {
              provision: {
                include: {
                  units: {
                    include: {
                      unit: {
                        include: {
                          sourceVersion: { include: { source: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class UnifiedSstEvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  async expertWorkspace() {
    const drafts = await this.prisma.adaptiveRuleDraft.findMany({
      where: {
        regulatory: true,
        status: { in: ['TECHNICAL_REVIEW_PENDING', 'LEGAL_REVIEW_PENDING'] },
      },
      include: workspaceInclude,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
    const reviews = await this.prisma.regulatoryInterpretationReview.findMany({
      where: { ruleDraftId: { in: drafts.map(({ id }) => id) } },
      select: {
        id: true,
        ruleDraftId: true,
        decision: true,
        comment: true,
        createdAt: true,
        reviewer: { select: { id: true, displayName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return drafts.map((draft) => ({
      id: draft.id,
      revision: draft.revision,
      status: draft.status,
      ruleKey: draft.ruleDefinition.ruleKey,
      rule: draft.schema,
      candidateLabel: 'Interpretación propuesta',
      requirements: draft.requirements.map(({ requirement, relationshipType }) => ({
        relationshipType,
        id: requirement.id,
        requirementKey: requirement.requirementKey,
        title: requirement.title,
        description: requirement.description,
        editorialStatus: requirement.editorialStatus,
        exactArticles: requirement.sources.flatMap(({ provision }) =>
          provision.units.map(({ unit }) => ({
            id: unit.id,
            identifier: unit.identifier,
            locator: unit.locator,
            officialText: unit.officialText,
            normalizedTextHash: unit.normalizedTextHash,
            sourceVersionId: unit.sourceVersionId,
            sourceKey: unit.sourceVersion.source.sourceKey,
            sourceTitle: unit.sourceVersion.source.canonicalTitle,
            officialUrl: unit.sourceVersion.officialUrl,
            artifactVerificationStatus: unit.sourceVersion.artifactVerificationStatus,
            vigenciaReviewStatus: unit.sourceVersion.vigenciaReviewStatus,
          })),
        ),
      })),
      publicationBoundary: 'REVIEW_DOES_NOT_AUTO_PUBLISH',
      reviews: reviews.filter(({ ruleDraftId }) => ruleDraftId === draft.id),
      professionalDecision:
        'El profesional decide aprobar, rechazar, solicitar cambios o revisión legal; la publicación es un proceso separado.',
    }));
  }

  async create(organizationId: string, userId: string, profileVersionId: string) {
    const [profile, organization, drafts] = await Promise.all([
      this.prisma.organizationSstProfileVersion.findFirst({
        where: { id: profileVersionId, organizationId },
      }),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.adaptiveRuleDraft.findMany({
        where: {
          regulatory: true,
          status: { in: ['TECHNICAL_REVIEW_PENDING', 'LEGAL_REVIEW_PENDING'] },
        },
        include: workspaceInclude,
      }),
    ]);
    if (!profile || !organization) throw new NotFoundException('Perfil SST no encontrado.');
    const snapshot = organizationSstProfileSchema.parse(profile.snapshot);
    const pack = loadRegulatoryCandidatePack();
    const facts = [
      {
        scopeKey: 'organization',
        factKey: 'organization.country',
        source: 'ORGANIZATION_PROFILE',
        value: normalizeRegulatoryCountryCode(snapshot.organization.country),
      },
      ...(snapshot.organization.workerCount === undefined
        ? []
        : [
            {
              scopeKey: 'organization',
              factKey: 'organization.totalWorkerCount',
              source: 'ORGANIZATION_PROFILE',
              value: snapshot.organization.workerCount,
            },
          ]),
    ];
    const result = evaluateAdaptiveConfiguration({
      pack,
      scopes: [
        {
          scopeKey: 'organization',
          kind: 'ORGANIZATION',
          order: 0,
          displayName: organization.name,
        },
      ],
      facts,
    });
    const draftByRule = new Map(drafts.map((draft) => [draft.ruleDefinition.ruleKey, draft]));
    const selected = result.items.map((item) => {
      const winningTrace = item.traces.find(({ state }) => state === item.state) ?? item.traces[0];
      const draft = winningTrace ? draftByRule.get(winningTrace.ruleKey) : undefined;
      const requirement = draft?.requirements[0]?.requirement;
      const units =
        requirement?.sources.flatMap(({ provision }) => provision.units.map(({ unit }) => unit)) ??
        [];
      const primaryUnit = units[0];
      if (!draft || !requirement || !primaryUnit)
        throw new BadRequestException('La interpretación candidata no tiene trazabilidad exacta.');
      return { item, winningTrace: winningTrace!, draft, requirement, units, primaryUnit };
    });
    return this.prisma.unifiedSstEvaluation.create({
      data: {
        organizationId,
        profileVersionId: profile.id,
        status: result.questions.length > 0 ? 'REVIEW_PENDING' : 'EVALUATED',
        createdById: userId,
        contextSnapshot: {
          engineVersion: result.engineVersion,
          inputHash: result.inputHash,
          outputHash: result.outputHash,
          facts,
          questions: result.questions,
          boundary: 'CANDIDATE_INTERPRETATION_NOT_FINAL_LAW',
        },
        evaluatedAt: new Date(),
        items: {
          create: selected.map(
            ({ item, winningTrace, draft, requirement, units, primaryUnit }) => ({
              requirementId: requirement.id,
              ruleDraftId: draft.id,
              unitId: primaryUnit.id,
              proposedState: item.state,
              whyMatched: item.reason,
              organizationFacts: facts as Prisma.InputJsonValue,
              predicateTrace: winningTrace.predicates as Prisma.InputJsonValue,
              regulatoryTrace: units.map((unit) => ({
                unitId: unit.id,
                sourceVersionId: unit.sourceVersionId,
                identifier: unit.identifier,
                locator: unit.locator,
                normalizedTextHash: unit.normalizedTextHash,
              })) as Prisma.InputJsonValue,
              currentStateSnapshot: Prisma.JsonNull,
              organizationEvidence: [] as Prisma.InputJsonValue,
              riskReferences: [] as Prisma.InputJsonValue,
              engineOutputHash: result.outputHash,
              professionalReviewRequired: true,
            }),
          ),
        },
      },
      include: { items: true },
    });
  }

  async list(organizationId: string) {
    return this.prisma.unifiedSstEvaluation.findMany({
      where: { organizationId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(organizationId: string, id: string) {
    const evaluation = await this.prisma.unifiedSstEvaluation.findFirst({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            requirement: true,
            ruleDraft: { include: { ruleDefinition: true } },
            unit: { include: { sourceVersion: { include: { source: true } } } },
          },
        },
      },
    });
    if (!evaluation) throw new NotFoundException('Evaluación SST no encontrada.');
    return evaluation;
  }

  async declareCurrentState(
    organizationId: string,
    userId: string,
    evaluationId: string,
    itemId: string,
    status: string,
  ) {
    await this.requireItem(organizationId, evaluationId, itemId);
    return this.prisma.unifiedSstEvaluationItem.update({
      where: { id: itemId },
      data: {
        currentStateSnapshot: {
          status,
          declaredById: userId,
          declaredAt: new Date().toISOString(),
        },
      },
    });
  }

  async addOrganizationEvidence(
    organizationId: string,
    userId: string,
    evaluationId: string,
    itemId: string,
    input: AddUnifiedOrganizationEvidenceDto,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const item = await transaction.unifiedSstEvaluationItem.findFirst({
        where: { id: itemId, evaluationId, evaluation: { organizationId } },
        select: { organizationEvidence: true },
      });
      if (!item) throw new NotFoundException('Resultado candidato no encontrado.');
      const evidence = Array.isArray(item.organizationEvidence) ? item.organizationEvidence : [];
      return transaction.unifiedSstEvaluationItem.update({
        where: { id: itemId },
        data: {
          organizationEvidence: [
            ...evidence,
            {
              type: input.type,
              note: input.note?.trim() ?? null,
              externalUrl: input.externalUrl ?? null,
              recordedById: userId,
              recordedAt: new Date().toISOString(),
            },
          ] as Prisma.InputJsonValue,
        },
      });
    });
  }

  async linkRiskAssessment(
    organizationId: string,
    userId: string,
    evaluationId: string,
    itemId: string,
    assessmentId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const [item, assessment] = await Promise.all([
        transaction.unifiedSstEvaluationItem.findFirst({
          where: { id: itemId, evaluationId, evaluation: { organizationId } },
          select: { riskReferences: true },
        }),
        transaction.technicalAssessment.findFirst({
          where: { id: assessmentId, organizationId },
          select: {
            id: true,
            title: true,
            status: true,
            riskValuation: { select: { riskMethodVersionId: true, riskResult: true } },
          },
        }),
      ]);
      if (!item) throw new NotFoundException('Resultado candidato no encontrado.');
      if (!assessment?.riskValuation)
        throw new BadRequestException(
          'Selecciona una evaluación de riesgo V2 de esta organización.',
        );
      const references = Array.isArray(item.riskReferences) ? item.riskReferences : [];
      const next = references.filter(
        (reference) =>
          typeof reference !== 'object' ||
          reference === null ||
          !('assessmentId' in reference) ||
          reference.assessmentId !== assessmentId,
      );
      return transaction.unifiedSstEvaluationItem.update({
        where: { id: itemId },
        data: {
          riskReferences: [
            ...next,
            {
              assessmentId: assessment.id,
              title: assessment.title,
              status: assessment.status,
              riskMethodVersionId: assessment.riskValuation.riskMethodVersionId,
              riskResult: assessment.riskValuation.riskResult,
              linkedById: userId,
              linkedAt: new Date().toISOString(),
            },
          ] as Prisma.InputJsonValue,
        },
      });
    });
  }

  async review(
    organizationId: string,
    reviewerUserId: string,
    ruleDraftId: string,
    input: ReviewRegulatoryInterpretationDto,
  ) {
    const item = await this.prisma.unifiedSstEvaluationItem.findFirst({
      where: { id: input.evaluationItemId, ruleDraftId, evaluation: { organizationId } },
      include: { requirement: true, ruleDraft: true, unit: true },
    });
    if (!item) throw new NotFoundException('Resultado candidato no encontrado.');
    return this.prisma.regulatoryInterpretationReview.create({
      data: {
        ruleDraftId,
        requirementId: item.requirementId,
        unitId: item.unitId,
        reviewerUserId,
        decision: input.decision,
        comment: input.comment?.trim(),
        engineOutputHash: item.engineOutputHash,
        sourceVersionIdSnapshot: item.unit.sourceVersionId,
        requirementSnapshot: item.requirement as unknown as Prisma.InputJsonValue,
        ruleDraftSnapshot: {
          id: item.ruleDraft.id,
          revision: item.ruleDraft.revision,
          schema: item.ruleDraft.schema,
          status: item.ruleDraft.status,
        },
      },
    });
  }

  private async requireItem(organizationId: string, evaluationId: string, itemId: string) {
    const item = await this.prisma.unifiedSstEvaluationItem.findFirst({
      where: { id: itemId, evaluationId, evaluation: { organizationId } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Resultado candidato no encontrado.');
    return item;
  }
}
