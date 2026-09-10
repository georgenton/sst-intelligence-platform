import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  SST_ASSESSMENT_CATALOG_VERSION,
  SST_ASSESSMENT_FACT_CATALOG,
  SST_ASSESSMENT_SCHEMA_VERSION,
  calculateSstAssessmentProgress,
  normalizeSstAssessmentSnapshot,
  organizationSstProfileSchema,
  planSstAssessmentQuestions,
  sstAssessmentContentHash,
  sstAssessmentFactSchema,
  sstAssessmentScopeSchema,
  sstAssessmentSemanticHash,
  sstAssessmentSnapshotSchema,
  validateSstAssessmentFact,
  type OrganizationProfileFact,
  type SstAssessmentFact,
  type SstAssessmentResult,
  type SstAssessmentScope,
  type SstAssessmentSnapshot,
} from '@sst/contracts';
import { AuditService } from '../audit/audit.service';
import type { requestMetadata } from '../common/request-context';
import {
  createPublicSessionToken,
  publicSessionTokenMatches,
} from '../common/public-session-token';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentSpecialists, type AssessmentSpecialistPins } from './assessment-specialists';
import type {
  ClaimPublicAssessmentDto,
  CreateAuthenticatedAssessmentDto,
  CreatePublicAssessmentDto,
  SubmitSstAssessmentAnswersDto,
} from './dto';

type RequestMetadata = ReturnType<typeof requestMetadata>;

const invalidToken = () =>
  new ForbiddenException({
    code: 'SST_ASSESSMENT_TOKEN_INVALID',
    message: 'La sesión pública o su token no son válidos.',
  });

const staleSession = () =>
  new ConflictException({
    code: 'SST_ASSESSMENT_REVISION_CONFLICT',
    message: 'La evaluación cambió. Recarga la sesión antes de continuar.',
  });

function publicScopes(count: number): SstAssessmentScope[] {
  return [
    { scopeKey: 'organization', kind: 'ORGANIZATION', order: 0, displayName: 'Organización' },
    ...Array.from({ length: count }, (_, index) => ({
      scopeKey: `center:${index + 1}`,
      kind: 'WORK_CENTER' as const,
      order: index + 1,
      displayName: `Centro ${index + 1}`,
    })),
  ].map((scope) => sstAssessmentScopeSchema.parse(scope));
}

function snapshotFromRow(row: { scopes: Prisma.JsonValue; facts: Prisma.JsonValue }) {
  return normalizeSstAssessmentSnapshot(
    sstAssessmentSnapshotSchema.parse({
      schemaVersion: SST_ASSESSMENT_SCHEMA_VERSION,
      catalogVersion: SST_ASSESSMENT_CATALOG_VERSION,
      scopes: row.scopes,
      facts: row.facts,
    }),
  );
}

function assessmentResponse(row: {
  id: string;
  channel: string;
  kind: string;
  status: string;
  sessionRevision: number;
  scopes: Prisma.JsonValue;
  facts: Prisma.JsonValue;
  latestResult: Prisma.JsonValue | null;
  finalSnapshot: Prisma.JsonValue | null;
  semanticInputHash: string | null;
  semanticOutputHash: string | null;
  parentAssessmentId: string | null;
  profileVersionId: string | null;
  expiresAt: Date | null;
  claimedAt: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const snapshot = snapshotFromRow(row);
  return {
    id: row.id,
    channel: row.channel,
    kind: row.kind,
    status: row.status,
    sessionRevision: row.sessionRevision,
    snapshot,
    questions: planSstAssessmentQuestions(snapshot),
    progress: calculateSstAssessmentProgress(snapshot),
    result: row.latestResult,
    finalSnapshot: row.finalSnapshot,
    semanticInputHash: row.semanticInputHash,
    semanticOutputHash: row.semanticOutputHash,
    parentAssessmentId: row.parentAssessmentId,
    profileVersionId: row.profileVersionId,
    expiresAt: row.expiresAt,
    claimedAt: row.claimedAt,
    finalizedAt: row.finalizedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class SstAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly specialists: AssessmentSpecialists,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async createPublic(input: CreatePublicAssessmentDto) {
    const { token, hash } = createPublicSessionToken();
    const evaluatorVersions = await this.specialists.resolveVersions();
    const scopes = publicScopes(input.workCenterCount);
    const facts: SstAssessmentFact[] = [
      sstAssessmentFactSchema.parse({
        factKey: 'organization.workCenterCount',
        scopeKey: 'organization',
        answerState: 'KNOWN',
        value: input.workCenterCount,
        provenance: { source: 'PUBLIC_DECLARATION' },
      }),
    ];
    const ttlHours = Number(this.config.get('SST_ASSESSMENT_PUBLIC_TTL_HOURS') ?? 168);
    const expiresAt = new Date(
      Date.now() + (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 168) * 3_600_000,
    );
    const session = await this.prisma.sstAssessmentSession.create({
      data: {
        publicTokenHash: hash,
        channel: 'PUBLIC',
        schemaVersion: SST_ASSESSMENT_SCHEMA_VERSION,
        catalogVersion: SST_ASSESSMENT_CATALOG_VERSION,
        scopes: scopes as Prisma.InputJsonValue,
        facts: facts as Prisma.InputJsonValue,
        evaluatorVersions: evaluatorVersions as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
    return { ...assessmentResponse(session), publicToken: token };
  }

  async getPublic(sessionId: string, token?: string) {
    const session = await this.requirePublicSession(sessionId, token);
    return assessmentResponse(session);
  }

  async submitPublicAnswers(
    sessionId: string,
    token: string | undefined,
    input: SubmitSstAssessmentAnswersDto,
  ) {
    const session = await this.requirePublicSession(sessionId, token);
    return this.submitAnswers(session, input, 'PUBLIC_DECLARATION');
  }

  async evaluatePublic(
    sessionId: string,
    token: string | undefined,
    expectedSessionRevision: number,
  ) {
    const session = await this.requirePublicSession(sessionId, token);
    return this.evaluateAndPersist(session, expectedSessionRevision);
  }

  async completePublic(
    sessionId: string,
    token: string | undefined,
    expectedSessionRevision: number,
  ) {
    const session = await this.requirePublicSession(sessionId, token);
    const snapshot = snapshotFromRow(session);
    const result = await this.computeResult(snapshot, this.pinnedVersions(session));
    const updated = await this.prisma.sstAssessmentSession.updateMany({
      where: {
        id: session.id,
        sessionRevision: expectedSessionRevision,
        status: { in: ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] },
      },
      data: {
        status: 'FINALIZED',
        sessionRevision: { increment: 1 },
        latestResult: result as unknown as Prisma.InputJsonValue,
        finalSnapshot: snapshot as Prisma.InputJsonValue,
        semanticInputHash: result.semanticInputHash,
        semanticOutputHash: result.semanticOutputHash,
        finalizedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw staleSession();
    return this.getPublic(sessionId, token);
  }

  async createAuthenticated(
    organizationId: string,
    userId: string,
    input: CreateAuthenticatedAssessmentDto,
  ) {
    const [organization, centers, workerCount] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, country: true, sector: true },
      }),
      this.prisma.workCenter.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.worker.count({ where: { organizationId, status: 'ACTIVE' } }),
    ]);
    if (!organization) throw new NotFoundException('Organización no encontrada.');
    const scopes = [
      sstAssessmentScopeSchema.parse({
        scopeKey: 'organization',
        kind: 'ORGANIZATION',
        order: 0,
        displayName: organization.name,
      }),
      ...centers.map((center, index) =>
        sstAssessmentScopeSchema.parse({
          scopeKey: `center:${index + 1}`,
          kind: 'WORK_CENTER',
          order: index + 1,
          displayName: center.name,
          workCenterId: center.id,
        }),
      ),
    ];
    const derived: SstAssessmentFact[] = [
      this.knownFact('organization.country', organization.country, 'ORGANIZATION_RECORD'),
      ...(organization.sector
        ? [this.knownFact('organization.sector', organization.sector, 'ORGANIZATION_RECORD')]
        : []),
      this.knownFact('organization.workCenterCount', centers.length, 'ORGANIZATION_RECORD'),
      ...(workerCount > 0
        ? [this.knownFact('organization.totalWorkerCount', workerCount, 'ORGANIZATION_RECORD')]
        : []),
    ];
    let facts = derived;
    let parentAssessmentId: string | undefined;
    const kind = input.kind ?? 'INITIAL_ASSESSMENT';
    if (kind === 'REASSESSMENT') {
      if (!input.parentAssessmentId) {
        throw new BadRequestException({
          code: 'SST_REASSESSMENT_PARENT_REQUIRED',
          message: 'Una reevaluación requiere una evaluación finalizada anterior.',
        });
      }
      const parent = await this.prisma.sstAssessmentSession.findFirst({
        where: { id: input.parentAssessmentId, organizationId, status: 'FINALIZED' },
      });
      if (!parent?.finalSnapshot) throw new NotFoundException('Evaluación anterior no encontrada.');
      const prior = sstAssessmentSnapshotSchema.parse(parent.finalSnapshot);
      const currentScopeByWorkCenter = new Map(
        scopes.flatMap((scope) =>
          scope.workCenterId ? [[scope.workCenterId, scope.scopeKey] as const] : [],
        ),
      );
      const claimedMappings = Array.isArray(parent.claimScopeMappings)
        ? (parent.claimScopeMappings as Array<{ scopeKey: string; workCenterId: string }>)
        : [];
      const priorWorkCenterByScope = new Map([
        ...prior.scopes.flatMap((scope) =>
          scope.workCenterId ? [[scope.scopeKey, scope.workCenterId] as const] : [],
        ),
        ...claimedMappings.map(({ scopeKey, workCenterId }) => [scopeKey, workCenterId] as const),
      ]);
      const derivedIdentities = new Set(
        derived.map(({ scopeKey, factKey }) => `${scopeKey}:${factKey}`),
      );
      facts = [
        ...derived,
        ...prior.facts
          .filter(({ answerState }) => answerState === 'KNOWN')
          .flatMap((fact): SstAssessmentFact[] => {
            const scopeKey =
              fact.scopeKey === 'organization'
                ? 'organization'
                : currentScopeByWorkCenter.get(priorWorkCenterByScope.get(fact.scopeKey) ?? '');
            if (!scopeKey || derivedIdentities.has(`${scopeKey}:${fact.factKey}`)) return [];
            return [
              {
                ...fact,
                scopeKey,
                provenance: {
                  source: 'PREVIOUS_ASSESSMENT' as const,
                  sourceReference: parent.id,
                },
              },
            ];
          }),
      ];
      parentAssessmentId = parent.id;
    } else if (input.parentAssessmentId) {
      throw new BadRequestException('Una evaluación inicial no puede tener evaluación padre.');
    }
    const evaluatorVersions = await this.specialists.resolveVersions();
    const session = await this.prisma.sstAssessmentSession.create({
      data: {
        organizationId,
        createdById: userId,
        channel: 'AUTHENTICATED',
        kind,
        schemaVersion: SST_ASSESSMENT_SCHEMA_VERSION,
        catalogVersion: SST_ASSESSMENT_CATALOG_VERSION,
        scopes: scopes as Prisma.InputJsonValue,
        facts: facts as Prisma.InputJsonValue,
        evaluatorVersions: evaluatorVersions as unknown as Prisma.InputJsonValue,
        ...(parentAssessmentId ? { parentAssessmentId } : {}),
      },
    });
    return assessmentResponse(session);
  }

  async getAuthenticated(organizationId: string, sessionId: string) {
    return assessmentResponse(await this.requireOrganizationSession(organizationId, sessionId));
  }

  async listHistory(organizationId: string) {
    return this.prisma.sstAssessmentSession.findMany({
      where: { organizationId },
      select: {
        id: true,
        channel: true,
        kind: true,
        status: true,
        sessionRevision: true,
        parentAssessmentId: true,
        profileVersionId: true,
        semanticInputHash: true,
        semanticOutputHash: true,
        finalizedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  async setupState(organizationId: string) {
    const [finalized, inProgress] = await Promise.all([
      this.prisma.sstAssessmentSession.findFirst({
        where: { organizationId, status: 'FINALIZED' },
        select: { id: true, finalizedAt: true },
        orderBy: { finalizedAt: 'desc' },
      }),
      this.prisma.sstAssessmentSession.findFirst({
        where: { organizationId, status: { in: ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] } },
        select: { id: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return inProgress
      ? { state: 'ASSESSMENT_IN_PROGRESS', assessmentId: inProgress.id, status: inProgress.status }
      : finalized
        ? {
            state: 'DIAGNOSIS_READY',
            assessmentId: finalized.id,
            finalizedAt: finalized.finalizedAt,
          }
        : { state: 'NEEDS_ASSESSMENT', assessmentId: null };
  }

  async submitAuthenticatedAnswers(
    organizationId: string,
    sessionId: string,
    input: SubmitSstAssessmentAnswersDto,
  ) {
    const session = await this.requireOrganizationSession(organizationId, sessionId);
    return this.submitAnswers(session, input, 'ORGANIZATION_DECLARATION');
  }

  async evaluateAuthenticated(
    organizationId: string,
    sessionId: string,
    expectedSessionRevision: number,
  ) {
    const session = await this.requireOrganizationSession(organizationId, sessionId);
    return this.evaluateAndPersist(session, expectedSessionRevision);
  }

  async finalizeAuthenticated(
    organizationId: string,
    userId: string,
    sessionId: string,
    expectedSessionRevision: number,
    metadata: RequestMetadata,
  ) {
    const session = await this.requireOrganizationSession(organizationId, sessionId);
    const snapshot = snapshotFromRow(session);
    const result = await this.computeResult(snapshot, this.pinnedVersions(session));
    try {
      const profileVersionId = await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.sstAssessmentSession.findFirst({
            where: {
              id: sessionId,
              organizationId,
              sessionRevision: expectedSessionRevision,
              status: { in: ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] },
            },
          });
          if (!current) throw staleSession();
          const profile = await this.createOrReuseProfile(
            transaction,
            organizationId,
            userId,
            snapshot,
          );
          const updated = await transaction.sstAssessmentSession.updateMany({
            where: {
              id: sessionId,
              organizationId,
              sessionRevision: expectedSessionRevision,
              status: { in: ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] },
            },
            data: {
              status: 'FINALIZED',
              sessionRevision: { increment: 1 },
              latestResult: result as unknown as Prisma.InputJsonValue,
              finalSnapshot: snapshot as Prisma.InputJsonValue,
              semanticInputHash: result.semanticInputHash,
              semanticOutputHash: result.semanticOutputHash,
              profileVersionId: profile.id,
              finalizedAt: new Date(),
            },
          });
          if (updated.count !== 1) throw staleSession();
          return profile.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.audit.record({
        organizationId,
        actorUserId: userId,
        action: 'SST_ASSESSMENT_FINALIZED',
        entityType: 'SstAssessmentSession',
        entityId: sessionId,
        metadata: { profileVersionId, semanticInputHash: result.semanticInputHash },
        ...metadata,
      });
      return this.getAuthenticated(organizationId, sessionId);
    } catch (error) {
      if (
        (error as { code?: string }).code === 'P2034' ||
        (error as { code?: string }).code === 'P2002'
      ) {
        throw staleSession();
      }
      throw error;
    }
  }

  async claimPublic(
    sessionId: string,
    organizationId: string,
    userId: string,
    input: ClaimPublicAssessmentDto,
    metadata: RequestMetadata,
  ) {
    const session = await this.requirePublicSession(sessionId, input.publicToken, true);
    if (session.status !== 'FINALIZED') {
      throw new ConflictException({
        code: 'SST_ASSESSMENT_NOT_FINALIZED',
        message: 'Finaliza la evaluación pública antes de vincularla.',
      });
    }
    const snapshot = snapshotFromRow(session);
    const centerScopes = snapshot.scopes.filter(({ kind }) => kind === 'WORK_CENTER');
    const mappingKeys = new Set(input.scopeMappings.map(({ scopeKey }) => scopeKey));
    const targetIds = new Set(input.scopeMappings.map(({ workCenterId }) => workCenterId));
    if (
      input.scopeMappings.length !== centerScopes.length ||
      mappingKeys.size !== input.scopeMappings.length ||
      targetIds.size !== input.scopeMappings.length ||
      centerScopes.some(({ scopeKey }) => !mappingKeys.has(scopeKey))
    ) {
      throw new BadRequestException({
        code: 'SST_ASSESSMENT_SCOPE_MAPPING_INVALID',
        message: 'Cada alcance público debe vincularse una sola vez a un centro distinto.',
      });
    }
    const centers = await this.prisma.workCenter.count({
      where: { organizationId, id: { in: [...targetIds] }, isActive: true },
    });
    if (centers !== targetIds.size) {
      throw new ForbiddenException({
        code: 'SST_ASSESSMENT_SCOPE_MAPPING_FORBIDDEN',
        message: 'Uno o más centros no pertenecen a la organización activa.',
      });
    }
    const normalizedMappings = [...input.scopeMappings].sort((left, right) =>
      left.scopeKey.localeCompare(right.scopeKey),
    );
    if (session.organizationId) {
      if (
        session.organizationId === organizationId &&
        session.claimedById === userId &&
        sstAssessmentContentHash(session.claimScopeMappings) ===
          sstAssessmentContentHash(normalizedMappings)
      ) {
        return this.getAuthenticated(organizationId, sessionId);
      }
      throw new ConflictException({
        code: 'SST_ASSESSMENT_ALREADY_CLAIMED',
        message: 'La evaluación pública ya fue vinculada.',
      });
    }
    const updated = await this.prisma.sstAssessmentSession.updateMany({
      where: { id: sessionId, organizationId: null, status: 'FINALIZED' },
      data: {
        organizationId,
        claimedById: userId,
        claimScopeMappings: normalizedMappings as unknown as Prisma.InputJsonValue,
        claimedAt: new Date(),
        sessionRevision: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw staleSession();
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'PUBLIC_SST_ASSESSMENT_CLAIMED',
      entityType: 'SstAssessmentSession',
      entityId: sessionId,
      metadata: { scopeMappings: normalizedMappings } as unknown as Prisma.InputJsonValue,
      ...metadata,
    });
    return this.getAuthenticated(organizationId, sessionId);
  }

  private knownFact(
    factKey: string,
    value: string | number | boolean | string[],
    source: 'ORGANIZATION_RECORD',
  ): SstAssessmentFact {
    return sstAssessmentFactSchema.parse({
      factKey,
      scopeKey: 'organization',
      answerState: 'KNOWN',
      value,
      provenance: { source },
    });
  }

  private async submitAnswers(
    session: Awaited<ReturnType<SstAssessmentService['requireOrganizationSession']>>,
    input: SubmitSstAssessmentAnswersDto,
    source: 'PUBLIC_DECLARATION' | 'ORGANIZATION_DECLARATION',
  ) {
    if (session.sessionRevision !== input.expectedSessionRevision) throw staleSession();
    if (session.status === 'FINALIZED' || session.status === 'EXPIRED') {
      throw new ConflictException({
        code: 'SST_ASSESSMENT_IMMUTABLE',
        message: 'La evaluación finalizada es inmutable. Inicia una reevaluación.',
      });
    }
    const snapshot = snapshotFromRow(session);
    const requestIdentities = new Set<string>();
    const answers = input.answers.map((answer) => {
      const identity = `${answer.scopeKey}:${answer.factKey}`;
      if (requestIdentities.has(identity)) {
        throw new BadRequestException({
          code: 'SST_ASSESSMENT_DUPLICATE_ANSWER',
          message: 'La solicitud contiene la misma respuesta más de una vez.',
        });
      }
      requestIdentities.add(identity);
      if (
        (answer.answerState === 'EXPLICIT_UNKNOWN' && answer.value !== undefined) ||
        (answer.answerState === 'KNOWN' && answer.value === undefined)
      ) {
        throw new BadRequestException({
          code: 'SST_ASSESSMENT_ANSWER_STATE_INVALID',
          message: 'KNOWN requiere valor y EXPLICIT_UNKNOWN no admite valor.',
        });
      }
      const definition = SST_ASSESSMENT_FACT_CATALOG.find(
        ({ factKey }) => factKey === answer.factKey,
      );
      if (
        answer.factKey === 'organization.workCenterCount' ||
        (source === 'ORGANIZATION_DECLARATION' && definition?.authenticatedDerived)
      ) {
        throw new BadRequestException({
          code: 'SST_ASSESSMENT_SERVER_FACT_READ_ONLY',
          message: 'Este hecho es derivado por el contexto canónico y no puede sobrescribirse.',
        });
      }
      try {
        return validateSstAssessmentFact(
          sstAssessmentFactSchema.parse({
            factKey: answer.factKey,
            scopeKey: answer.scopeKey,
            answerState: answer.answerState,
            ...(answer.answerState === 'KNOWN' ? { value: answer.value } : {}),
            provenance: { source },
          }),
          snapshot.scopes,
        );
      } catch {
        throw new BadRequestException({
          code: 'SST_ASSESSMENT_ANSWER_INVALID',
          message: `La respuesta ${identity} no coincide con el catálogo canónico.`,
        });
      }
    });
    const answerMap = new Map(
      snapshot.facts.map((fact) => [`${fact.scopeKey}:${fact.factKey}`, fact]),
    );
    for (const answer of answers) answerMap.set(`${answer.scopeKey}:${answer.factKey}`, answer);
    const facts = [...answerMap.values()].sort(
      (left, right) =>
        left.scopeKey.localeCompare(right.scopeKey) || left.factKey.localeCompare(right.factKey),
    );
    const updated = await this.prisma.sstAssessmentSession.updateMany({
      where: {
        id: session.id,
        sessionRevision: input.expectedSessionRevision,
        status: { in: ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] },
      },
      data: {
        facts: facts as Prisma.InputJsonValue,
        status: 'COLLECTING_INFORMATION',
        sessionRevision: { increment: 1 },
        latestResult: Prisma.JsonNull,
        semanticInputHash: null,
        semanticOutputHash: null,
      },
    });
    if (updated.count !== 1) throw staleSession();
    const refreshed = await this.prisma.sstAssessmentSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    return assessmentResponse(refreshed);
  }

  private async evaluateAndPersist(
    session: Awaited<ReturnType<SstAssessmentService['requireOrganizationSession']>>,
    expectedSessionRevision: number,
  ) {
    if (session.sessionRevision !== expectedSessionRevision) throw staleSession();
    if (session.status === 'FINALIZED' || session.status === 'EXPIRED') {
      throw new ConflictException({
        code: 'SST_ASSESSMENT_IMMUTABLE',
        message: 'La evaluación finalizada es inmutable.',
      });
    }
    const result = await this.computeResult(snapshotFromRow(session), this.pinnedVersions(session));
    const updated = await this.prisma.sstAssessmentSession.updateMany({
      where: {
        id: session.id,
        sessionRevision: expectedSessionRevision,
        status: { in: ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] },
      },
      data: {
        status: 'DIAGNOSIS_READY',
        sessionRevision: { increment: 1 },
        latestResult: result as unknown as Prisma.InputJsonValue,
        semanticInputHash: result.semanticInputHash,
        semanticOutputHash: result.semanticOutputHash,
      },
    });
    if (updated.count !== 1) throw staleSession();
    const refreshed = await this.prisma.sstAssessmentSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    return assessmentResponse(refreshed);
  }

  private async computeResult(
    snapshot: SstAssessmentSnapshot,
    pins: AssessmentSpecialistPins,
  ): Promise<SstAssessmentResult> {
    const specialist = await this.specialists.evaluate(snapshot, pins);
    const specialistsQuestions = [
      ...specialist.adaptive.questions,
      ...specialist.regulatory.questions,
    ];
    const questionMetadata = new Map(
      specialistsQuestions.map((question) => [
        `${question.scopeKey}:${question.factKey}`,
        question,
      ]),
    );
    const questions = planSstAssessmentQuestions(snapshot).map((question) => {
      const specialistQuestion = questionMetadata.get(`${question.scopeKey}:${question.factKey}`);
      return specialistQuestion
        ? {
            ...question,
            purpose: specialistQuestion.whyAsked,
            relatedRuleKeys: specialistQuestion.relatedRuleKeys,
            relatedTargetKeys: specialistQuestion.relatedTargetKeys,
          }
        : question;
    });
    const progress = calculateSstAssessmentProgress(snapshot);
    const items: SstAssessmentResult['items'] = [
      ...specialist.adaptive.items.map((item) => ({
        scopeKey: item.scopeKey,
        targetKey: item.targetKey,
        title: item.title,
        state: item.state,
        explanation: item.reason,
        authority: 'DEMO' as const,
        ruleKeys: item.ruleKeys,
        missingFactKeys: item.missingFactKeys,
        professionalReviewRequired: item.professionalReview,
        traces: item.traces,
      })),
      ...specialist.regulatory.items.map((item) => ({
        scopeKey: item.scopeKey,
        targetKey: item.targetKey,
        title: item.title,
        state: item.state,
        explanation: item.reason,
        authority: 'CANDIDATE' as const,
        ruleKeys: item.ruleKeys,
        missingFactKeys: item.missingFactKeys,
        professionalReviewRequired: true,
        traces: item.traces,
      })),
    ].sort(
      (left, right) =>
        left.scopeKey.localeCompare(right.scopeKey) ||
        left.targetKey.localeCompare(right.targetKey),
    );
    const semanticInputHash = sstAssessmentContentHash({
      snapshotHash: sstAssessmentSemanticHash(snapshot),
      adaptivePack: specialist.adaptivePack,
      regulatoryPack: specialist.regulatoryPack,
    });
    const specialistTraces: SstAssessmentResult['specialistTraces'] = [
      {
        specialist: 'ADAPTIVE_CONFIGURATION',
        packKey: specialist.adaptivePack.packKey,
        packVersion: specialist.adaptivePack.version,
        packContentHash: specialist.adaptivePack.contentHash,
        engineVersion: specialist.adaptive.engineVersion,
        inputHash: specialist.adaptive.inputHash,
        outputHash: specialist.adaptive.outputHash,
        authority: 'DEMO',
      },
      {
        specialist: 'REGULATORY_CANDIDATE',
        packKey: specialist.regulatoryPack.packKey,
        packVersion: specialist.regulatoryPack.version,
        packContentHash: specialist.regulatoryPack.contentHash,
        engineVersion: specialist.regulatory.engineVersion,
        inputHash: specialist.regulatory.inputHash,
        outputHash: specialist.regulatory.outputHash,
        authority: 'CANDIDATE',
      },
    ];
    const output = { progress, questions, items, specialistTraces };
    return {
      schemaVersion: SST_ASSESSMENT_SCHEMA_VERSION,
      authority: 'DEMO',
      summary: {
        title: 'Diagnóstico SST preliminar',
        disclaimer:
          'Resultado determinístico orientativo. No acredita cumplimiento legal ni sustituye revisión profesional.',
      },
      ...output,
      semanticInputHash,
      semanticOutputHash: sstAssessmentContentHash(output),
    };
  }

  private async createOrReuseProfile(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    snapshot: SstAssessmentSnapshot,
  ) {
    const organization = await transaction.organization.findUnique({
      where: { id: organizationId },
      select: { country: true, sector: true },
    });
    if (!organization) throw new NotFoundException('Organización no encontrada.');
    const factMap = new Map(
      snapshot.facts.map((fact) => [`${fact.scopeKey}:${fact.factKey}`, fact]),
    );
    const known = (factKey: string) => {
      const fact = factMap.get(`organization:${factKey}`);
      return fact?.answerState === 'KNOWN' ? fact.value : undefined;
    };
    const contextMapping: Record<string, OrganizationProfileFact['key']> = {
      'workCenter.hasChemicalProcesses': 'CHEMICAL_PROCESS_PRESENT',
      'workCenter.hasHighEnergyOperations': 'HIGH_ENERGY_OPERATION_PRESENT',
      'workCenter.hasExternalWorkforce': 'CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT',
    };
    const contextFacts = snapshot.facts.flatMap((fact): OrganizationProfileFact[] => {
      const key = contextMapping[fact.factKey];
      const scope = snapshot.scopes.find(({ scopeKey }) => scopeKey === fact.scopeKey);
      if (!key || !scope?.workCenterId) return [];
      return [
        {
          key,
          value:
            fact.answerState === 'EXPLICIT_UNKNOWN'
              ? 'UNKNOWN'
              : fact.value === true
                ? 'KNOWN_TRUE'
                : 'KNOWN_FALSE',
          scope: 'WORK_CENTER',
          workCenterId: scope.workCenterId,
          provenance: { source: 'DECLARED_BY_ORGANIZATION' },
        },
      ];
    });
    const profile = organizationSstProfileSchema.parse({
      schemaVersion: '2.0.0',
      organization: {
        country: (known('organization.country') as string | undefined) ?? organization.country,
        ...(((known('organization.sector') as string | undefined) ?? organization.sector)
          ? { sector: (known('organization.sector') as string | undefined) ?? organization.sector }
          : {}),
        workCenterCount: snapshot.scopes.filter(({ kind }) => kind === 'WORK_CENTER').length,
        ...(typeof known('organization.totalWorkerCount') === 'number'
          ? { workerCount: known('organization.totalWorkerCount') }
          : {}),
      },
      operations: {},
      contextFacts,
    });
    const latest = await transaction.organizationSstProfileVersion.findFirst({
      where: { organizationId },
      orderBy: { version: 'desc' },
    });
    if (latest && sstAssessmentContentHash(latest.snapshot) === sstAssessmentContentHash(profile)) {
      return latest;
    }
    return transaction.organizationSstProfileVersion.create({
      data: {
        organizationId,
        version: (latest?.version ?? 0) + 1,
        snapshot: profile as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
  }

  private async requirePublicSession(sessionId: string, token?: string, allowClaimed = false) {
    if (!token) throw invalidToken();
    const session = await this.prisma.sstAssessmentSession.findUnique({ where: { id: sessionId } });
    if (
      !session?.publicTokenHash ||
      session.channel !== 'PUBLIC' ||
      (!allowClaimed && session.organizationId !== null) ||
      !publicSessionTokenMatches(session.publicTokenHash, token) ||
      (session.expiresAt !== null && session.expiresAt <= new Date())
    ) {
      throw invalidToken();
    }
    return session;
  }

  private async requireOrganizationSession(organizationId: string, sessionId: string) {
    const session = await this.prisma.sstAssessmentSession.findFirst({
      where: { id: sessionId, organizationId },
    });
    if (!session) throw new NotFoundException('Evaluación SST no encontrada.');
    return session;
  }

  private pinnedVersions(session: { evaluatorVersions: Prisma.JsonValue | null }) {
    const value = session.evaluatorVersions;
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new ConflictException({
        code: 'SST_ASSESSMENT_VERSION_PINS_MISSING',
        message: 'La evaluación no conserva las versiones de sus especialistas.',
      });
    }
    const pins = value as Record<string, unknown>;
    const adaptive = pins.adaptive;
    const regulatory = pins.regulatory;
    if (
      !adaptive ||
      Array.isArray(adaptive) ||
      typeof adaptive !== 'object' ||
      !regulatory ||
      Array.isArray(regulatory) ||
      typeof regulatory !== 'object'
    ) {
      throw new ConflictException({
        code: 'SST_ASSESSMENT_VERSION_PINS_INVALID',
        message: 'Las versiones fijadas de la evaluación no son válidas.',
      });
    }
    const candidate = { adaptive, regulatory } as AssessmentSpecialistPins;
    if (
      !candidate.adaptive.id ||
      !candidate.adaptive.packKey ||
      !candidate.adaptive.version ||
      !candidate.adaptive.contentHash ||
      !candidate.regulatory.packKey ||
      !candidate.regulatory.version ||
      !candidate.regulatory.contentHash
    ) {
      throw new ConflictException({
        code: 'SST_ASSESSMENT_VERSION_PINS_INVALID',
        message: 'Las versiones fijadas de la evaluación no son válidas.',
      });
    }
    return candidate;
  }
}
