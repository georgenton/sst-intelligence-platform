import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  applicabilityRulePackSchema,
  evaluateApplicability,
  organizationSstProfileSchema,
  type OrganizationSstProfile,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrganizationSstProfileVersionDto, EvaluateApplicabilityDto } from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

@Injectable()
export class ApplicabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listProfileVersions(organizationId: string) {
    return this.prisma.organizationSstProfileVersion.findMany({
      where: { organizationId },
      select: {
        id: true,
        version: true,
        snapshot: true,
        createdAt: true,
        createdBy: { select: { id: true, displayName: true } },
      },
      orderBy: { version: 'desc' },
      take: 100,
    });
  }

  async getProfileVersion(organizationId: string, profileVersionId: string) {
    const profile = await this.prisma.organizationSstProfileVersion.findFirst({
      where: { id: profileVersionId, organizationId },
      select: {
        id: true,
        version: true,
        snapshot: true,
        createdAt: true,
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    if (!profile) throw new NotFoundException('Versión de perfil SST no encontrada.');
    return profile;
  }

  async createProfileVersion(
    organizationId: string,
    userId: string,
    input: CreateOrganizationSstProfileVersionDto,
    context: Context,
  ) {
    const [organization, workCenterCount] = await Promise.all([
      this.prisma.organization.findFirst({
        where: { id: organizationId },
        select: { country: true, sector: true },
      }),
      this.prisma.workCenter.count({ where: { organizationId } }),
    ]);
    if (!organization) throw new NotFoundException('Organización no encontrada.');

    const snapshot = organizationSstProfileSchema.parse({
      schemaVersion: '1.0.0',
      organization: {
        country: organization.country,
        ...(organization.sector ? { sector: organization.sector } : {}),
        workCenterCount,
        ...(input.workerCount === undefined ? {} : { workerCount: input.workerCount }),
      },
      operations: {
        ...(input.hasChemicalProcesses === undefined
          ? {}
          : { hasChemicalProcesses: input.hasChemicalProcesses }),
        ...(input.hasHighEnergyOperations === undefined
          ? {}
          : { hasHighEnergyOperations: input.hasHighEnergyOperations }),
      },
    });

    const profile = await this.createNextProfileVersion(organizationId, userId, snapshot);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'SST_PROFILE_VERSION_CREATED',
      entityType: 'OrganizationSstProfileVersion',
      entityId: profile.id,
      metadata: { version: profile.version },
      ...context,
    });
    return profile;
  }

  listRulePacks() {
    return this.prisma.applicabilityRulePackVersion.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        key: true,
        name: true,
        version: true,
        status: true,
        sourceType: true,
        sourceReference: true,
        regulatory: true,
        isDemo: true,
        disclaimer: true,
        activatedAt: true,
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  listAssessments(organizationId: string) {
    return this.prisma.applicabilityAssessment.findMany({
      where: { organizationId },
      select: {
        id: true,
        engineVersion: true,
        completedAt: true,
        createdAt: true,
        profileVersion: { select: { id: true, version: true } },
        rulePackVersion: { select: { id: true, key: true, version: true, isDemo: true } },
        _count: { select: { decisions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async evaluate(
    organizationId: string,
    userId: string,
    input: EvaluateApplicabilityDto,
    context: Context,
  ) {
    const [profileRow, rulePackRow] = await Promise.all([
      this.prisma.organizationSstProfileVersion.findFirst({
        where: { id: input.profileVersionId, organizationId },
      }),
      this.prisma.applicabilityRulePackVersion.findFirst({
        where: { id: input.rulePackVersionId, status: 'ACTIVE' },
      }),
    ]);
    if (!profileRow) throw new NotFoundException('Versión de perfil SST no encontrada.');
    if (!rulePackRow) throw new NotFoundException('Versión de reglas activa no encontrada.');

    const profile = organizationSstProfileSchema.parse(profileRow.snapshot);
    const rulePack = applicabilityRulePackSchema.parse(rulePackRow.schema);
    if (
      rulePack.key !== rulePackRow.key ||
      rulePack.version !== rulePackRow.version ||
      rulePack.source.type !== rulePackRow.sourceType ||
      rulePack.regulatory !== rulePackRow.regulatory ||
      rulePack.isDemo !== rulePackRow.isDemo
    ) {
      throw new InternalServerErrorException(
        'La versión de reglas tiene metadatos inconsistentes.',
      );
    }
    const evaluation = evaluateApplicability(profile, rulePack);

    const assessment = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.applicabilityAssessment.create({
        data: {
          organizationId,
          profileVersionId: profileRow.id,
          rulePackVersionId: rulePackRow.id,
          profileSnapshot: profile as Prisma.InputJsonValue,
          rulePackSnapshot: rulePack as Prisma.InputJsonValue,
          engineVersion: evaluation.engineVersion,
          createdById: userId,
        },
        select: { id: true, completedAt: true, createdAt: true },
      });

      for (const result of evaluation.decisions) {
        const decision = await transaction.applicabilityDecision.create({
          data: {
            organizationId,
            assessmentId: created.id,
            targetKey: result.targetKey,
            state: result.state,
            reasonCode: result.reasonCode,
            explanation: result.explanation,
            sourceType: result.sourceType,
            sourceReference: result.sourceReference,
            winningRuleId: result.winningRuleId,
          },
          select: { id: true },
        });
        await transaction.applicabilityEvaluationTrace.createMany({
          data: result.trace.map((trace) => ({
            organizationId,
            assessmentId: created.id,
            decisionId: decision.id,
            ruleId: trace.ruleId,
            targetKey: trace.targetKey,
            composition: trace.mode,
            ruleResult: trace.result,
            configuredState: trace.configuredState,
            contributedState: trace.contributedState,
            reasonCode: trace.reasonCode,
            explanation: trace.explanation,
            predicates: trace.predicates as unknown as Prisma.InputJsonValue,
          })),
        });
      }
      return created;
    });

    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'APPLICABILITY_ASSESSMENT_COMPLETED',
      entityType: 'ApplicabilityAssessment',
      entityId: assessment.id,
      metadata: {
        profileVersionId: profileRow.id,
        profileVersion: profileRow.version,
        rulePackVersionId: rulePackRow.id,
        rulePackKey: rulePackRow.key,
        rulePackVersion: rulePackRow.version,
        engineVersion: evaluation.engineVersion,
      },
      ...context,
    });
    return this.getAssessment(organizationId, assessment.id);
  }

  async getAssessment(organizationId: string, assessmentId: string) {
    const assessment = await this.prisma.applicabilityAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      include: {
        profileVersion: { select: { id: true, version: true } },
        rulePackVersion: {
          select: {
            id: true,
            key: true,
            name: true,
            version: true,
            sourceType: true,
            sourceReference: true,
            regulatory: true,
            isDemo: true,
            disclaimer: true,
          },
        },
        createdBy: { select: { id: true, displayName: true } },
        decisions: {
          where: { organizationId },
          orderBy: { targetKey: 'asc' },
          include: {
            traces: {
              where: { organizationId },
              orderBy: { ruleId: 'asc' },
            },
          },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Evaluación de aplicabilidad no encontrada.');
    return assessment;
  }

  private async createNextProfileVersion(
    organizationId: string,
    userId: string,
    snapshot: OrganizationSstProfile,
  ) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const latest = await transaction.organizationSstProfileVersion.findFirst({
              where: { organizationId },
              select: { version: true },
              orderBy: { version: 'desc' },
            });
            return transaction.organizationSstProfileVersion.create({
              data: {
                organizationId,
                version: (latest?.version ?? 0) + 1,
                snapshot: snapshot as Prisma.InputJsonValue,
                createdById: userId,
              },
              select: { id: true, version: true, snapshot: true, createdAt: true },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isRetryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2002');
        if (!isRetryable || attempt === 3) {
          if (isRetryable) {
            throw new ConflictException('No se pudo asignar una nueva versión del perfil SST.');
          }
          throw error;
        }
      }
    }
    throw new ConflictException('No se pudo asignar una nueva versión del perfil SST.');
  }
}
