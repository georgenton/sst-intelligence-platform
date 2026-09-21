import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ModuleKey } from '@prisma/client';
import { isUUID } from 'class-validator';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { isDemoActive, isModuleAccessActive } from '../catalog/entitlement';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAPABILITY_ACCESS_BY_KEY,
  CAPABILITY_ACCESS_MAP,
  type CapabilityAccessKey,
} from './capability-access.constants';
import { DemoCapabilityProvisioningService } from './demo-capability-provisioning.service';
import type { ActivateCapabilityDemoDto } from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;
type Recommendation = {
  capabilityKey: CapabilityAccessKey;
  title?: string;
  description?: string;
  priority?: string;
  reasons?: string[];
};
type CapabilityEvaluation = {
  engineVersion: string;
  outputHash: string;
  recommendations: Recommendation[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function storedEvaluation(latestResult: unknown): CapabilityEvaluation | null {
  if (!isRecord(latestResult) || !isRecord(latestResult.capabilityEvaluation)) return null;
  const raw = latestResult.capabilityEvaluation;
  if (typeof raw.engineVersion !== 'string' || typeof raw.outputHash !== 'string') return null;
  if (!Array.isArray(raw.recommendations)) return null;
  const recommendations = raw.recommendations.filter(
    (recommendation): recommendation is Recommendation =>
      isRecord(recommendation) &&
      typeof recommendation.capabilityKey === 'string' &&
      CAPABILITY_ACCESS_BY_KEY.has(recommendation.capabilityKey as CapabilityAccessKey),
  );
  return { engineVersion: raw.engineVersion, outputHash: raw.outputHash, recommendations };
}

function hashIdempotency(organizationId: string, userId: string, key: string) {
  return createHash('sha256')
    .update(`${organizationId}:${userId}:${key.toLowerCase()}`)
    .digest('hex');
}

function hashFingerprint(assessmentId: string, capabilityKeys: readonly string[]) {
  return createHash('sha256')
    .update(JSON.stringify({ assessmentId, capabilityKeys: [...capabilityKeys].sort() }))
    .digest('hex');
}

function boundedAssessment(session: {
  id: string;
  finalizedAt: Date | null;
  latestResult: Prisma.JsonValue | null;
}) {
  const evaluation = storedEvaluation(session.latestResult);
  return {
    provenance: evaluation
      ? {
          id: session.id,
          finalizedAt: session.finalizedAt,
          engineVersion: evaluation.engineVersion,
          outputHash: evaluation.outputHash,
        }
      : null,
    evaluation,
  };
}

@Injectable()
export class CapabilityAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly audit: AuditService,
    private readonly provisioning: DemoCapabilityProvisioningService,
  ) {}

  async overview(organizationId: string, assessmentId?: string) {
    if (assessmentId && !isUUID(assessmentId)) {
      throw new BadRequestException('La evaluación no es válida.');
    }
    const now = new Date();
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        status: true,
        demoStartedAt: true,
        demoExpiresAt: true,
        modules: {
          select: {
            status: true,
            source: true,
            startsAt: true,
            expiresAt: true,
            module: { select: { key: true } },
          },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organización no encontrada.');
    const session = assessmentId
      ? await this.prisma.sstAssessmentSession.findFirst({
          where: { id: assessmentId, organizationId, status: 'FINALIZED' },
          select: { id: true, finalizedAt: true, latestResult: true },
        })
      : await this.prisma.sstAssessmentSession.findFirst({
          where: { organizationId, status: 'FINALIZED' },
          orderBy: { finalizedAt: 'desc' },
          select: { id: true, finalizedAt: true, latestResult: true },
        });
    if (assessmentId && !session)
      throw new NotFoundException('Evaluación finalizada no encontrada.');
    const assessment = session
      ? boundedAssessment(session)
      : { provenance: null, evaluation: null };
    const entitlements = await this.entitlements.effective(organizationId);
    const recommendationByKey = new Map(
      (assessment.evaluation?.recommendations ?? []).map((recommendation) => [
        recommendation.capabilityKey,
        recommendation,
      ]),
    );
    const capabilities = CAPABILITY_ACCESS_MAP.map((definition) => {
      const recommendation = recommendationByKey.get(definition.capabilityKey);
      const row = definition.moduleKey
        ? organization.modules.find(({ module }) => module.key === definition.moduleKey)
        : undefined;
      const activeRow = row && isModuleAccessActive(row.status, row.expiresAt, now);
      let currentAccess: 'CORE' | 'PLAN' | 'ACTIVE' | 'DEMO' | 'LOCKED' = 'LOCKED';
      if (!definition.featureKey) currentAccess = 'CORE';
      else if (row?.status === 'DEMO' && activeRow) currentAccess = 'DEMO';
      else if (row && activeRow && row.status !== 'DEMO') currentAccess = 'ACTIVE';
      else if (entitlements.features[definition.featureKey] === true) currentAccess = 'PLAN';
      return {
        capabilityKey: definition.capabilityKey,
        title: recommendation?.title ?? definition.title,
        description: recommendation?.description ?? definition.description,
        href: definition.href,
        featureKey: definition.featureKey,
        recommended: Boolean(recommendation),
        recommendationPriority: recommendation?.priority,
        recommendationReasons: recommendation?.reasons ?? [],
        currentAccess,
        demoEligible: definition.demoEligible,
        accessExpiresAt: row?.expiresAt ?? undefined,
        source: row?.source ?? undefined,
        capabilityOrigin: recommendation ? 'ASSESSMENT_RECOMMENDED' : 'EXPLORATION_SELECTED',
      };
    });
    const demoActive =
      organization.status === 'DEMO' && isDemoActive(organization.demoExpiresAt, now);
    const demoExpired =
      organization.status === 'DEMO' && !demoActive && organization.demoExpiresAt !== null;
    return {
      assessment: assessment.provenance,
      demo: {
        active: demoActive,
        startedAt: organization.demoStartedAt,
        expiresAt: organization.demoExpiresAt,
        canActivate: entitlements.features['demo.enabled'] === true && !demoExpired,
      },
      capabilities,
    };
  }

  async activateDemo(
    organizationId: string,
    userId: string,
    body: ActivateCapabilityDemoDto,
    idempotencyKey: string | undefined,
    context: Context,
  ) {
    if (!idempotencyKey || !isUUID(idempotencyKey, '4')) {
      throw new BadRequestException('La clave idempotente es obligatoria y debe ser UUID.');
    }
    const capabilityKeys = [...new Set(body.capabilityKeys)] as CapabilityAccessKey[];
    const definitions = capabilityKeys.map((key) => CAPABILITY_ACCESS_BY_KEY.get(key));
    if (
      definitions.some(
        (definition) => !definition || !definition.demoEligible || !definition.moduleKey,
      )
    ) {
      throw new BadRequestException({
        code: 'CAPABILITY_DEMO_SELECTION_INVALID',
        message: 'Selecciona capacidades disponibles para demostración.',
      });
    }
    const featureAccess = await this.entitlements.effective(organizationId);
    if (featureAccess.features['demo.enabled'] !== true) {
      throw new ForbiddenException({
        code: 'DEMO_DISABLED',
        message: 'La demostración no está disponible para esta organización.',
      });
    }
    const keyHash = hashIdempotency(organizationId, userId, idempotencyKey);
    const fingerprint = hashFingerprint(body.assessmentId, capabilityKeys);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE
      `);
      const previous = await tx.auditLog.findFirst({
        where: {
          organizationId,
          actorUserId: userId,
          action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED',
          metadata: { path: ['idempotencyKeyHash'], equals: keyHash },
        },
        select: { metadata: true },
      });
      if (previous) {
        const metadata = previous.metadata as Prisma.JsonObject;
        if (metadata.fingerprint !== fingerprint) {
          throw new ConflictException({
            code: 'CAPABILITY_DEMO_RETRY_CONFLICT',
            message: 'La clave idempotente ya pertenece a otra selección.',
          });
        }
        return { idempotent: true, expiresAt: metadata.expiresAt ?? null };
      }
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { status: true, demoStartedAt: true, demoExpiresAt: true },
      });
      const now = new Date();
      if (
        organization.status === 'DEMO' &&
        organization.demoExpiresAt &&
        organization.demoExpiresAt <= now
      ) {
        throw new ConflictException({
          code: 'DEMO_EXPIRED',
          message: 'La demostración terminó. Solicita acceso para continuar.',
        });
      }
      const session = await tx.sstAssessmentSession.findFirst({
        where: { id: body.assessmentId, organizationId, status: 'FINALIZED' },
        select: { id: true, latestResult: true },
      });
      if (!session) throw new NotFoundException('Evaluación finalizada no encontrada.');
      const assessment = boundedAssessment({ ...session, finalizedAt: null });
      if (!assessment.evaluation) {
        throw new ConflictException({
          code: 'CAPABILITY_EVALUATION_UNAVAILABLE',
          message: 'La evaluación no contiene propuestas de capacidades disponibles.',
        });
      }
      const recommended = new Set(
        assessment.evaluation.recommendations.map(({ capabilityKey }) => capabilityKey),
      );
      const startsAt = organization.demoStartedAt ?? now;
      const firstActivation = !organization.demoExpiresAt || organization.status !== 'DEMO';
      const durationDaysValue = featureAccess.features['demo.duration_days'];
      const durationDays =
        typeof durationDaysValue === 'number'
          ? durationDaysValue
          : Number(process.env.DEMO_DURATION_DAYS ?? 14);
      const expiresAt = firstActivation
        ? new Date(now.getTime() + durationDays * 86_400_000)
        : organization.demoExpiresAt!;
      if (firstActivation) {
        await tx.organization.update({
          where: { id: organizationId },
          data: { status: 'DEMO', demoStartedAt: startsAt, demoExpiresAt: expiresAt },
        });
      }
      const metadataByModule = new Map<ModuleKey, Prisma.InputJsonObject>();
      for (const definition of definitions) {
        const origin = recommended.has(definition!.capabilityKey)
          ? 'ASSESSMENT_RECOMMENDED'
          : 'EXPLORATION_SELECTED';
        metadataByModule.set(definition!.moduleKey!, {
          accessType: 'DEMO',
          assessmentId: body.assessmentId,
          capabilityKey: definition!.capabilityKey,
          capabilityOrigin: origin,
          capabilityEngineVersion: assessment.evaluation.engineVersion,
          capabilityOutputHash: assessment.evaluation.outputHash,
        });
      }
      await this.provisioning.provision({
        tx,
        organizationId,
        userId,
        moduleKeys: definitions.map((definition) => definition!.moduleKey!),
        capabilityMetadata: metadataByModule,
        startsAt: now,
        expiresAt,
      });
      await this.audit.record(
        {
          organizationId,
          actorUserId: userId,
          action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED',
          entityType: 'Organization',
          entityId: organizationId,
          metadata: {
            assessmentId: body.assessmentId,
            capabilityKeys,
            recommendedCapabilityKeys: capabilityKeys.filter((key) => recommended.has(key)),
            explorationCapabilityKeys: capabilityKeys.filter((key) => !recommended.has(key)),
            engineVersion: assessment.evaluation.engineVersion,
            outputHash: assessment.evaluation.outputHash,
            expiresAt,
            idempotencyKeyHash: keyHash,
            fingerprint,
            temporary: true,
          },
          ...context,
        },
        tx,
      );
      return { idempotent: false, expiresAt };
    });
    return { ...result, access: await this.overview(organizationId, body.assessmentId) };
  }
}
