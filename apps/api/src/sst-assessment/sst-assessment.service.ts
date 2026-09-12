import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  SST_ASSESSMENT_CATALOG_VERSION,
  SST_ASSESSMENT_LIMITS,
  SST_ASSESSMENT_SCHEMA_VERSION,
  calculateSstAssessmentProgress,
  normalizeSstAssessmentSnapshot,
  reconcileSstAssessmentConditionalFacts,
  organizationSstProfileSchema,
  parseSstAssessmentSnapshot,
  planSstAssessmentQuestions,
  resolveSstAssessmentCatalog,
  resolveSstAssessmentReadiness,
  sstAssessmentContentHash,
  sstAssessmentClaimScopeMappingsSchema,
  sstAssessmentFactSchema,
  sstAssessmentScopeSchema,
  sstAssessmentSemanticHash,
  validateSstAssessmentFact,
  type OrganizationProfileFact,
  type OrganizationSstProfile,
  type SstAssessmentFact,
  type SstAssessmentClaimScopeMapping,
  type SstAssessmentResult,
  type SstAssessmentScope,
  type SstAssessmentSnapshot,
  SstAssessmentVersionUnsupportedError,
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
  ClaimNewOrganizationPublicAssessmentDto,
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

const assessmentNotReady = () =>
  new ConflictException({
    code: 'SST_ASSESSMENT_NOT_READY',
    message: 'Completa la información requerida y evalúa antes de finalizar.',
  });

const assessmentContextChanged = () =>
  new ConflictException({
    code: 'SST_ASSESSMENT_CONTEXT_CHANGED',
    message:
      'El perfil o la estructura activa de la organización cambió. Inicia una nueva evaluación.',
  });

const organizationReconciliationRequired = (reason: 'COUNTRY' | 'WORK_CENTER_TOPOLOGY') =>
  new ConflictException({
    code: 'SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED',
    message:
      reason === 'COUNTRY'
        ? 'El país de la evaluación no coincide con la organización seleccionada.'
        : 'Los centros de la evaluación no coinciden con la topología activa de la organización.',
    details: { reason },
  });

const profileReconciliationRequired = (conflictCategories: string[]) =>
  new ConflictException({
    code: 'SST_ASSESSMENT_PROFILE_RECONCILIATION_REQUIRED',
    message:
      'La evaluación pública difiere del perfil SST vigente. Revisa las categorías indicadas.',
    details: { conflictCategories: [...new Set(conflictCategories)].sort() },
  });

const newOrganizationSetupRequired = (reason: string) =>
  new ConflictException({
    code: 'SST_ASSESSMENT_NEW_ORGANIZATION_SETUP_REQUIRED',
    message: 'Esta organización ya no cumple las condiciones del aprovisionamiento inicial.',
    details: { reason },
  });

const assessmentAlreadyClaimed = () =>
  new ConflictException({
    code: 'SST_ASSESSMENT_ALREADY_CLAIMED',
    message: 'La evaluación pública ya fue vinculada.',
  });

function persistedClaimScopeMappings(value: Prisma.JsonValue | null) {
  const parsed = sstAssessmentClaimScopeMappingsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function decisionClaimScopeMappings(value: Prisma.JsonValue | null) {
  return persistedClaimScopeMappings(value)
    .map(({ scopeKey, workCenterId }) => ({ scopeKey, workCenterId }))
    .sort((left, right) => left.scopeKey.localeCompare(right.scopeKey));
}

function persistedClaimDecisionHash(value: Prisma.JsonValue) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const decisionHash = (value as Prisma.JsonObject).claimDecisionHash;
  return typeof decisionHash === 'string' ? decisionHash : null;
}

function normalizedIdentity(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('es');
}

function organizationContextHash(context: { country: string; sector: string | null }) {
  return sstAssessmentContentHash({
    country: normalizedIdentity(context.country),
    sector: context.sector ? normalizedIdentity(context.sector) : null,
  });
}

function workCenterTopologyHash(centers: Array<{ id: string }>) {
  return sstAssessmentContentHash(centers.map(({ id }) => id).sort());
}

export function reconcileLegacyOperation(
  previous: boolean | undefined,
  activeWorkCenterIds: string[],
  facts: OrganizationProfileFact[],
  key: 'CHEMICAL_PROCESS_PRESENT' | 'HIGH_ENERGY_OPERATION_PRESENT',
) {
  const relevant = new Map(
    facts
      .filter(
        (fact) =>
          fact.scope === 'WORK_CENTER' &&
          fact.key === key &&
          fact.workCenterId &&
          activeWorkCenterIds.includes(fact.workCenterId),
      )
      .map((fact) => [fact.workCenterId!, fact.value] as const),
  );
  if ([...relevant.values()].some((value) => value === 'KNOWN_TRUE')) return true;
  if (
    activeWorkCenterIds.length > 0 &&
    activeWorkCenterIds.every((id) => relevant.get(id) === 'KNOWN_FALSE')
  ) {
    return false;
  }
  return previous;
}

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

function snapshotFromRow(row: {
  schemaVersion: string;
  catalogVersion: string;
  scopes: Prisma.JsonValue;
  facts: Prisma.JsonValue;
}) {
  try {
    return normalizeSstAssessmentSnapshot(
      parseSstAssessmentSnapshot({
        schemaVersion: row.schemaVersion,
        catalogVersion: row.catalogVersion,
        scopes: row.scopes,
        facts: row.facts,
      }),
    );
  } catch (error) {
    if (error instanceof SstAssessmentVersionUnsupportedError) {
      throw new InternalServerErrorException({
        code: error.code,
        message: 'La versión persistida de la evaluación no está soportada.',
      });
    }
    throw error;
  }
}

function assessmentResponse(row: {
  id: string;
  channel: string;
  kind: string;
  status: string;
  sessionRevision: number;
  schemaVersion: string;
  catalogVersion: string;
  scopes: Prisma.JsonValue;
  facts: Prisma.JsonValue;
  claimScopeMappings: Prisma.JsonValue | null;
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
  const storedResult =
    row.latestResult && !Array.isArray(row.latestResult) && typeof row.latestResult === 'object'
      ? (row.latestResult as Record<string, unknown>)
      : null;
  const storedQuestions = Array.isArray(storedResult?.questions)
    ? storedResult.questions
    : undefined;
  const storedProgress =
    storedResult?.progress &&
    !Array.isArray(storedResult.progress) &&
    typeof storedResult.progress === 'object'
      ? storedResult.progress
      : undefined;
  const channel = row.channel === 'AUTHENTICATED' ? 'AUTHENTICATED' : 'PUBLIC';
  return {
    id: row.id,
    channel: row.channel,
    kind: row.kind,
    status: row.status,
    sessionRevision: row.sessionRevision,
    snapshot,
    claimScopeMappings: persistedClaimScopeMappings(row.claimScopeMappings),
    questions: storedQuestions ?? planSstAssessmentQuestions(snapshot, { channel }),
    progress: storedProgress ?? calculateSstAssessmentProgress(snapshot, { channel }),
    requiredActions:
      channel === 'AUTHENTICATED' &&
      !snapshot.facts.some(({ factKey }) => factKey === 'organization.sector')
        ? [
            {
              code: 'ORGANIZATION_SECTOR_REQUIRED',
              message: 'Actualiza el sector en el perfil de la organización.',
            },
          ]
        : [],
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
    if (session.sessionRevision !== expectedSessionRevision) throw staleSession();
    if (session.status !== 'DIAGNOSIS_READY') throw assessmentNotReady();
    const snapshot = snapshotFromRow(session);
    const result = await this.computeResult(snapshot, this.pinnedVersions(session), 'PUBLIC');
    const updated = await this.prisma.sstAssessmentSession.updateMany({
      where: {
        id: session.id,
        sessionRevision: expectedSessionRevision,
        status: 'DIAGNOSIS_READY',
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
    metadata: RequestMetadata,
  ) {
    const [organization, centers, latestProfile] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, country: true, sector: true },
      }),
      this.prisma.workCenter.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.organizationSstProfileVersion.findFirst({
        where: { organizationId },
        orderBy: { version: 'desc' },
      }),
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
    const profileSnapshot = latestProfile
      ? organizationSstProfileSchema.parse(latestProfile.snapshot)
      : undefined;
    const derived: SstAssessmentFact[] = [
      this.knownFact('organization.country', organization.country, 'ORGANIZATION_RECORD'),
      ...(organization.sector
        ? [this.knownFact('organization.sector', organization.sector, 'ORGANIZATION_RECORD')]
        : []),
      this.knownFact('organization.workCenterCount', centers.length, 'ORGANIZATION_RECORD'),
      ...(profileSnapshot?.organization.workerCount
        ? [
            this.knownFact(
              'organization.totalWorkerCount',
              profileSnapshot.organization.workerCount,
              'ORGANIZATION_RECORD',
            ),
          ]
        : []),
      ...this.assessmentFactsFromProfile(profileSnapshot, scopes, latestProfile?.id),
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
      const prior = normalizeSstAssessmentSnapshot(
        parseSstAssessmentSnapshot(parent.finalSnapshot),
      );
      const currentScopeByWorkCenter = new Map(
        scopes.flatMap((scope) =>
          scope.workCenterId ? [[scope.workCenterId, scope.scopeKey] as const] : [],
        ),
      );
      const claimedMappings = decisionClaimScopeMappings(parent.claimScopeMappings);
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
    facts = [
      ...new Map(facts.map((fact) => [`${fact.scopeKey}:${fact.factKey}`, fact] as const)).values(),
    ];
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
        baseProfileVersionId: latestProfile?.id ?? null,
        baseProfileHash: latestProfile ? sstAssessmentContentHash(latestProfile.snapshot) : null,
        baseOrgContextHash: organizationContextHash(organization),
        baseTopologyHash: workCenterTopologyHash(centers),
        ...(parentAssessmentId ? { parentAssessmentId } : {}),
      },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'SST_ASSESSMENT_CREATED',
      entityType: 'SstAssessmentSession',
      entityId: session.id,
      metadata: { kind, parentAssessmentId: parentAssessmentId ?? null },
      ...metadata,
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
    const [sessions, profiles, legacySignals] = await Promise.all([
      this.prisma.sstAssessmentSession.findMany({
        where: { organizationId },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          finalizedAt: true,
          baseProfileVersionId: true,
          profileVersionId: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.organizationSstProfileVersion.findMany({
        where: { organizationId },
        select: { id: true },
      }),
      Promise.all([
        this.prisma.organization.findFirst({
          where: { id: organizationId, status: 'DEMO' },
          select: { id: true },
        }),
        this.prisma.adaptiveConfigurationSession.findFirst({
          where: { organizationId },
          select: { id: true },
        }),
        this.prisma.unifiedSstEvaluation.findFirst({
          where: { organizationId },
          select: { id: true },
        }),
        this.prisma.applicabilityAssessment.findFirst({
          where: { organizationId },
          select: { id: true },
        }),
        this.prisma.operationalPlan.findFirst({
          where: { organizationId },
          select: { id: true },
        }),
        this.prisma.inspection.findFirst({
          where: { organizationId },
          select: { id: true },
        }),
        this.prisma.technicalAssessment.findFirst({
          where: { organizationId },
          select: { id: true },
        }),
      ]),
    ]);
    const canonicalProfileIds = new Set(
      sessions.flatMap(({ baseProfileVersionId, profileVersionId }) =>
        profileVersionId && profileVersionId !== baseProfileVersionId ? [profileVersionId] : [],
      ),
    );
    const hasPreExistingProfile = profiles.some(({ id }) => !canonicalProfileIds.has(id));
    const hasLegacyBaseline = hasPreExistingProfile || legacySignals.some(Boolean);
    const inProgress = sessions.find(({ status }) =>
      ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'].includes(status),
    );
    const finalized = sessions.find(({ status }) => status === 'FINALIZED');
    return inProgress
      ? {
          state: 'ASSESSMENT_IN_PROGRESS',
          hardGate: !hasLegacyBaseline,
          assessmentId: inProgress.id,
          status: inProgress.status,
        }
      : finalized
        ? {
            state: 'DIAGNOSIS_READY',
            hardGate: !hasLegacyBaseline,
            assessmentId: finalized.id,
            finalizedAt: finalized.finalizedAt,
          }
        : hasLegacyBaseline
          ? { state: 'LEGACY_CONFIGURED', hardGate: false, assessmentId: null }
          : { state: 'NEEDS_ASSESSMENT', hardGate: true, assessmentId: null };
  }

  async submitAuthenticatedAnswers(
    organizationId: string,
    userId: string,
    sessionId: string,
    input: SubmitSstAssessmentAnswersDto,
    metadata: RequestMetadata,
  ) {
    const session = await this.requireOrganizationSession(organizationId, sessionId);
    const response = await this.submitAnswers(session, input, 'ORGANIZATION_DECLARATION');
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'SST_ASSESSMENT_ANSWERS_SAVED',
      entityType: 'SstAssessmentSession',
      entityId: sessionId,
      metadata: { answerCount: input.answers.length },
      ...metadata,
    });
    return response;
  }

  async evaluateAuthenticated(
    organizationId: string,
    userId: string,
    sessionId: string,
    expectedSessionRevision: number,
    metadata: RequestMetadata,
  ) {
    const session = await this.requireOrganizationSession(organizationId, sessionId);
    const response = await this.evaluateAndPersist(session, expectedSessionRevision);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'SST_ASSESSMENT_EVALUATED',
      entityType: 'SstAssessmentSession',
      entityId: sessionId,
      metadata: { status: response.status },
      ...metadata,
    });
    return response;
  }

  async finalizeAuthenticated(
    organizationId: string,
    userId: string,
    sessionId: string,
    expectedSessionRevision: number,
    metadata: RequestMetadata,
  ) {
    const session = await this.requireOrganizationSession(organizationId, sessionId);
    if (session.sessionRevision !== expectedSessionRevision) throw staleSession();
    if (session.status !== 'DIAGNOSIS_READY') throw assessmentNotReady();
    const snapshot = snapshotFromRow(session);
    await this.assertAuthenticatedBaseContext(session);
    const result = await this.computeResult(
      snapshot,
      this.pinnedVersions(session),
      'AUTHENTICATED',
    );
    try {
      const profileVersionId = await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.sstAssessmentSession.findFirst({
            where: {
              id: sessionId,
              organizationId,
              sessionRevision: expectedSessionRevision,
              status: 'DIAGNOSIS_READY',
            },
          });
          if (!current) throw staleSession();
          await this.assertAuthenticatedBaseContext(current, transaction);
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
              status: 'DIAGNOSIS_READY',
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
    const normalizedMappings = [...input.scopeMappings].sort((left, right) =>
      left.scopeKey.localeCompare(right.scopeKey),
    );
    await this.reconcilePublicClaimContext(
      this.prisma,
      organizationId,
      snapshot,
      normalizedMappings,
    );
    if (session.organizationId) {
      if (
        session.organizationId === organizationId &&
        session.claimedById === userId &&
        sstAssessmentContentHash(decisionClaimScopeMappings(session.claimScopeMappings)) ===
          sstAssessmentContentHash(normalizedMappings)
      ) {
        return this.getAuthenticated(organizationId, sessionId);
      }
      throw assessmentAlreadyClaimed();
    }
    const claimResult = await this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.sstAssessmentSession.findFirst({
          where: { id: sessionId, organizationId: null, status: 'FINALIZED' },
        });
        if (!current) throw staleSession();
        const preExistingProfile = await transaction.organizationSstProfileVersion.findFirst({
          where: { organizationId },
          orderBy: { version: 'desc' },
        });
        const reconciliation = await this.reconcilePublicClaimContext(
          transaction,
          organizationId,
          snapshotFromRow(current),
          normalizedMappings,
        );
        const profile = await this.createOrReuseProfile(
          transaction,
          organizationId,
          userId,
          reconciliation.snapshot,
          'PUBLIC_CLAIM',
        );
        const updated = await transaction.sstAssessmentSession.updateMany({
          where: { id: sessionId, organizationId: null, status: 'FINALIZED' },
          data: {
            organizationId,
            claimedById: userId,
            claimScopeMappings:
              reconciliation.claimScopeMappings as unknown as Prisma.InputJsonValue,
            profileVersionId: profile.id,
            baseProfileVersionId: preExistingProfile?.id ?? null,
            baseProfileHash: preExistingProfile
              ? sstAssessmentContentHash(preExistingProfile.snapshot)
              : null,
            claimedAt: new Date(),
            sessionRevision: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw staleSession();
        return { profileVersionId: profile.id, scopeMappings: reconciliation.claimScopeMappings };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'PUBLIC_SST_ASSESSMENT_CLAIMED',
      entityType: 'SstAssessmentSession',
      entityId: sessionId,
      metadata: {
        scopeMappings: claimResult.scopeMappings,
        profileVersionId: claimResult.profileVersionId,
      } as unknown as Prisma.InputJsonValue,
      ...metadata,
    });
    return this.getAuthenticated(organizationId, sessionId);
  }

  async claimPublicForNewOrganization(
    sessionId: string,
    organizationId: string,
    userId: string,
    input: ClaimNewOrganizationPublicAssessmentDto,
    metadata: RequestMetadata,
  ) {
    const centerDrafts = input.centers.map((center) => ({
      scopeKey: center.scopeKey.trim(),
      name: center.name.trim(),
      city: center.city?.trim() || null,
    }));
    const scopeKeys = new Set(centerDrafts.map(({ scopeKey }) => scopeKey));
    const centerNames = new Set(centerDrafts.map(({ name }) => normalizedIdentity(name)));
    const claimDecisionHash = sstAssessmentContentHash(
      centerDrafts
        .map(({ scopeKey, name, city }) => ({
          scopeKey,
          name: normalizedIdentity(name),
          city: city ? normalizedIdentity(city) : null,
        }))
        .sort((left, right) => left.scopeKey.localeCompare(right.scopeKey)),
    );
    if (
      centerDrafts.some(({ scopeKey, name }) => scopeKey.length === 0 || name.length === 0) ||
      scopeKeys.size !== centerDrafts.length ||
      centerNames.size !== centerDrafts.length
    ) {
      throw new BadRequestException({
        code: 'SST_ASSESSMENT_SETUP_TOPOLOGY_INVALID',
        message: 'Cada centro de la evaluación requiere un alcance y nombre distintos.',
      });
    }

    try {
      await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw(Prisma.sql`
            SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE
          `);
          await transaction.$queryRaw(Prisma.sql`
            SELECT id FROM "SstAssessmentSession" WHERE id = ${sessionId}::uuid FOR UPDATE
          `);

          const current = await transaction.sstAssessmentSession.findUnique({
            where: { id: sessionId },
          });
          if (
            !current?.publicTokenHash ||
            current.channel !== 'PUBLIC' ||
            current.status !== 'FINALIZED' ||
            !publicSessionTokenMatches(current.publicTokenHash, input.publicToken) ||
            (current.expiresAt !== null && current.expiresAt <= new Date())
          ) {
            throw invalidToken();
          }
          if (current.organizationId !== null || current.claimedById !== null) {
            const setupAudit = await transaction.auditLog.findFirst({
              where: {
                organizationId,
                actorUserId: userId,
                action: 'SST_SETUP_TOPOLOGY_PROVISIONED',
                entityType: 'SstAssessmentSession',
                entityId: sessionId,
              },
              select: { metadata: true },
            });
            if (
              current.organizationId === organizationId &&
              current.claimedById === userId &&
              setupAudit &&
              persistedClaimDecisionHash(setupAudit.metadata) === claimDecisionHash
            ) {
              return;
            }
            throw assessmentAlreadyClaimed();
          }
          const snapshot = snapshotFromRow(current);
          const centerScopes = snapshot.scopes
            .filter(({ kind }) => kind === 'WORK_CENTER')
            .sort((left, right) => left.order - right.order);
          if (
            centerDrafts.length !== centerScopes.length ||
            centerDrafts.length > SST_ASSESSMENT_LIMITS.workCenters ||
            centerScopes.some(({ scopeKey }) => !scopeKeys.has(scopeKey))
          ) {
            throw new BadRequestException({
              code: 'SST_ASSESSMENT_SETUP_TOPOLOGY_INVALID',
              message: 'Los centros deben representar exactamente los alcances de la evaluación.',
            });
          }

          const [organization, bootstrapCenters, substantiveCounts] = await Promise.all([
            transaction.organization.findUnique({
              where: { id: organizationId },
              select: {
                country: true,
                status: true,
                demoStartedAt: true,
                demoExpiresAt: true,
                memberships: {
                  select: { userId: true, role: true, status: true },
                },
                subscriptions: {
                  where: { status: 'ACTIVE' },
                  select: { plan: { select: { key: true } } },
                },
                modules: {
                  where: { status: 'ACTIVE' },
                  select: { module: { select: { key: true } } },
                },
              },
            }),
            transaction.workCenter.findMany({
              where: { organizationId },
              select: { id: true, isActive: true, isDemo: true },
              orderBy: { createdAt: 'asc' },
            }),
            Promise.all([
              transaction.organizationSstProfileVersion.count({ where: { organizationId } }),
              transaction.sstAssessmentSession.count({ where: { organizationId } }),
              transaction.adaptiveConfigurationSession.count({ where: { organizationId } }),
              transaction.unifiedSstEvaluation.count({ where: { organizationId } }),
              transaction.applicabilityAssessment.count({ where: { organizationId } }),
              transaction.operationalPlan.count({ where: { organizationId } }),
              transaction.inspection.count({ where: { organizationId } }),
              transaction.technicalAssessment.count({ where: { organizationId } }),
              transaction.workArea.count({ where: { organizationId } }),
              transaction.position.count({ where: { organizationId } }),
              transaction.worker.count({ where: { organizationId } }),
            ]),
          ]);
          if (!organization) throw new NotFoundException('Organización no encontrada.');
          if (
            organization.status !== 'ACTIVE' ||
            organization.demoStartedAt !== null ||
            organization.demoExpiresAt !== null ||
            organization.memberships.length !== 1 ||
            organization.memberships[0]?.userId !== userId ||
            organization.memberships[0]?.status !== 'ACTIVE' ||
            organization.memberships[0]?.role !== 'ORG_OWNER' ||
            organization.subscriptions.length !== 1 ||
            organization.subscriptions[0]?.plan.key !== 'FREE' ||
            organization.modules.length !== 1 ||
            organization.modules[0]?.module.key !== 'CORE' ||
            bootstrapCenters.length !== 1 ||
            bootstrapCenters[0]?.isActive !== true ||
            bootstrapCenters[0]?.isDemo !== false ||
            substantiveCounts.some((count) => count !== 0)
          ) {
            throw newOrganizationSetupRequired('ORGANIZATION_NOT_PRISTINE');
          }
          const publicCountry = snapshot.facts.find(
            (fact) =>
              fact.scopeKey === 'organization' &&
              fact.factKey === 'organization.country' &&
              fact.answerState === 'KNOWN',
          );
          if (
            publicCountry?.answerState !== 'KNOWN' ||
            typeof publicCountry.value !== 'string' ||
            normalizedIdentity(publicCountry.value) !== normalizedIdentity(organization.country)
          ) {
            throw organizationReconciliationRequired('COUNTRY');
          }

          const draftByScope = new Map(centerDrafts.map((draft) => [draft.scopeKey, draft]));
          const provisioned = [] as Array<{ scopeKey: string; workCenterId: string }>;
          for (const [index, scope] of centerScopes.entries()) {
            const draft = draftByScope.get(scope.scopeKey)!;
            const center =
              index === 0
                ? await transaction.workCenter.update({
                    where: { id: bootstrapCenters[0]!.id },
                    data: { name: draft.name, city: draft.city },
                    select: { id: true },
                  })
                : await transaction.workCenter.create({
                    data: {
                      organizationId,
                      name: draft.name,
                      city: draft.city,
                    },
                    select: { id: true },
                  });
            provisioned.push({ scopeKey: scope.scopeKey, workCenterId: center.id });
          }

          const reconciliation = await this.reconcilePublicClaimContext(
            transaction,
            organizationId,
            snapshot,
            provisioned,
          );
          const profile = await this.createOrReuseProfile(
            transaction,
            organizationId,
            userId,
            reconciliation.snapshot,
            'PUBLIC_CLAIM',
          );
          const updated = await transaction.sstAssessmentSession.updateMany({
            where: { id: sessionId, organizationId: null, claimedById: null, status: 'FINALIZED' },
            data: {
              organizationId,
              claimedById: userId,
              claimScopeMappings:
                reconciliation.claimScopeMappings as unknown as Prisma.InputJsonValue,
              profileVersionId: profile.id,
              claimedAt: new Date(),
              sessionRevision: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw staleSession();
          await transaction.auditLog.createMany({
            data: [
              {
                organizationId,
                actorUserId: userId,
                action: 'SST_SETUP_TOPOLOGY_PROVISIONED',
                entityType: 'SstAssessmentSession',
                entityId: sessionId,
                metadata: {
                  assessmentId: sessionId,
                  organizationId,
                  centerCount: provisioned.length,
                  claimDecisionHash,
                },
                ...metadata,
              },
              {
                organizationId,
                actorUserId: userId,
                action: 'PUBLIC_SST_ASSESSMENT_CLAIMED',
                entityType: 'SstAssessmentSession',
                entityId: sessionId,
                metadata: {
                  scopeMappings: reconciliation.claimScopeMappings,
                  profileVersionId: profile.id,
                },
                ...metadata,
              },
            ],
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        (error as { code?: string }).code === 'P2034' ||
        (error as { code?: string }).code === 'P2002'
      ) {
        throw newOrganizationSetupRequired('TRANSACTION_CONFLICT');
      }
      throw error;
    }
    return this.getAuthenticated(organizationId, sessionId);
  }

  private async reconcilePublicClaimContext(
    reader: Pick<Prisma.TransactionClient, 'organization' | 'workCenter'>,
    organizationId: string,
    snapshot: SstAssessmentSnapshot,
    scopeMappings: ClaimPublicAssessmentDto['scopeMappings'],
  ) {
    const centerScopes = snapshot.scopes.filter(({ kind }) => kind === 'WORK_CENTER');
    const mappingKeys = new Set(scopeMappings.map(({ scopeKey }) => scopeKey));
    const targetIds = new Set(scopeMappings.map(({ workCenterId }) => workCenterId));
    if (
      scopeMappings.length !== centerScopes.length ||
      mappingKeys.size !== scopeMappings.length ||
      targetIds.size !== scopeMappings.length ||
      centerScopes.some(({ scopeKey }) => !mappingKeys.has(scopeKey))
    ) {
      throw new BadRequestException({
        code: 'SST_ASSESSMENT_SCOPE_MAPPING_INVALID',
        message: 'Cada alcance público debe vincularse una sola vez a un centro distinto.',
      });
    }
    const [organization, activeCenters] = await Promise.all([
      reader.organization.findUnique({
        where: { id: organizationId },
        select: { country: true },
      }),
      reader.workCenter.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);
    const activeCenterIds = new Set(activeCenters.map(({ id }) => id));
    if (!organization || [...targetIds].some((id) => !activeCenterIds.has(id))) {
      throw new ForbiddenException({
        code: 'SST_ASSESSMENT_SCOPE_MAPPING_FORBIDDEN',
        message: 'Uno o más centros no pertenecen a la organización activa.',
      });
    }
    const publicCountry = snapshot.facts.find(
      (fact) =>
        fact.scopeKey === 'organization' &&
        fact.factKey === 'organization.country' &&
        fact.answerState === 'KNOWN',
    );
    if (
      publicCountry?.answerState !== 'KNOWN' ||
      typeof publicCountry.value !== 'string' ||
      normalizedIdentity(publicCountry.value) !== normalizedIdentity(organization.country)
    ) {
      throw organizationReconciliationRequired('COUNTRY');
    }
    if (
      centerScopes.length !== activeCenters.length ||
      targetIds.size !== activeCenters.length ||
      activeCenters.some(({ id }) => !targetIds.has(id))
    ) {
      throw organizationReconciliationRequired('WORK_CENTER_TOPOLOGY');
    }
    const mappingByScope = new Map(
      scopeMappings.map(({ scopeKey, workCenterId }) => [scopeKey, workCenterId]),
    );
    const centerNamesById = new Map(activeCenters.map(({ id, name }) => [id, name]));
    const claimScopeMappings: SstAssessmentClaimScopeMapping[] = scopeMappings
      .map(({ scopeKey, workCenterId }) => ({
        scopeKey,
        workCenterId,
        displayNameAtClaim: centerNamesById.get(workCenterId)!,
      }))
      .sort((left, right) => left.scopeKey.localeCompare(right.scopeKey));
    return {
      snapshot: normalizeSstAssessmentSnapshot({
        ...snapshot,
        scopes: snapshot.scopes.map((scope) =>
          scope.kind === 'WORK_CENTER'
            ? { ...scope, workCenterId: mappingByScope.get(scope.scopeKey)! }
            : scope,
        ),
      }),
      claimScopeMappings,
    };
  }

  private assessmentFactsFromProfile(
    profile: OrganizationSstProfile | undefined,
    scopes: SstAssessmentScope[],
    profileVersionId?: string,
  ): SstAssessmentFact[] {
    if (!profile || profile.schemaVersion !== '2.0.0') return [];
    const scopeByWorkCenterId = new Map(
      scopes.flatMap((scope) =>
        scope.workCenterId ? [[scope.workCenterId, scope.scopeKey] as const] : [],
      ),
    );
    const mapping: Partial<Record<OrganizationProfileFact['key'], string>> = {
      CHEMICAL_PROCESS_PRESENT: 'workCenter.hasChemicalProcesses',
      HIGH_ENERGY_OPERATION_PRESENT: 'workCenter.hasHighEnergyOperations',
      CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT: 'workCenter.hasExternalWorkforce',
    };
    return profile.contextFacts.flatMap((profileFact): SstAssessmentFact[] => {
      const factKey = mapping[profileFact.key];
      const scopeKey = profileFact.workCenterId
        ? scopeByWorkCenterId.get(profileFact.workCenterId)
        : undefined;
      if (
        !factKey ||
        profileFact.scope !== 'WORK_CENTER' ||
        !scopeKey ||
        profileFact.value === 'UNKNOWN'
      ) {
        return [];
      }
      return [
        sstAssessmentFactSchema.parse({
          factKey,
          scopeKey,
          answerState: 'KNOWN',
          value: profileFact.value === 'KNOWN_TRUE',
          provenance: {
            source: 'PREVIOUS_ASSESSMENT',
            ...(profileVersionId ? { sourceReference: profileVersionId } : {}),
          },
        }),
      ];
    });
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
    const catalog = resolveSstAssessmentCatalog(snapshot.catalogVersion);
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
      const definition = catalog.find(({ factKey }) => factKey === answer.factKey);
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
          catalog,
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
    const facts = reconcileSstAssessmentConditionalFacts({
      ...snapshot,
      facts: [...answerMap.values()],
    }).facts;
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
    const snapshot = snapshotFromRow(session);
    if (session.channel === 'AUTHENTICATED') {
      await this.assertAuthenticatedBaseContext(session);
    }
    const channel = session.channel === 'AUTHENTICATED' ? 'AUTHENTICATED' : 'PUBLIC';
    const result = await this.computeResult(snapshot, this.pinnedVersions(session), channel);
    if (session.channel === 'AUTHENTICATED') {
      await this.assertAuthenticatedBaseContext(session);
    }
    const status = resolveSstAssessmentReadiness(snapshot, {
      channel,
      specialistQuestions: result.questions,
    });
    const updated = await this.prisma.sstAssessmentSession.updateMany({
      where: {
        id: session.id,
        sessionRevision: expectedSessionRevision,
        status: { in: ['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] },
      },
      data: {
        status,
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
    channel: 'PUBLIC' | 'AUTHENTICATED',
  ): Promise<SstAssessmentResult> {
    const specialist = await this.specialists.evaluate(snapshot, pins);
    const specialistsQuestions = [
      ...specialist.adaptive.questions,
      ...specialist.regulatory.questions,
    ];
    const questions = planSstAssessmentQuestions(snapshot, {
      channel,
      specialistQuestions: specialistsQuestions,
    });
    const progress = calculateSstAssessmentProgress(snapshot, {
      channel,
      specialistQuestions: specialistsQuestions,
    });
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
      authoritiesPresent: [
        ...new Set([
          ...items.map(({ authority }) => authority),
          ...specialistTraces.map(({ authority }) => authority),
        ]),
      ].sort(),
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
    mode: 'AUTHENTICATED_FINALIZE' | 'PUBLIC_CLAIM' = 'AUTHENTICATED_FINALIZE',
  ) {
    const [organization, workCenters, workAreaCount, positionCount, latest] = await Promise.all([
      transaction.organization.findUnique({
        where: { id: organizationId },
        select: { country: true, sector: true },
      }),
      transaction.workCenter.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, city: true },
      }),
      transaction.workArea.count({ where: { organizationId, isActive: true } }),
      transaction.position.count({ where: { organizationId, isActive: true } }),
      transaction.organizationSstProfileVersion.findFirst({
        where: { organizationId },
        orderBy: { version: 'desc' },
      }),
    ]);
    if (!organization) throw new NotFoundException('Organización no encontrada.');
    const previous = latest ? organizationSstProfileSchema.parse(latest.snapshot) : undefined;
    const factMap = new Map(
      snapshot.facts.map((fact) => [`${fact.scopeKey}:${fact.factKey}`, fact]),
    );
    const known = (factKey: string) => {
      const fact = factMap.get(`organization:${factKey}`);
      return fact?.answerState === 'KNOWN' ? fact.value : undefined;
    };
    const totalWorkerCountFact = factMap.get('organization:organization.totalWorkerCount');
    const contextMapping: Record<string, OrganizationProfileFact['key']> = {
      'workCenter.hasChemicalProcesses': 'CHEMICAL_PROCESS_PRESENT',
      'workCenter.hasHighEnergyOperations': 'HIGH_ENERGY_OPERATION_PRESENT',
      'workCenter.hasExternalWorkforce': 'CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT',
    };
    const previousContextFacts = previous?.schemaVersion === '2.0.0' ? previous.contextFacts : [];
    const previousContextByIdentity = new Map<string, OrganizationProfileFact>(
      previousContextFacts.map((fact): [string, OrganizationProfileFact] => [
        `${fact.scope}:${fact.workCenterId ?? ''}:${fact.key}`,
        fact,
      ]),
    );
    if (mode === 'PUBLIC_CLAIM' && previous) {
      const conflicts: string[] = [];
      const publicCountry = known('organization.country');
      const publicSector = known('organization.sector');
      const publicWorkerCount = known('organization.totalWorkerCount');
      const publicWorkCenterCount = known('organization.workCenterCount');
      if (
        typeof publicCountry === 'string' &&
        normalizedIdentity(publicCountry) !== normalizedIdentity(previous.organization.country)
      ) {
        conflicts.push('ORGANIZATION_COUNTRY');
      }
      if (
        typeof publicSector === 'string' &&
        previous.organization.sector &&
        normalizedIdentity(publicSector) !== normalizedIdentity(previous.organization.sector)
      ) {
        conflicts.push('ORGANIZATION_SECTOR');
      }
      if (
        typeof publicSector === 'string' &&
        organization.sector &&
        normalizedIdentity(publicSector) !== normalizedIdentity(organization.sector)
      ) {
        conflicts.push('ORGANIZATION_SECTOR');
      }
      if (
        typeof publicWorkerCount === 'number' &&
        previous.organization.workerCount !== undefined &&
        publicWorkerCount !== previous.organization.workerCount
      ) {
        conflicts.push('ORGANIZATION_WORKER_COUNT');
      }
      if (
        totalWorkerCountFact?.answerState === 'EXPLICIT_UNKNOWN' &&
        previous.organization.workerCount !== undefined
      ) {
        conflicts.push('ORGANIZATION_WORKER_COUNT');
      }
      if (
        typeof publicWorkCenterCount === 'number' &&
        publicWorkCenterCount !== previous.organization.workCenterCount
      ) {
        conflicts.push('WORK_CENTER_COUNT');
      }
      if (previous.schemaVersion === '2.0.0') {
        for (const fact of snapshot.facts) {
          const key = contextMapping[fact.factKey];
          const scope = snapshot.scopes.find(({ scopeKey }) => scopeKey === fact.scopeKey);
          if (!key || !scope?.workCenterId) continue;
          const existing = previousContextByIdentity.get(
            `WORK_CENTER:${scope.workCenterId}:${key}`,
          );
          if (!existing) continue;
          const incomingValue =
            fact.answerState === 'EXPLICIT_UNKNOWN'
              ? 'UNKNOWN'
              : fact.value === true
                ? 'KNOWN_TRUE'
                : 'KNOWN_FALSE';
          if (incomingValue !== existing.value) conflicts.push(key);
        }
      }
      for (const [factKey, operationKey, conflictCategory] of [
        ['workCenter.hasChemicalProcesses', 'hasChemicalProcesses', 'CHEMICAL_PROCESS_PRESENT'],
        [
          'workCenter.hasHighEnergyOperations',
          'hasHighEnergyOperations',
          'HIGH_ENERGY_OPERATION_PRESENT',
        ],
      ] as const) {
        const scopedFacts = snapshot.scopes
          .filter(({ kind }) => kind === 'WORK_CENTER')
          .map((scope) =>
            snapshot.facts.find(
              (fact) => fact.scopeKey === scope.scopeKey && fact.factKey === factKey,
            ),
          );
        const incomingAggregate = scopedFacts.some(
          (fact) => fact?.answerState === 'KNOWN' && fact.value === true,
        )
          ? true
          : scopedFacts.length > 0 &&
              scopedFacts.every((fact) => fact?.answerState === 'KNOWN' && fact.value === false)
            ? false
            : undefined;
        const existingAggregate = previous.operations[operationKey];
        if (
          incomingAggregate !== undefined &&
          existingAggregate !== undefined &&
          incomingAggregate !== existingAggregate
        ) {
          conflicts.push(conflictCategory);
        }
      }
      if (conflicts.length > 0) throw profileReconciliationRequired(conflicts);
    }
    const assessmentContextFacts = snapshot.facts.flatMap((fact): OrganizationProfileFact[] => {
      const key = contextMapping[fact.factKey];
      const scope = snapshot.scopes.find(({ scopeKey }) => scopeKey === fact.scopeKey);
      if (!key || !scope?.workCenterId) return [];
      const value =
        fact.answerState === 'EXPLICIT_UNKNOWN'
          ? 'UNKNOWN'
          : fact.value === true
            ? 'KNOWN_TRUE'
            : 'KNOWN_FALSE';
      const identity = `WORK_CENTER:${scope.workCenterId}:${key}`;
      const inherited = previousContextByIdentity.get(identity);
      if (inherited?.value === value) {
        return [inherited];
      }
      return [
        {
          key,
          value,
          scope: 'WORK_CENTER',
          workCenterId: scope.workCenterId,
          provenance: { source: 'DECLARED_BY_ORGANIZATION' },
        },
      ];
    });
    const serverDerivedKeys = new Set<OrganizationProfileFact['key']>([
      'WORK_CENTER_CITY_CONFIRMED',
      'WORK_AREAS_PRESENT',
      'POSITIONS_PRESENT',
    ]);
    const derivedFacts: OrganizationProfileFact[] = [
      {
        key: 'WORK_CENTER_CITY_CONFIRMED',
        value:
          workCenters.length > 0 && workCenters.every(({ city }) => Boolean(city))
            ? 'KNOWN_TRUE'
            : 'UNKNOWN',
        scope: 'ORGANIZATION',
        provenance: {
          source: 'DERIVED_DETERMINISTICALLY',
          note: 'Derivado de los centros activos registrados.',
        },
      },
      {
        key: 'WORK_AREAS_PRESENT',
        value: workAreaCount > 0 ? 'KNOWN_TRUE' : 'UNKNOWN',
        scope: 'ORGANIZATION',
        provenance: {
          source: 'DERIVED_DETERMINISTICALLY',
          note: 'Derivado de la presencia de áreas activas registradas; no afirma completitud.',
        },
      },
      {
        key: 'POSITIONS_PRESENT',
        value: positionCount > 0 ? 'KNOWN_TRUE' : 'UNKNOWN',
        scope: 'ORGANIZATION',
        provenance: {
          source: 'DERIVED_DETERMINISTICALLY',
          note: 'Derivado de la presencia de cargos activos registrados; no afirma completitud.',
        },
      },
    ];
    const contextFactsByIdentity = new Map<string, OrganizationProfileFact>();
    if (previous?.schemaVersion === '2.0.0') {
      for (const fact of previous.contextFacts) {
        if (serverDerivedKeys.has(fact.key)) continue;
        contextFactsByIdentity.set(`${fact.scope}:${fact.workCenterId ?? ''}:${fact.key}`, fact);
      }
    }
    for (const fact of [...assessmentContextFacts, ...derivedFacts]) {
      contextFactsByIdentity.set(`${fact.scope}:${fact.workCenterId ?? ''}:${fact.key}`, fact);
    }
    const contextFacts = [...contextFactsByIdentity.values()].sort((left, right) =>
      `${left.scope}:${left.workCenterId ?? ''}:${left.key}`.localeCompare(
        `${right.scope}:${right.workCenterId ?? ''}:${right.key}`,
      ),
    );
    const activeWorkCenterIds = workCenters.map(({ id }) => id);
    const hasChemicalProcesses = reconcileLegacyOperation(
      previous?.operations.hasChemicalProcesses,
      activeWorkCenterIds,
      contextFacts,
      'CHEMICAL_PROCESS_PRESENT',
    );
    const hasHighEnergyOperations = reconcileLegacyOperation(
      previous?.operations.hasHighEnergyOperations,
      activeWorkCenterIds,
      contextFacts,
      'HIGH_ENERGY_OPERATION_PRESENT',
    );
    const profile = organizationSstProfileSchema.parse({
      schemaVersion: '2.0.0',
      organization: {
        country: organization.country,
        ...((organization.sector ?? (known('organization.sector') as string | undefined))
          ? { sector: organization.sector ?? (known('organization.sector') as string) }
          : {}),
        workCenterCount: workCenters.length,
        ...(typeof known('organization.totalWorkerCount') === 'number'
          ? { workerCount: known('organization.totalWorkerCount') }
          : !totalWorkerCountFact && previous?.organization.workerCount
            ? { workerCount: previous.organization.workerCount }
            : {}),
        ...(previous?.schemaVersion === '2.0.0' && previous.organization.managementPriority
          ? { managementPriority: previous.organization.managementPriority }
          : {}),
      },
      operations: {
        ...(hasChemicalProcesses === undefined ? {} : { hasChemicalProcesses }),
        ...(hasHighEnergyOperations === undefined ? {} : { hasHighEnergyOperations }),
      },
      contextFacts,
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

  private async assertAuthenticatedBaseContext(
    session: {
      organizationId: string | null;
      channel: string;
      baseProfileVersionId: string | null;
      baseProfileHash: string | null;
      baseOrgContextHash: string | null;
      baseTopologyHash: string | null;
    },
    reader: Pick<
      Prisma.TransactionClient,
      'organization' | 'workCenter' | 'organizationSstProfileVersion'
    > = this.prisma,
  ) {
    if (session.channel !== 'AUTHENTICATED' || !session.organizationId) return;
    if (!session.baseOrgContextHash || !session.baseTopologyHash) throw assessmentContextChanged();
    const [organization, centers, latestProfile] = await Promise.all([
      reader.organization.findUnique({
        where: { id: session.organizationId },
        select: { country: true, sector: true },
      }),
      reader.workCenter.findMany({
        where: { organizationId: session.organizationId, isActive: true },
        select: { id: true },
      }),
      reader.organizationSstProfileVersion.findFirst({
        where: { organizationId: session.organizationId },
        select: { id: true, snapshot: true },
        orderBy: { version: 'desc' },
      }),
    ]);
    if (!organization) throw assessmentContextChanged();
    const currentProfileHash = latestProfile
      ? sstAssessmentContentHash(latestProfile.snapshot)
      : null;
    if (
      organizationContextHash(organization) !== session.baseOrgContextHash ||
      workCenterTopologyHash(centers) !== session.baseTopologyHash ||
      (latestProfile?.id ?? null) !== session.baseProfileVersionId ||
      currentProfileHash !== session.baseProfileHash
    ) {
      throw assessmentContextChanged();
    }
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
