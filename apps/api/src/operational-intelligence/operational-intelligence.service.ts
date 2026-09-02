import { createHash } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  deriveOverdueActionClusterSignals,
  deriveRepeatedFindingSignals,
  type OperationalSignalCandidate,
} from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewOperationalSignalDto } from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

@Injectable()
export class OperationalIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listSignals(organizationId: string) {
    return this.prisma.operationalSignal.findMany({
      where: { organizationId },
      include: {
        workCenter: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, displayName: true } },
      },
      orderBy: [{ status: 'asc' }, { lastDetectedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async evaluate(organizationId: string, userId: string, context: Context) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const [findings, correctiveActions, incidentActions, governanceActions, obligations] =
      await Promise.all([
        this.prisma.inspectionFinding.findMany({
          where: { organizationId, createdAt: { gte: windowStart, lte: now } },
          select: {
            id: true,
            organizationId: true,
            workCenterId: true,
            category: true,
            status: true,
            createdAt: true,
          },
        }),
        this.prisma.correctiveAction.findMany({
          where: {
            organizationId,
            status: { notIn: ['COMPLETED', 'CANCELED'] },
            dueAt: { lt: now },
            createdAt: { gte: windowStart, lte: now },
          },
          select: {
            id: true,
            organizationId: true,
            title: true,
            status: true,
            dueAt: true,
            createdAt: true,
            finding: { select: { workCenterId: true } },
          },
        }),
        this.prisma.incidentAction.findMany({
          where: {
            organizationId,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
            dueAt: { lt: now },
            createdAt: { gte: windowStart, lte: now },
          },
          select: {
            id: true,
            organizationId: true,
            title: true,
            status: true,
            dueAt: true,
            createdAt: true,
            incident: { select: { workCenterId: true } },
          },
        }),
        this.prisma.governanceAction.findMany({
          where: {
            organizationId,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
            dueAt: { lt: now },
            createdAt: { gte: windowStart, lte: now },
            decision: { meeting: { body: { workCenterId: { not: null } } } },
          },
          select: {
            id: true,
            organizationId: true,
            title: true,
            status: true,
            dueAt: true,
            createdAt: true,
            decision: {
              select: { meeting: { select: { body: { select: { workCenterId: true } } } } },
            },
          },
        }),
        this.prisma.obligationExecution.findMany({
          where: {
            organizationId,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
            workCenterId: { not: null },
            dueAt: { lt: now },
            createdAt: { gte: windowStart, lte: now },
          },
          select: {
            id: true,
            organizationId: true,
            workCenterId: true,
            title: true,
            status: true,
            dueAt: true,
            createdAt: true,
          },
        }),
      ]);

    const overdueActions = [
      ...correctiveActions.map((item) => ({
        ...item,
        workCenterId: item.finding.workCenterId,
        dueAt: item.dueAt!,
        sourceType: 'CORRECTIVE_ACTION',
      })),
      ...incidentActions.map((item) => ({
        ...item,
        workCenterId: item.incident.workCenterId,
        dueAt: item.dueAt!,
        sourceType: 'INCIDENT_ACTION',
      })),
      ...governanceActions.map((item) => ({
        ...item,
        workCenterId: item.decision.meeting.body.workCenterId!,
        dueAt: item.dueAt!,
        sourceType: 'GOVERNANCE_ACTION',
      })),
      ...obligations.map((item) => ({
        ...item,
        workCenterId: item.workCenterId!,
        dueAt: item.dueAt!,
        sourceType: 'OBLIGATION_EXECUTION',
      })),
    ];
    const candidates = [
      ...deriveRepeatedFindingSignals(findings, now),
      ...deriveOverdueActionClusterSignals(overdueActions, now),
    ];
    const persisted = await this.persistCandidates(organizationId, candidates, now);
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OPERATIONAL_SIGNALS_EVALUATED',
      entityType: 'OperationalSignal',
      metadata: {
        candidateCount: candidates.length,
        repeatedFindingCount: candidates.filter(({ type }) => type === 'REPEATED_FINDING').length,
        overdueActionClusterCount: candidates.filter(
          ({ type }) => type === 'OVERDUE_ACTION_CLUSTER',
        ).length,
      },
      ...context,
    });
    return { generatedAt: now, count: persisted.length, items: persisted };
  }

  async review(
    organizationId: string,
    signalId: string,
    userId: string,
    input: ReviewOperationalSignalDto,
    context: Context,
  ) {
    const result = await this.prisma.operationalSignal.updateMany({
      where: {
        id: signalId,
        organizationId,
        status: 'ACTIVE',
        version: input.expectedVersion,
      },
      data: {
        status: 'REVIEWED',
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNote: input.note?.trim(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      const exists = await this.prisma.operationalSignal.count({
        where: { id: signalId, organizationId },
      });
      if (!exists) throw new NotFoundException('Señal operativa no encontrada.');
      throw new ConflictException('La señal cambió en otra sesión o ya fue revisada.');
    }
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'OPERATIONAL_SIGNAL_REVIEWED',
      entityType: 'OperationalSignal',
      entityId: signalId,
      metadata: { previousVersion: input.expectedVersion },
      ...context,
    });
    return this.prisma.operationalSignal.findFirstOrThrow({
      where: { id: signalId, organizationId },
      include: { workCenter: { select: { id: true, name: true } } },
    });
  }

  async workCenterOverview(organizationId: string, workCenterId: string) {
    const workCenter = await this.prisma.workCenter.findFirst({
      where: { id: workCenterId, organizationId },
      select: { id: true, name: true, isActive: true },
    });
    if (!workCenter) throw new NotFoundException('Centro de trabajo no encontrado.');
    const [inspections, incidents, ppe, training, permits, actions, signals] = await Promise.all([
      this.prisma.inspection.count({ where: { organizationId, workCenterId } }),
      this.prisma.incident.count({ where: { organizationId, workCenterId } }),
      this.prisma.ppeIssue.count({ where: { organizationId, worker: { workCenterId } } }),
      this.prisma.workerCompetencyRequirement.count({
        where: { organizationId, worker: { workCenterId } },
      }),
      this.prisma.workPermit.count({ where: { organizationId, workCenterId } }),
      this.prisma.correctiveAction.count({
        where: { organizationId, finding: { workCenterId } },
      }),
      this.prisma.operationalSignal.findMany({
        where: { organizationId, workCenterId, status: 'ACTIVE' },
        select: { id: true, type: true, title: true, observedCount: true, ruleKey: true },
        orderBy: { lastDetectedAt: 'desc' },
      }),
    ]);
    return {
      workCenter,
      factualCounts: { inspections, incidents, ppe, training, permits, actions },
      activeSignals: signals,
      interpretation: 'Conteos operativos; no representan predicción ni conclusión de causa raíz.',
    };
  }

  async workerFacts(organizationId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId },
      select: { id: true, displayName: true, status: true, workCenterId: true },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado.');
    const [incidents, ppeIssues, trainingRequirements, trainingCompletions, workCenterSignals] =
      await Promise.all([
        this.prisma.incidentWorker.count({ where: { organizationId, workerId } }),
        this.prisma.ppeIssue.count({ where: { organizationId, workerId } }),
        this.prisma.workerCompetencyRequirement.count({ where: { organizationId, workerId } }),
        this.prisma.workerTrainingCompletion.count({ where: { organizationId, workerId } }),
        worker.workCenterId
          ? this.prisma.operationalSignal.findMany({
              where: { organizationId, workCenterId: worker.workCenterId, status: 'ACTIVE' },
              select: { id: true, type: true, title: true },
              orderBy: { lastDetectedAt: 'desc' },
            })
          : [],
      ]);
    return {
      worker,
      facts: { incidents, ppeIssues, trainingRequirements, trainingCompletions },
      workCenterContextSignals: workCenterSignals,
      workerSafetyScore: null,
      workerRating: null,
      interpretation:
        'Hechos registrados y contexto del centro de trabajo; no califican a la persona como segura o insegura.',
    };
  }

  private async persistCandidates(
    organizationId: string,
    candidates: OperationalSignalCandidate[],
    now: Date,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const keyed = candidates.map((candidate) => ({
        candidate,
        fingerprint: this.digest(candidate.fingerprintInput),
        sourceDigest: this.digest(JSON.stringify(candidate.sourceRecords)),
      }));
      const existing = await transaction.operationalSignal.findMany({
        where: {
          organizationId,
          OR: keyed.map(({ candidate, fingerprint }) => ({ type: candidate.type, fingerprint })),
        },
        select: { type: true, fingerprint: true, status: true },
      });
      const existingStatus = new Map(
        existing.map((item) => [`${item.type}:${item.fingerprint}`, item.status]),
      );
      const items = [];
      for (const { candidate, fingerprint, sourceDigest } of keyed) {
        const previousStatus = existingStatus.get(`${candidate.type}:${fingerprint}`);
        items.push(
          await transaction.operationalSignal.upsert({
            where: {
              organizationId_type_fingerprint: {
                organizationId,
                type: candidate.type,
                fingerprint,
              },
            },
            create: {
              organizationId,
              workCenterId: candidate.workCenterId,
              type: candidate.type,
              fingerprint,
              title: candidate.title,
              explanation: candidate.explanation,
              attention: candidate.attention,
              ruleKey: candidate.ruleKey,
              ruleVersion: candidate.ruleVersion,
              threshold: candidate.threshold,
              observedCount: candidate.observedCount,
              windowStart: candidate.windowStart,
              windowEnd: candidate.windowEnd,
              sourceRecords: candidate.sourceRecords as Prisma.InputJsonValue,
              sourceDigest,
              firstDetectedAt: now,
              lastDetectedAt: now,
            },
            update: {
              title: candidate.title,
              explanation: candidate.explanation,
              attention: candidate.attention,
              observedCount: candidate.observedCount,
              windowStart: candidate.windowStart,
              windowEnd: candidate.windowEnd,
              sourceRecords: candidate.sourceRecords as Prisma.InputJsonValue,
              sourceDigest,
              lastDetectedAt: now,
              ...(previousStatus === 'CLOSED' ? { status: 'ACTIVE' } : {}),
              version: { increment: 1 },
            },
            include: { workCenter: { select: { id: true, name: true } } },
          }),
        );
      }
      const activeFingerprints = keyed.map(({ fingerprint }) => fingerprint);
      await transaction.operationalSignal.updateMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          type: { in: ['REPEATED_FINDING', 'OVERDUE_ACTION_CLUSTER'] },
          ...(activeFingerprints.length ? { fingerprint: { notIn: activeFingerprints } } : {}),
        },
        data: { status: 'CLOSED', version: { increment: 1 } },
      });
      return items;
    });
  }

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
