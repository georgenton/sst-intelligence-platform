import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMethodologyComparable } from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { ManagementIntelligenceQueryDto } from './dto';

type CountRow = { dimension: string; status: string; count: number };
type MethodRow = {
  methodVersionId: string;
  methodKey: string;
  version: string;
  initialCount: number;
  residualCount: number;
};
type ResidualRow = { methodVersionId: string; level: string; count: number };

@Injectable()
export class ManagementIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, query: ManagementIntelligenceQueryDto) {
    const centerId = query.workCenterId ?? null;
    const category = query.category ?? null;
    const from = query.dateFrom ? new Date(query.dateFrom) : null;
    const to = query.dateTo ? new Date(query.dateTo) : null;
    const [
      findings,
      observations,
      incidents,
      actions,
      plan,
      training,
      ppe,
      methods,
      residuals,
      trend,
    ] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT coalesce(w.name,'Sin centro') dimension, f.status::text status, count(*)::int count FROM "InspectionFinding" f JOIN "WorkCenter" w ON w.id=f."workCenterId" WHERE f."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR f."workCenterId"=${centerId}::uuid) AND (${category}::text IS NULL OR f.category=${category}) AND (${from}::timestamp IS NULL OR f."createdAt">=${from}) AND (${to}::timestamp IS NULL OR f."createdAt"<${to}) GROUP BY w.name,f.status ORDER BY w.name,f.status`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT coalesce(w.name,'Sin centro') dimension, o.status::text status, count(*)::int count FROM "SafetyObservation" o JOIN "WorkCenter" w ON w.id=o."workCenterId" WHERE o."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR o."workCenterId"=${centerId}::uuid) AND (${category}::text IS NULL OR o.category::text=${category}) AND (${from}::timestamp IS NULL OR o."observedAt">=${from}) AND (${to}::timestamp IS NULL OR o."observedAt"<${to}) GROUP BY w.name,o.status ORDER BY w.name,o.status`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT coalesce(w.name,'Sin centro') dimension, i.status::text status, count(*)::int count FROM "Incident" i JOIN "WorkCenter" w ON w.id=i."workCenterId" WHERE i."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR i."workCenterId"=${centerId}::uuid) AND (${category}::text IS NULL OR i."eventType"::text=${category}) AND (${from}::timestamp IS NULL OR i."occurredAt">=${from}) AND (${to}::timestamp IS NULL OR i."occurredAt"<${to}) GROUP BY w.name,i.status ORDER BY w.name,i.status`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT coalesce(w.name,'Sin centro') dimension, a.status::text status, count(*)::int count FROM "CorrectiveAction" a JOIN "InspectionFinding" f ON f.id=a."findingId" JOIN "WorkCenter" w ON w.id=f."workCenterId" WHERE a."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR f."workCenterId"=${centerId}::uuid) GROUP BY w.name,a.status ORDER BY w.name,a.status`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT coalesce(w.name,'Sin centro') dimension, coalesce(e.status::text,'PLANNED') status, count(*)::int count FROM "OperationalPlanItem" p LEFT JOIN "OperationalPlanItemExecution" e ON e."planItemId"=p.id LEFT JOIN "WorkCenter" w ON w.id=p."workCenterId" WHERE p."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR p."workCenterId"=${centerId}::uuid) GROUP BY w.name,e.status ORDER BY w.name,e.status`,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT coalesce(w.name,'Sin centro') dimension, s.status::text status, count(*)::int count FROM "TrainingSession" s LEFT JOIN "WorkCenter" w ON w.id=s."workCenterId" WHERE s."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR s."workCenterId"=${centerId}::uuid) GROUP BY w.name,s.status ORDER BY w.name,s.status`,
      ),
      this.prisma.$queryRaw<Array<{ dimension: string; count: number }>>(
        Prisma.sql`SELECT coalesce(wc.name,'Sin centro') dimension, count(*)::int count FROM "PpeIssue" p JOIN "Worker" worker ON worker.id=p."workerId" LEFT JOIN "WorkCenter" wc ON wc.id=worker."workCenterId" WHERE p."organizationId"=${organizationId}::uuid AND p."replacesIssueId" IS NOT NULL AND (${centerId}::uuid IS NULL OR worker."workCenterId"=${centerId}::uuid) GROUP BY wc.name ORDER BY wc.name`,
      ),
      this.prisma.$queryRaw<MethodRow[]>(
        Prisma.sql`WITH method_counts AS (
          SELECT f."riskMethodVersionId" AS id, count(*)::int AS initial_count, 0::int AS residual_count
          FROM "InspectionFinding" f
          WHERE f."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR f."workCenterId"=${centerId}::uuid)
          GROUP BY f."riskMethodVersionId"
          UNION ALL
          SELECT f."residualMethodVersionId" AS id, 0::int, count(*)::int
          FROM "InspectionFinding" f
          WHERE f."organizationId"=${organizationId}::uuid AND f."residualMethodVersionId" IS NOT NULL AND (${centerId}::uuid IS NULL OR f."workCenterId"=${centerId}::uuid)
          GROUP BY f."residualMethodVersionId"
        ), totals AS (
          SELECT id, sum(initial_count)::int AS "initialCount", sum(residual_count)::int AS "residualCount"
          FROM method_counts GROUP BY id
        )
        SELECT totals.id AS "methodVersionId", d."methodKey", v."semanticVersion" AS version, totals."initialCount", totals."residualCount"
        FROM totals JOIN "RiskMethodVersion" v ON v.id=totals.id JOIN "RiskMethodDefinition" d ON d.id=v."methodDefinitionId"
        ORDER BY d."methodKey",v."semanticVersion",totals.id`,
      ),
      this.prisma.$queryRaw<ResidualRow[]>(
        Prisma.sql`SELECT f."residualMethodVersionId" AS "methodVersionId", f."residualRiskLevel"::text AS level, count(*)::int AS count FROM "InspectionFinding" f WHERE f."organizationId"=${organizationId}::uuid AND f."residualMethodVersionId" IS NOT NULL AND f."residualRiskLevel" IS NOT NULL AND (${centerId}::uuid IS NULL OR f."workCenterId"=${centerId}::uuid) GROUP BY f."residualMethodVersionId",f."residualRiskLevel" ORDER BY f."residualMethodVersionId",f."residualRiskLevel"`,
      ),
      this.prisma.$queryRaw<Array<{ month: Date; type: string; count: number }>>(
        Prisma.sql`SELECT date_trunc('month', event_at) AS "month", type, count(*)::int AS count FROM (SELECT "observedAt" AS event_at,'SAFETY_OBSERVATION' AS type FROM "SafetyObservation" WHERE "organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR "workCenterId"=${centerId}::uuid) UNION ALL SELECT "occurredAt",'INCIDENT' FROM "Incident" WHERE "organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR "workCenterId"=${centerId}::uuid) UNION ALL SELECT "createdAt",'FINDING' FROM "InspectionFinding" WHERE "organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR "workCenterId"=${centerId}::uuid)) events WHERE (${from}::timestamp IS NULL OR event_at>=${from}) AND (${to}::timestamp IS NULL OR event_at<${to}) GROUP BY 1,2 ORDER BY 1,2`,
      ),
    ]);
    return {
      boundary: {
        legalApplicabilityIsNotRisk: true,
        businessPriorityDoesNotChangeScores: true,
        workerRanking: false,
      },
      attention: {
        overdueActions: await this.prisma.correctiveAction.count({
          where: {
            organizationId,
            dueAt: { lt: new Date() },
            status: { notIn: ['COMPLETED', 'CANCELED'] },
            ...(centerId ? { finding: { workCenterId: centerId } } : {}),
          },
        }),
        professionalReviewPending: await this.prisma.unifiedSstEvaluationItem.count({
          where: {
            professionalReviewRequired: true,
            evaluation: { organizationId, status: 'REVIEW_PENDING' },
          },
        }),
      },
      counts: { findings, observations, incidents, actions, plan, training, ppeReplacements: ppe },
      trends: trend,
      riskMethods: methods.map((method) => ({
        ...method,
        residualLevels: Object.fromEntries(
          residuals
            .filter(({ methodVersionId }) => methodVersionId === method.methodVersionId)
            .map(({ level, count }) => [level, count]),
        ),
        compatibility: assertMethodologyComparable([method.methodVersionId]),
        rawCrossMethodAggregation: false,
        residualOnlyWhenRecorded: true,
      })),
      mixedMethodComparison: assertMethodologyComparable(
        methods.map(({ methodVersionId }) => methodVersionId),
      ),
    };
  }
}
