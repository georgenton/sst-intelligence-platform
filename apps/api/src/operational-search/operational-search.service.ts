import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { operationalSearchTypes } from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { OperationalSearchQueryDto } from './dto';

type SearchRow = {
  id: string;
  type: string;
  title: string;
  snippet: string;
  status: string | null;
  workCenterId: string | null;
  workCenterName: string | null;
  occurredAt: Date;
  rank: number;
  total: number;
};

@Injectable()
export class OperationalSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(organizationId: string, query: OperationalSearchQueryDto) {
    const types = query.types?.length ? query.types : [...operationalSearchTypes];
    const typeFilter = Prisma.join(types);
    const centerId = query.workCenterId ?? null;
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      WITH search_query AS (SELECT plainto_tsquery('simple', ${query.q}) AS value),
      candidates AS (
        SELECT i.id, 'INSPECTION'::text AS type, i.title,
          left(coalesce(i.description, 'Inspección'), 240) AS snippet, i.status::text,
          i."workCenterId", wc.name AS "workCenterName", i."updatedAt" AS "occurredAt",
          ts_rank(to_tsvector('simple', coalesce(i.title, '') || ' ' || coalesce(i.description, '')), sq.value)::float AS rank
        FROM "Inspection" i JOIN "WorkCenter" wc ON wc.id=i."workCenterId" CROSS JOIN search_query sq
        WHERE i."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR i."workCenterId"=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(i.title, '') || ' ' || coalesce(i.description, '')) @@ sq.value
        UNION ALL
        SELECT f.id, 'FINDING', f.title, left(f.description,240), f.status::text, f."workCenterId", wc.name, f."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(f.title, '') || ' ' || coalesce(f.description, '') || ' ' || coalesce(f.category, '')), sq.value)::float
        FROM "InspectionFinding" f JOIN "WorkCenter" wc ON wc.id=f."workCenterId" CROSS JOIN search_query sq
        WHERE f."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR f."workCenterId"=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(f.title, '') || ' ' || coalesce(f.description, '') || ' ' || coalesce(f.category, '')) @@ sq.value
        UNION ALL
        SELECT o.id, 'SAFETY_OBSERVATION', o.title, left(o.description,240), o.status::text, o."workCenterId", wc.name, o."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(o.title, '') || ' ' || coalesce(o.description, '')), sq.value)::float
        FROM "SafetyObservation" o JOIN "WorkCenter" wc ON wc.id=o."workCenterId" CROSS JOIN search_query sq
        WHERE o."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR o."workCenterId"=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(o.title, '') || ' ' || coalesce(o.description, '')) @@ sq.value
        UNION ALL
        SELECT n.id, 'INCIDENT', n.title, 'Registro de incidente · detalle restringido', n.status::text, n."workCenterId", wc.name, n."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.description, '')), sq.value)::float
        FROM "Incident" n JOIN "WorkCenter" wc ON wc.id=n."workCenterId" CROSS JOIN search_query sq
        WHERE n."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR n."workCenterId"=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.description, '')) @@ sq.value
        UNION ALL
        SELECT a.id, 'ACTION', a.title, left(coalesce(a.description,'Acción correctiva'),240), a.status::text, f."workCenterId", wc.name, a."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')), sq.value)::float
        FROM "CorrectiveAction" a JOIN "InspectionFinding" f ON f.id=a."findingId" JOIN "WorkCenter" wc ON wc.id=f."workCenterId" CROSS JOIN search_query sq
        WHERE a."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR f."workCenterId"=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) @@ sq.value
        UNION ALL
        SELECT p.id, 'PLAN_ITEM', p.title, left(coalesce(p.description,'Ítem de plan'),240), coalesce(e.status::text,'PLANNED'), p."workCenterId", wc.name, p."createdAt",
          ts_rank(to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.description, '')), sq.value)::float
        FROM "OperationalPlanItem" p LEFT JOIN "OperationalPlanItemExecution" e ON e."planItemId"=p.id LEFT JOIN "WorkCenter" wc ON wc.id=p."workCenterId" CROSS JOIN search_query sq
        WHERE p."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR p."workCenterId"=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.description, '')) @@ sq.value
        UNION ALL
        SELECT w.id, 'WORKER', w."displayName", left(coalesce(w."internalCode",'') || CASE WHEN w."jobTitle" IS NULL THEN '' ELSE ' · ' || w."jobTitle" END,240), w.status::text, w."workCenterId", wc.name, w."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(w."displayName", '') || ' ' || coalesce(w."internalCode", '') || ' ' || coalesce(w."jobTitle", '')), sq.value)::float
        FROM "Worker" w LEFT JOIN "WorkCenter" wc ON wc.id=w."workCenterId" CROSS JOIN search_query sq
        WHERE w."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR w."workCenterId"=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(w."displayName", '') || ' ' || coalesce(w."internalCode", '') || ' ' || coalesce(w."jobTitle", '')) @@ sq.value
        UNION ALL
        SELECT p.id, 'POSITION', p.name, left(coalesce(p.description,p.code,'Cargo'),240), CASE WHEN p."isActive" THEN 'ACTIVE' ELSE 'INACTIVE' END, NULL::uuid, NULL::text, p."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.code, '') || ' ' || coalesce(p.description, '')), sq.value)::float
        FROM "Position" p CROSS JOIN search_query sq WHERE p."organizationId"=${organizationId}::uuid AND ${centerId}::uuid IS NULL
          AND to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.code, '') || ' ' || coalesce(p.description, '')) @@ sq.value
        UNION ALL
        SELECT t.id, 'TRAINING', t.title, left(coalesce(t.description,t.category),240), CASE WHEN t."isActive" THEN 'ACTIVE' ELSE 'INACTIVE' END, NULL::uuid, NULL::text, t."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '') || ' ' || coalesce(t.category, '')), sq.value)::float
        FROM "TrainingDefinition" t CROSS JOIN search_query sq WHERE t."organizationId"=${organizationId}::uuid AND ${centerId}::uuid IS NULL
          AND to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '') || ' ' || coalesce(t.category, '')) @@ sq.value
        UNION ALL
        SELECT p.id, 'PPE', p.name, left(coalesce(p.description,p.category::text),240), p.status::text, NULL::uuid, NULL::text, p."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, '')), sq.value)::float
        FROM "PpeCatalogItem" p CROSS JOIN search_query sq WHERE p."organizationId"=${organizationId}::uuid AND ${centerId}::uuid IS NULL
          AND to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, '')) @@ sq.value
        UNION ALL
        SELECT wc.id, 'WORK_CENTER', wc.name, left(coalesce(wc.city,'Centro de trabajo'),240), CASE WHEN wc."isActive" THEN 'ACTIVE' ELSE 'INACTIVE' END, wc.id, wc.name, wc."updatedAt",
          ts_rank(to_tsvector('simple', coalesce(wc.name, '') || ' ' || coalesce(wc.city, '')), sq.value)::float
        FROM "WorkCenter" wc CROSS JOIN search_query sq WHERE wc."organizationId"=${organizationId}::uuid AND (${centerId}::uuid IS NULL OR wc.id=${centerId}::uuid)
          AND to_tsvector('simple', coalesce(wc.name, '') || ' ' || coalesce(wc.city, '')) @@ sq.value
      )
      SELECT *, count(*) OVER()::int AS total FROM candidates
      WHERE type IN (${typeFilter})
      ORDER BY rank DESC, "occurredAt" DESC, type ASC, id ASC
      OFFSET ${offset} LIMIT ${query.pageSize}
    `);
    const deepLinks: Record<string, (id: string) => string> = {
      INSPECTION: (id) => `/app/inspections/${id}`,
      FINDING: () => '/app/inspections',
      SAFETY_OBSERVATION: (id) => `/app/safety-observations/${id}`,
      INCIDENT: (id) => `/app/incidents/${id}`,
      ACTION: () => '/app/work',
      PLAN_ITEM: () => '/app/plans',
      WORKER: (id) => `/app/workers/${id}`,
      POSITION: () => '/app/workers',
      TRAINING: () => '/app/training',
      PPE: () => '/app/ppe',
      WORK_CENTER: () => '/app/workers',
    };
    return {
      items: rows.map(({ rank: _rank, total: _total, ...row }) => ({
        ...row,
        deepLink: deepLinks[row.type]?.(row.id) ?? '/app',
      })),
      total: Number(rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
