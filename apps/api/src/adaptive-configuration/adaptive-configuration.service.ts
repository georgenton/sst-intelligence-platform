import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AdaptiveAnswerSource } from '@prisma/client';
import {
  adaptiveFactVersionSchema,
  adaptiveRulePackSchema,
  evaluateAdaptiveConfiguration,
  organizationSstProfileSchema,
  validateAdaptiveFactValue,
  type AdaptiveFactInput,
  type AdaptiveFactValue,
  type AdaptiveScopeInput,
} from '@sst/contracts';
import { AuditService } from '../audit/audit.service';
import { requestMetadata } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AddAdaptiveEvidenceDto,
  CreateAdaptiveSessionDto,
  DeclareAdaptiveCurrentStateDto,
  SubmitAdaptiveAnswersDto,
} from './dto';

type RequestMetadata = ReturnType<typeof requestMetadata>;

@Injectable()
export class AdaptiveConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listRulePacks() {
    return this.prisma.adaptiveRulePackVersion.findMany({
      where: { isDemo: true, regulatory: false },
      select: {
        id: true,
        version: true,
        engineSchemaVersion: true,
        disclaimer: true,
        isDemo: true,
        regulatory: true,
        contentHash: true,
        publishedAt: true,
        packDefinition: { select: { packKey: true, name: true } },
      },
      orderBy: [{ packDefinition: { packKey: 'asc' } }, { publishedAt: 'desc' }],
    });
  }

  listSessions(organizationId: string) {
    return this.prisma.adaptiveConfigurationSession.findMany({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        sessionRevision: true,
        createdAt: true,
        updatedAt: true,
        finalizedAt: true,
        profileVersion: { select: { id: true, version: true } },
        rulePackVersion: {
          select: {
            id: true,
            version: true,
            packDefinition: { select: { packKey: true, name: true } },
          },
        },
        runs: {
          take: 1,
          orderBy: { runNumber: 'desc' },
          select: {
            runNumber: true,
            _count: { select: { questions: true } },
            proposal: { select: { id: true, proposalVersion: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createSession(
    organizationId: string,
    userId: string,
    input: CreateAdaptiveSessionDto,
    metadata: RequestMetadata,
  ) {
    const created = await this.prisma.$transaction(
      async (transaction) => {
        const [profile, pack, allCenters] = await Promise.all([
          transaction.organizationSstProfileVersion.findFirst({
            where: { id: input.profileVersionId, organizationId },
          }),
          transaction.adaptiveRulePackVersion.findFirst({
            where: { id: input.rulePackVersionId, isDemo: true, regulatory: false },
            include: {
              facts: {
                include: { factVersion: { include: { factDefinition: true } } },
              },
            },
          }),
          transaction.workCenter.findMany({
            where: { organizationId },
            select: { id: true, name: true },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          }),
        ]);
        if (!profile) throw new NotFoundException('Versión de perfil SST no encontrada.');
        if (!pack) throw new NotFoundException('Pack adaptativo DEMO no encontrado.');
        const parsedPack = adaptiveRulePackSchema.parse(pack.schema);
        if (parsedPack.packKey !== 'DEMO_ADAPTIVE_SST_CONFIGURATION')
          throw new BadRequestException('Solo el pack adaptativo DEMO está disponible en V1.');
        const selectedIds = input.workCenterIds ? new Set(input.workCenterIds) : null;
        const centers = selectedIds
          ? allCenters.filter(({ id }) => selectedIds.has(id))
          : allCenters;
        if (selectedIds && centers.length !== selectedIds.size)
          throw new ForbiddenException('Uno o más centros no pertenecen a la organización activa.');
        if (centers.length === 0) throw new BadRequestException('Selecciona al menos un centro.');

        const session = await transaction.adaptiveConfigurationSession.create({
          data: {
            organizationId,
            profileVersionId: profile.id,
            rulePackVersionId: pack.id,
            createdById: userId,
            scopes: {
              create: [
                {
                  organizationId,
                  scopeKey: 'organization',
                  kind: 'ORGANIZATION',
                  displayNameSnapshot: 'Organización',
                  activeSnapshot: true,
                  sortOrder: 0,
                },
                ...centers.map((center, index) => ({
                  organizationId,
                  scopeKey: `work-center:${center.id}`,
                  kind: 'WORK_CENTER' as const,
                  workCenterId: center.id,
                  displayNameSnapshot: center.name,
                  activeSnapshot: true,
                  sortOrder: index + 1,
                })),
              ],
            },
          },
          include: { scopes: true },
        });
        const profileSnapshot = organizationSstProfileSchema.parse(profile.snapshot);
        const organizationScope = session.scopes.find(({ kind }) => kind === 'ORGANIZATION')!;
        const factByKey = new Map(
          pack.facts.map(({ factVersion }) => [factVersion.factDefinition.factKey, factVersion]),
        );
        const derived: Array<{
          scopeId: string;
          factKey: string;
          value: AdaptiveFactValue;
          source: AdaptiveAnswerSource;
        }> = [
          {
            scopeId: organizationScope.id,
            factKey: 'organization.country',
            value: profileSnapshot.organization.country,
            source: 'DERIVED_ORGANIZATION',
          },
          ...(profileSnapshot.organization.sector
            ? [
                {
                  scopeId: organizationScope.id,
                  factKey: 'organization.sector',
                  value: profileSnapshot.organization.sector,
                  source: 'DERIVED_ORGANIZATION' as const,
                },
              ]
            : []),
          ...(profileSnapshot.organization.workerCount === undefined
            ? []
            : [
                {
                  scopeId: organizationScope.id,
                  factKey: 'organization.totalWorkerCount',
                  value: profileSnapshot.organization.workerCount,
                  source: 'DERIVED_PROFILE' as const,
                },
              ]),
          {
            scopeId: organizationScope.id,
            factKey: 'organization.workCenterCount',
            value: centers.length,
            source: 'DERIVED_ORGANIZATION',
          },
          ...(input.strategicPriorities?.length
            ? [
                {
                  scopeId: organizationScope.id,
                  factKey: 'organization.strategicProtectionPriorities',
                  value: [...new Set(input.strategicPriorities)].sort(),
                  source: 'USER_DECLARED' as const,
                },
              ]
            : []),
          ...session.scopes
            .filter(({ kind }) => kind === 'WORK_CENTER')
            .flatMap((scope) => [
              ...(profileSnapshot.operations.hasChemicalProcesses === undefined
                ? []
                : [
                    {
                      scopeId: scope.id,
                      factKey: 'workCenter.hasChemicalProcesses',
                      value: profileSnapshot.operations.hasChemicalProcesses,
                      source: 'DERIVED_PROFILE' as const,
                    },
                  ]),
              ...(profileSnapshot.operations.hasHighEnergyOperations === undefined
                ? []
                : [
                    {
                      scopeId: scope.id,
                      factKey: 'workCenter.hasHighEnergyOperations',
                      value: profileSnapshot.operations.hasHighEnergyOperations,
                      source: 'DERIVED_PROFILE' as const,
                    },
                  ]),
            ]),
        ];
        for (const answer of derived) {
          const factVersion = factByKey.get(answer.factKey);
          if (!factVersion) throw new InternalServerErrorException('Pack adaptativo incompleto.');
          await transaction.adaptiveFactAnswer.create({
            data: {
              organizationId,
              sessionId: session.id,
              scopeId: answer.scopeId,
              factVersionId: factVersion.id,
              typedValue: answer.value as Prisma.InputJsonValue,
              source: answer.source,
              answeredById: userId,
            },
          });
        }
        return session;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'ADAPTIVE_CONFIGURATION_SESSION_CREATED',
      entityType: 'AdaptiveConfigurationSession',
      entityId: created.id,
      metadata: {
        profileVersionId: input.profileVersionId,
        rulePackVersionId: input.rulePackVersionId,
      },
      ...metadata,
    });
    await this.evaluate(organizationId, userId, created.id, 0, metadata);
    return this.getSession(organizationId, created.id);
  }

  async submitAnswers(
    organizationId: string,
    userId: string,
    sessionId: string,
    input: SubmitAdaptiveAnswersDto,
    metadata: RequestMetadata,
  ) {
    const revision = await this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.adaptiveConfigurationSession.findFirst({
          where: { id: sessionId, organizationId },
          include: {
            scopes: true,
            rulePackVersion: {
              include: {
                facts: {
                  include: { factVersion: { include: { factDefinition: true } } },
                },
              },
            },
          },
        });
        if (!session) throw new NotFoundException('Sesión adaptativa no encontrada.');
        if (session.status !== 'COLLECTING_INFORMATION')
          throw new ConflictException('La sesión ya no admite respuestas.');
        if (session.sessionRevision !== input.expectedSessionRevision)
          throw new ConflictException('La sesión cambió. Recarga antes de continuar.');
        const scopeIds = new Set(session.scopes.map(({ id }) => id));
        const facts = new Map(
          session.rulePackVersion.facts.map(({ factVersion }) => [factVersion.id, factVersion]),
        );
        const updated = await transaction.adaptiveConfigurationSession.updateMany({
          where: {
            id: session.id,
            organizationId,
            status: 'COLLECTING_INFORMATION',
            sessionRevision: input.expectedSessionRevision,
          },
          data: { sessionRevision: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException('La sesión cambió. Recarga antes de continuar.');
        for (const answer of input.answers) {
          if (!scopeIds.has(answer.scopeId)) throw new ForbiddenException('Alcance no válido.');
          const factVersion = facts.get(answer.factVersionId);
          if (!factVersion) throw new ForbiddenException('Hecho fuera del pack de la sesión.');
          if (
            factVersion.collectionMode === 'DERIVED_ONLY' ||
            factVersion.collectionMode === 'CONTEXT_ONLY'
          )
            throw new ForbiddenException(
              'Este hecho no admite una respuesta operativa del navegador.',
            );
          const contract = adaptiveFactVersionSchema.parse({
            factKey: factVersion.factDefinition.factKey,
            version: factVersion.version,
            category: factVersion.factDefinition.category,
            defaultScope: factVersion.factDefinition.defaultScope,
            valueType: factVersion.valueType,
            questionText: factVersion.questionText,
            helpText: factVersion.helpText,
            unknownAllowed: factVersion.unknownAllowed,
            collectionMode: factVersion.collectionMode,
            choices: factVersion.choiceOptions,
            ...(factVersion.validation as object),
            priority: factVersion.priority,
          });
          const value = validateAdaptiveFactValue(contract, answer.value);
          await transaction.adaptiveFactAnswer.upsert({
            where: {
              sessionId_scopeId_factVersionId: {
                sessionId: session.id,
                scopeId: answer.scopeId,
                factVersionId: factVersion.id,
              },
            },
            update: {
              typedValue: value as Prisma.InputJsonValue,
              source: 'USER_DECLARED',
              answeredById: userId,
              answeredAt: new Date(),
            },
            create: {
              organizationId,
              sessionId: session.id,
              scopeId: answer.scopeId,
              factVersionId: factVersion.id,
              typedValue: value as Prisma.InputJsonValue,
              source: 'USER_DECLARED',
              answeredById: userId,
            },
          });
        }
        return input.expectedSessionRevision + 1;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'ADAPTIVE_FACT_ANSWERS_SAVED',
      entityType: 'AdaptiveConfigurationSession',
      entityId: sessionId,
      metadata: { answerCount: input.answers.length, sessionRevision: revision },
      ...metadata,
    });
    return { sessionId, sessionRevision: revision };
  }

  async evaluate(
    organizationId: string,
    userId: string,
    sessionId: string,
    expectedSessionRevision: number,
    metadata: RequestMetadata,
  ) {
    const created = await this.prisma.$transaction(
      async (transaction) => {
        const session = await transaction.adaptiveConfigurationSession.findFirst({
          where: { id: sessionId, organizationId },
          include: {
            scopes: { orderBy: [{ sortOrder: 'asc' }, { scopeKey: 'asc' }] },
            answers: {
              include: { factVersion: { include: { factDefinition: true } }, scope: true },
            },
            rulePackVersion: {
              include: {
                facts: { include: { factVersion: { include: { factDefinition: true } } } },
                targets: { include: { targetVersion: { include: { targetDefinition: true } } } },
                rules: {
                  include: {
                    ruleVersion: { include: { ruleDefinition: true, requirements: true } },
                  },
                },
              },
            },
          },
        });
        if (!session) throw new NotFoundException('Sesión adaptativa no encontrada.');
        if (session.status === 'FINALIZED' || session.status === 'CANCELLED')
          throw new ConflictException('La sesión ya no puede reevaluarse.');
        if (session.sessionRevision !== expectedSessionRevision)
          throw new ConflictException('La sesión cambió. Recarga antes de reevaluar.');
        const updated = await transaction.adaptiveConfigurationSession.updateMany({
          where: { id: session.id, organizationId, sessionRevision: expectedSessionRevision },
          data: { sessionRevision: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException('Otra evaluación ya actualizó la sesión.');
        const nextRevision = expectedSessionRevision + 1;
        const pack = adaptiveRulePackSchema.parse(session.rulePackVersion.schema);
        const scopes: AdaptiveScopeInput[] = session.scopes.map((scope) => ({
          scopeKey: scope.scopeKey,
          kind: scope.kind,
          order: scope.sortOrder,
          ...(scope.workCenterId ? { workCenterId: scope.workCenterId } : {}),
          displayName: scope.displayNameSnapshot,
        }));
        const facts: AdaptiveFactInput[] = session.answers.map((answer) => ({
          scopeKey: answer.scope.scopeKey,
          factKey: answer.factVersion.factDefinition.factKey,
          value: answer.typedValue as AdaptiveFactValue,
        }));
        const evaluation = evaluateAdaptiveConfiguration({ pack, scopes, facts });
        const runNumber =
          (await transaction.adaptiveEvaluationRun.count({ where: { sessionId: session.id } })) + 1;
        const run = await transaction.adaptiveEvaluationRun.create({
          data: {
            organizationId,
            sessionId: session.id,
            runNumber,
            sessionRevision: nextRevision,
            engineVersion: evaluation.engineVersion,
            packVersionId: session.rulePackVersionId,
            inputSnapshot: { scopes, facts } as unknown as Prisma.InputJsonValue,
            outputSnapshot: evaluation as unknown as Prisma.InputJsonValue,
            inputHash: evaluation.inputHash,
            outputHash: evaluation.outputHash,
          },
        });
        const scopeByKey = new Map(session.scopes.map((scope) => [scope.scopeKey, scope]));
        const factByKey = new Map(
          session.rulePackVersion.facts.map(({ factVersion }) => [
            factVersion.factDefinition.factKey,
            factVersion,
          ]),
        );
        const ruleByKey = new Map(
          session.rulePackVersion.rules.map(({ ruleVersion }) => [
            ruleVersion.ruleDefinition.ruleKey,
            ruleVersion,
          ]),
        );
        const targetByKey = new Map(
          session.rulePackVersion.targets.map(({ targetVersion }) => [
            targetVersion.targetDefinition.targetKey,
            targetVersion,
          ]),
        );
        await transaction.adaptiveGeneratedQuestion.createMany({
          data: evaluation.questions.map((question, sortOrder) => ({
            organizationId,
            evaluationRunId: run.id,
            scopeId: scopeByKey.get(question.scopeKey)!.id,
            factVersionId: factByKey.get(question.factKey)!.id,
            questionText: question.questionText,
            helpText: question.helpText,
            answerChoices: question.choices,
            whyAsked: question.whyAsked,
            relatedRuleVersions: question.relatedRuleKeys.flatMap((ruleKey) => {
              const id = ruleByKey.get(ruleKey)?.id;
              return id ? [id] : [];
            }),
            relatedTargetVersions: question.relatedTargetKeys.flatMap((targetKey) => {
              const id = targetByKey.get(targetKey)?.id;
              return id ? [id] : [];
            }),
            sortOrder,
          })),
        });
        let proposalId: string | null = null;
        if (evaluation.items.length > 0) {
          const proposal = await transaction.adaptiveConfigurationProposal.create({
            data: {
              organizationId,
              sessionId: session.id,
              evaluationRunId: run.id,
              proposalVersion: runNumber,
            },
          });
          proposalId = proposal.id;
          await transaction.adaptiveConfigurationItem.createMany({
            data: evaluation.items.map((item) => {
              const targetVersion = targetByKey.get(item.targetKey)!;
              const requirementIds = item.ruleKeys.flatMap(
                (ruleKey) =>
                  ruleByKey.get(ruleKey)?.requirements.map(({ requirementId }) => requirementId) ??
                  [],
              );
              return {
                organizationId,
                proposalId: proposal.id,
                scopeId: scopeByKey.get(item.scopeKey)!.id,
                targetVersionId: targetVersion.id,
                state: item.state,
                minimumDepth: item.minimumDepth,
                professionalReview: item.professionalReview,
                reason: item.reason,
                ruleVersionProvenance: item.ruleKeys.map((ruleKey) => ruleByKey.get(ruleKey)!.id),
                requirementProvenance: [...new Set(requirementIds)].sort(),
                evidenceSuggestions: item.evidenceSuggestions,
                missingFacts: item.missingFactKeys,
                trace: item.traces as unknown as Prisma.InputJsonValue,
              };
            }),
          });
        }
        await transaction.adaptiveConfigurationSession.update({
          where: { id: session.id },
          data: {
            status:
              evaluation.questions.length === 0 ? 'READY_TO_PROPOSE' : 'COLLECTING_INFORMATION',
          },
        });
        return {
          runId: run.id,
          runNumber,
          proposalId,
          revision: nextRevision,
          questionCount: evaluation.questions.length,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'ADAPTIVE_CONFIGURATION_EVALUATED',
      entityType: 'AdaptiveEvaluationRun',
      entityId: created.runId,
      metadata: { sessionId, runNumber: created.runNumber, questionCount: created.questionCount },
      ...metadata,
    });
    return created;
  }

  async getSession(organizationId: string, sessionId: string) {
    const session = await this.prisma.adaptiveConfigurationSession.findFirst({
      where: { id: sessionId, organizationId },
      include: {
        profileVersion: { select: { id: true, version: true, snapshot: true } },
        rulePackVersion: {
          select: {
            id: true,
            version: true,
            disclaimer: true,
            isDemo: true,
            regulatory: true,
            packDefinition: { select: { packKey: true, name: true } },
          },
        },
        scopes: { orderBy: [{ sortOrder: 'asc' }, { scopeKey: 'asc' }] },
        runs: {
          orderBy: { runNumber: 'desc' },
          take: 1,
          include: {
            questions: {
              orderBy: { sortOrder: 'asc' },
              include: {
                scope: {
                  select: { id: true, scopeKey: true, displayNameSnapshot: true, kind: true },
                },
                factVersion: {
                  include: { factDefinition: { select: { factKey: true } } },
                },
              },
            },
            proposal: { select: { id: true, proposalVersion: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión adaptativa no encontrada.');
    return session;
  }

  async getLatestQuestions(organizationId: string, sessionId: string) {
    await this.requireSession(organizationId, sessionId);
    const run = await this.prisma.adaptiveEvaluationRun.findFirst({
      where: { organizationId, sessionId },
      orderBy: { runNumber: 'desc' },
      select: { id: true },
    });
    if (!run) return [];
    return this.prisma.adaptiveGeneratedQuestion.findMany({
      where: { organizationId, evaluationRunId: run.id },
      include: {
        scope: { select: { id: true, scopeKey: true, displayNameSnapshot: true, kind: true } },
        factVersion: { include: { factDefinition: { select: { factKey: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async listRuns(organizationId: string, sessionId: string) {
    await this.requireSession(organizationId, sessionId);
    return this.prisma.adaptiveEvaluationRun.findMany({
      where: { organizationId, sessionId },
      select: {
        id: true,
        runNumber: true,
        sessionRevision: true,
        engineVersion: true,
        inputHash: true,
        outputHash: true,
        createdAt: true,
        _count: { select: { questions: true } },
        proposal: { select: { id: true, proposalVersion: true } },
      },
      orderBy: { runNumber: 'desc' },
    });
  }

  async listProposals(organizationId: string, sessionId: string) {
    await this.requireSession(organizationId, sessionId);
    return this.prisma.adaptiveConfigurationProposal.findMany({
      where: { organizationId, sessionId },
      select: {
        id: true,
        proposalVersion: true,
        createdAt: true,
        evaluationRun: { select: { runNumber: true, sessionRevision: true } },
        _count: { select: { items: true } },
      },
      orderBy: { proposalVersion: 'desc' },
    });
  }

  async getProposal(organizationId: string, proposalId: string) {
    const proposal = await this.prisma.adaptiveConfigurationProposal.findFirst({
      where: { id: proposalId, organizationId },
      include: {
        evaluationRun: {
          select: {
            id: true,
            runNumber: true,
            sessionRevision: true,
            engineVersion: true,
            outputHash: true,
          },
        },
        session: {
          select: {
            id: true,
            status: true,
            sessionRevision: true,
            rulePackVersion: {
              select: {
                version: true,
                disclaimer: true,
                packDefinition: { select: { packKey: true, name: true } },
              },
            },
          },
        },
        items: {
          orderBy: [{ scope: { sortOrder: 'asc' } }, { targetVersion: { title: 'asc' } }],
          include: {
            scope: { select: { id: true, scopeKey: true, kind: true, displayNameSnapshot: true } },
            targetVersion: { include: { targetDefinition: { select: { targetKey: true } } } },
            currentState: { include: { evidence: { orderBy: { declaredAt: 'asc' } } } },
          },
        },
      },
    });
    if (!proposal) throw new NotFoundException('Propuesta adaptativa no encontrada.');
    return proposal;
  }

  async declareCurrentState(
    organizationId: string,
    userId: string,
    proposalId: string,
    input: DeclareAdaptiveCurrentStateDto,
    metadata: RequestMetadata,
  ) {
    const item = await this.prisma.adaptiveConfigurationItem.findFirst({
      where: { id: input.itemId, proposalId, organizationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Elemento de propuesta no encontrado.');
    const declaration = await this.prisma.adaptiveCurrentStateDeclaration.upsert({
      where: { itemId: item.id },
      update: { status: input.status, declaredById: userId, declaredAt: new Date() },
      create: {
        organizationId,
        itemId: item.id,
        status: input.status,
        declaredById: userId,
      },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'ADAPTIVE_CURRENT_STATE_DECLARED',
      entityType: 'AdaptiveCurrentStateDeclaration',
      entityId: declaration.id,
      metadata: { proposalId, itemId: item.id, status: input.status },
      ...metadata,
    });
    return declaration;
  }

  async addEvidence(
    organizationId: string,
    userId: string,
    proposalId: string,
    input: AddAdaptiveEvidenceDto,
    metadata: RequestMetadata,
  ) {
    if (input.type === 'NOTE' && (!input.note?.trim() || input.externalUrl))
      throw new BadRequestException('La evidencia NOTE requiere solo una nota.');
    if (input.type === 'EXTERNAL_LINK' && (!input.externalUrl || input.note))
      throw new BadRequestException('La evidencia EXTERNAL_LINK requiere solo una URL HTTPS.');
    if (input.externalUrl && !input.externalUrl.startsWith('https://'))
      throw new BadRequestException('El enlace debe usar HTTPS.');
    const declaration = await this.prisma.adaptiveCurrentStateDeclaration.findFirst({
      where: { itemId: input.itemId, organizationId, item: { proposalId } },
      select: { id: true },
    });
    if (!declaration)
      throw new BadRequestException('Declara primero el estado actual de este elemento.');
    const evidence = await this.prisma.adaptiveCurrentStateEvidence.create({
      data: {
        organizationId,
        declarationId: declaration.id,
        type: input.type,
        note: input.type === 'NOTE' ? input.note!.trim() : null,
        externalUrl: input.type === 'EXTERNAL_LINK' ? input.externalUrl : null,
        declaredById: userId,
      },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'ADAPTIVE_UNVERIFIED_EVIDENCE_DECLARED',
      entityType: 'AdaptiveCurrentStateEvidence',
      entityId: evidence.id,
      metadata: { proposalId, itemId: input.itemId, type: input.type },
      ...metadata,
    });
    return evidence;
  }

  async finalize(
    organizationId: string,
    userId: string,
    sessionId: string,
    expectedSessionRevision: number,
    metadata: RequestMetadata,
  ) {
    const updated = await this.prisma.adaptiveConfigurationSession.updateMany({
      where: {
        id: sessionId,
        organizationId,
        status: 'READY_TO_PROPOSE',
        sessionRevision: expectedSessionRevision,
      },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
        sessionRevision: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new ConflictException('La sesión no está lista o cambió antes de finalizar.');
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'ADAPTIVE_CONFIGURATION_SESSION_FINALIZED',
      entityType: 'AdaptiveConfigurationSession',
      entityId: sessionId,
      metadata: { sessionRevision: expectedSessionRevision + 1 },
      ...metadata,
    });
    return this.getSession(organizationId, sessionId);
  }

  private async requireSession(organizationId: string, sessionId: string) {
    const session = await this.prisma.adaptiveConfigurationSession.findFirst({
      where: { id: sessionId, organizationId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Sesión adaptativa no encontrada.');
    return session;
  }
}
