import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DEMO_TECHNICAL_RISK_METHOD,
  calculateDemoRisk,
  calculateRecommendation,
  recommendationSchema,
  solutionAnswersSchema,
  type SolutionAnswers,
} from '@sst/contracts';
import { ExplanationService } from '../ai/explanation.service';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

@Injectable()
export class SolutionFinderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly explanation: ExplanationService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementService,
  ) {}

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertToken(expectedHash: string, token: string | undefined) {
    if (!token) throw new ForbiddenException('El token de reanudación es obligatorio.');
    const actual = Buffer.from(this.tokenHash(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new ForbiddenException('El token de reanudación no es válido.');
  }

  private assertNotExpired(expiresAt: Date) {
    if (expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('La sesión de diagnóstico expiró.');
    }
  }

  async create() {
    const definition = await this.prisma.guidedFlowDefinition.findFirstOrThrow({
      where: { key: 'solution-finder', active: true },
      orderBy: { createdAt: 'desc' },
    });
    const token = randomBytes(32).toString('base64url');
    const session = await this.prisma.guidedFlowSession.create({
      data: {
        definitionId: definition.id,
        publicTokenHash: this.tokenHash(token),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
      select: { id: true, status: true, currentStep: true, expiresAt: true },
    });
    return { ...session, resumeToken: token, flowVersion: definition.version };
  }

  async get(id: string, token: string | undefined) {
    const session = await this.prisma.guidedFlowSession.findUnique({
      where: { id },
      select: {
        id: true,
        publicTokenHash: true,
        status: true,
        currentStep: true,
        answers: true,
        expiresAt: true,
        recommendation: { select: { result: true, explanation: true, explanationMode: true } },
        definition: { select: { version: true } },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada.');
    this.assertToken(session.publicTokenHash, token);
    this.assertNotExpired(session.expiresAt);
    return {
      id: session.id,
      status: session.status,
      currentStep: session.currentStep,
      answers: session.answers,
      expiresAt: session.expiresAt,
      recommendation: session.recommendation,
      definition: session.definition,
    };
  }

  async update(
    id: string,
    token: string | undefined,
    input: { answers: Record<string, unknown>; currentStep: number },
  ) {
    const session = await this.prisma.guidedFlowSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sesión no encontrada.');
    this.assertToken(session.publicTokenHash, token);
    this.assertNotExpired(session.expiresAt);
    if (session.status !== 'IN_PROGRESS')
      throw new ForbiddenException('La sesión ya fue completada.');
    return this.prisma.guidedFlowSession.update({
      where: { id },
      data: { answers: input.answers as Prisma.InputJsonValue, currentStep: input.currentStep },
      select: { id: true, status: true, currentStep: true, updatedAt: true },
    });
  }

  async complete(id: string, token: string | undefined, context: Context) {
    const session = await this.prisma.guidedFlowSession.findUnique({
      where: { id },
      include: { recommendation: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada.');
    this.assertToken(session.publicTokenHash, token);
    this.assertNotExpired(session.expiresAt);
    if (session.recommendation) {
      return {
        result: recommendationSchema.parse(session.recommendation.result),
        explanation: session.recommendation.explanation,
        explanationMode: session.recommendation.explanationMode,
      };
    }
    const answers = solutionAnswersSchema.parse(session.answers) as SolutionAnswers;
    const recommendation = calculateRecommendation(answers);
    const explained = await this.explanation.explain({ answers, recommendation });
    const created = await this.prisma.$transaction(async (tx) => {
      const result = await tx.solutionRecommendation.create({
        data: {
          sessionId: session.id,
          engineVersion: recommendation.engineVersion,
          result: recommendation as Prisma.InputJsonValue,
          explanation: explained.explanation as Prisma.InputJsonValue,
          explanationMode: explained.mode,
        },
      });
      await tx.guidedFlowSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', currentStep: 6, completedAt: new Date() },
      });
      return result;
    });
    await Promise.all([
      this.audit.record({
        action: 'SOLUTION_FINDER_COMPLETED',
        entityType: 'GuidedFlowSession',
        entityId: session.id,
        ...context,
      }),
      this.audit.record({
        action: 'RECOMMENDATION_GENERATED',
        entityType: 'SolutionRecommendation',
        entityId: created.id,
        metadata: { engineVersion: recommendation.engineVersion },
        ...context,
      }),
    ]);
    return {
      result: recommendation,
      explanation: explained.explanation,
      explanationMode: explained.mode,
    };
  }

  async claim(id: string, token: string | undefined, userId: string, organizationId: string) {
    const session = await this.prisma.guidedFlowSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sesión no encontrada.');
    this.assertToken(session.publicTokenHash, token);
    this.assertNotExpired(session.expiresAt);
    if (!['COMPLETED', 'CLAIMED'].includes(session.status))
      throw new ForbiddenException('Completa el diagnóstico antes de vincularlo.');
    if (session.claimedByUserId && session.claimedByUserId !== userId)
      throw new ForbiddenException('La sesión ya pertenece a otra cuenta.');
    if (session.organizationId && session.organizationId !== organizationId)
      throw new ForbiddenException('La sesión ya pertenece a otra organización.');
    const claimed = await this.prisma.guidedFlowSession.updateMany({
      where: {
        id,
        status: { in: ['COMPLETED', 'CLAIMED'] },
        OR: [{ claimedByUserId: null }, { claimedByUserId: userId }],
        AND: [{ OR: [{ organizationId: null }, { organizationId }] }],
      },
      data: { claimedByUserId: userId, organizationId, status: 'CLAIMED' },
    });
    if (claimed.count !== 1)
      throw new ForbiddenException('La sesión ya pertenece a otra cuenta u organización.');
    return this.prisma.guidedFlowSession.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, organizationId: true },
    });
  }

  async activateDemo(
    id: string,
    token: string | undefined,
    userId: string,
    organizationId: string,
    context: Context,
  ) {
    const session = await this.prisma.guidedFlowSession.findUnique({
      where: { id },
      include: { recommendation: true },
    });
    if (!session?.recommendation) throw new NotFoundException('Recomendación no encontrada.');
    this.assertToken(session.publicTokenHash, token);
    this.assertNotExpired(session.expiresAt);
    if (session.claimedByUserId !== userId || session.organizationId !== organizationId)
      throw new ForbiddenException('Vincula primero el diagnóstico con la organización activa.');
    const existing = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, status: true, demoStartedAt: true, demoExpiresAt: true },
    });
    if (session.status === 'DEMO_ACTIVATED') return { idempotent: true, organization: existing };

    const effective = await this.entitlements.require(organizationId, 'demo.enabled');
    const featureDays = effective.features['demo.duration_days'];
    const durationDays =
      typeof featureDays === 'number' ? featureDays : Number(process.env.DEMO_DURATION_DAYS ?? 14);
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + durationDays * 86_400_000);
    const recommendation = recommendationSchema.parse(session.recommendation.result);
    const moduleKeys = recommendation.recommendedModules.map((item) => item.moduleKey);
    const moduleDefinitions = await this.prisma.moduleDefinition.findMany({
      where: { key: { in: moduleKeys } },
      select: { id: true, key: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const activated = await tx.guidedFlowSession.updateMany({
        where: {
          id,
          status: 'CLAIMED',
          claimedByUserId: userId,
          organizationId,
        },
        data: { status: 'DEMO_ACTIVATED' },
      });
      if (activated.count !== 1) {
        const current = await tx.guidedFlowSession.findUniqueOrThrow({
          where: { id },
          select: { status: true },
        });
        if (current.status !== 'DEMO_ACTIVATED') {
          throw new ForbiddenException('El diagnóstico no está listo para activar la demo.');
        }
        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { id: true, status: true, demoStartedAt: true, demoExpiresAt: true },
        });
        return { idempotent: true, organization };
      }
      await tx.organization.update({
        where: { id: organizationId },
        data: { status: 'DEMO', demoStartedAt: startsAt, demoExpiresAt: expiresAt },
      });
      for (const module of moduleDefinitions) {
        const isCore = module.key === 'CORE';
        await tx.organizationModule.upsert({
          where: { organizationId_moduleId: { organizationId, moduleId: module.id } },
          update: isCore ? {} : { status: 'DEMO', source: 'RECOMMENDATION', startsAt, expiresAt },
          create: {
            organizationId,
            moduleId: module.id,
            status: isCore ? 'ACTIVE' : 'DEMO',
            source: isCore ? 'PLAN' : 'RECOMMENDATION',
            startsAt,
            expiresAt: isCore ? null : expiresAt,
            metadata: { label: 'Demostración conceptual', synthetic: true },
          },
        });
        if (!isCore) {
          await tx.auditLog.create({
            data: {
              organizationId,
              actorUserId: userId,
              action: 'MODULE_ACTIVATED',
              entityType: 'OrganizationModule',
              entityId: module.id,
              metadata: { moduleKey: module.key, status: 'DEMO', synthetic: true },
              ...context,
            },
          });
        }
      }
      const guayaquil = await tx.workCenter.upsert({
        where: {
          organizationId_name: { organizationId, name: 'Centro Guayaquil (demostración)' },
        },
        update: { isDemo: true },
        create: {
          organizationId,
          name: 'Centro Guayaquil (demostración)',
          city: 'Guayaquil',
          isDemo: true,
        },
      });
      await tx.workCenter.upsert({
        where: { organizationId_name: { organizationId, name: 'Centro Quito (demostración)' } },
        update: { isDemo: true },
        create: {
          organizationId,
          name: 'Centro Quito (demostración)',
          city: 'Quito',
          isDemo: true,
        },
      });
      const electricalArea = await tx.workArea.upsert({
        where: {
          organizationId_workCenterId_name: {
            organizationId,
            workCenterId: guayaquil.id,
            name: 'Planta A',
          },
        },
        update: { isActive: true },
        create: {
          organizationId,
          workCenterId: guayaquil.id,
          name: 'Planta A',
        },
      });
      if (moduleKeys.includes('INSPECTIONS_INTELLIGENCE')) {
        const risk = calculateDemoRisk(4, 4);
        const baseTime = startsAt.getTime();
        for (let index = 0; index < 3; index += 1) {
          const title = `Inspección eléctrica demostrativa ${index + 1}`;
          const alreadyExists = await tx.inspection.findFirst({
            where: { organizationId, title, isDemo: true },
            select: { id: true },
          });
          if (alreadyExists) continue;
          const occurredAt = new Date(baseTime - (30 - index * 10) * 86_400_000);
          const inspection = await tx.inspection.create({
            data: {
              organizationId,
              workCenterId: guayaquil.id,
              workAreaId: electricalArea.id,
              inspectorUserId: userId,
              title,
              description: 'Registro sintético para demostrar recurrencia determinística.',
              status: 'COMPLETED',
              startedAt: occurredAt,
              completedAt: occurredAt,
              isDemo: true,
              createdAt: occurredAt,
            },
          });
          const finding = await tx.inspectionFinding.create({
            data: {
              organizationId,
              inspectionId: inspection.id,
              workCenterId: guayaquil.id,
              workAreaId: electricalArea.id,
              category: 'ELECTRICAL',
              title: `Hallazgo eléctrico sintético ${index + 1}`,
              description: 'Dato sintético sin información personal.',
              riskMethodKey: risk.methodKey,
              riskMethodVersion: risk.methodVersion,
              initialLikelihood: risk.likelihood,
              initialConsequence: risk.consequence,
              initialScore: risk.score,
              initialRiskLevel: risk.level,
              recurrenceCount: index,
              recurrenceStatus:
                index === 0 ? 'NONE' : index === 1 ? 'REPEATED' : 'SYSTEMIC_REVIEW_RECOMMENDED',
              createdById: userId,
              createdAt: occurredAt,
            },
          });
          if (index === 2) {
            await tx.inspectionAlert.create({
              data: {
                organizationId,
                findingId: finding.id,
                type: 'RECURRENCE',
                severity: 'WARNING',
                message:
                  'Se registraron varios hallazgos de categoría Eléctrico en este centro durante los últimos 90 días. Se recomienda revisar si las acciones puntuales son suficientes y evaluar posibles factores sistémicos.',
              },
            });
          }
        }
      }
      if (moduleKeys.includes('TECHNICAL_RISK')) {
        const methodVersion = await tx.technicalMethodVersion.findFirst({
          where: {
            organizationId: null,
            version: DEMO_TECHNICAL_RISK_METHOD.methodVersion,
            calculationKey: DEMO_TECHNICAL_RISK_METHOD.calculationKey,
            status: 'ACTIVE',
            methodDefinition: { key: DEMO_TECHNICAL_RISK_METHOD.methodKey, status: 'ACTIVE' },
          },
          select: { id: true },
        });
        const existingAssessment = await tx.technicalAssessment.findFirst({
          where: {
            organizationId,
            title: 'Evaluación técnica demostrativa',
            isDemo: true,
          },
          select: { id: true },
        });
        if (methodVersion && !existingAssessment) {
          const risk = calculateDemoRisk(4, 5);
          await tx.technicalAssessment.create({
            data: {
              organizationId,
              workCenterId: guayaquil.id,
              workAreaId: electricalArea.id,
              methodVersionId: methodVersion.id,
              methodKey: DEMO_TECHNICAL_RISK_METHOD.methodKey,
              methodVersion: DEMO_TECHNICAL_RISK_METHOD.methodVersion,
              calculationKey: DEMO_TECHNICAL_RISK_METHOD.calculationKey,
              methodSnapshot: DEMO_TECHNICAL_RISK_METHOD as unknown as Prisma.InputJsonValue,
              title: 'Evaluación técnica demostrativa',
              description: 'Registro sintético para explorar el flujo de riesgo técnico.',
              status: 'COMPLETED',
              createdById: userId,
              startedAt: startsAt,
              completedAt: startsAt,
              isDemo: true,
              responses: {
                create: [
                  {
                    organizationId,
                    questionKey: 'activityDescription',
                    value: 'Actividad sintética de demostración',
                  },
                  { organizationId, questionKey: 'likelihood', value: risk.likelihood },
                  { organizationId, questionKey: 'consequence', value: risk.consequence },
                ],
              },
              result: {
                create: {
                  organizationId,
                  methodKey: DEMO_TECHNICAL_RISK_METHOD.methodKey,
                  methodVersion: DEMO_TECHNICAL_RISK_METHOD.methodVersion,
                  calculationKey: DEMO_TECHNICAL_RISK_METHOD.calculationKey,
                  score: risk.score,
                  level: risk.level,
                  result: {
                    likelihood: risk.likelihood,
                    consequence: risk.consequence,
                    synthetic: true,
                  },
                  calculatedAt: startsAt,
                },
              },
            },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: 'DEMO_ACTIVATED',
          entityType: 'Organization',
          entityId: organizationId,
          metadata: { sessionId: id, durationDays, synthetic: true },
          ...context,
        },
      });
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { id: true, status: true, demoStartedAt: true, demoExpiresAt: true },
      });
      return { idempotent: false, organization };
    });
  }
}
