import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PpeIssueStatus, Prisma } from '@prisma/client';
import { assertPpeIssueTransition } from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AcknowledgePpeIssueDto,
  CreatePpeCatalogItemDto,
  CreatePpeIssueDto,
  CreatePpeRequirementDto,
  CreatePositionPpeRequirementDto,
  InspectPpeIssueDto,
  PpeAggregateQueryDto,
  PpeCatalogQueryDto,
  ReplacePpeIssueDto,
} from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

const issueInclude = {
  ppeCatalogItem: {
    select: {
      id: true,
      name: true,
      category: true,
      referenceStandard: true,
      referenceJurisdiction: true,
      referenceProvenance: true,
      referenceReviewStatus: true,
      defaultReplacementIntervalDays: true,
    },
  },
  requirement: { select: { id: true, reason: true, status: true } },
  issuedBy: { select: { id: true, displayName: true } },
  acknowledgedBy: { select: { id: true, displayName: true } },
  replacesIssue: { select: { id: true, issuedAt: true, status: true } },
  replacementIssue: { select: { id: true, issuedAt: true, status: true } },
  inspections: {
    select: {
      id: true,
      inspectedAt: true,
      condition: true,
      note: true,
      evidenceUrl: true,
      recordedBy: { select: { id: true, displayName: true } },
    },
    orderBy: [{ inspectedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  },
  incidentLinks: {
    select: { id: true, note: true, incident: { select: { id: true, title: true, status: true } } },
  },
} satisfies Prisma.PpeIssueInclude;

@Injectable()
export class PpeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async catalog(organizationId: string, query: PpeCatalogQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.PpeCatalogItemWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ppeCatalogItem.findMany({
        where,
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          manufacturerModel: true,
          referenceStandard: true,
          referenceJurisdiction: true,
          referenceProvenance: true,
          referenceReviewStatus: true,
          defaultReplacementIntervalDays: true,
          status: true,
          version: true,
          createdAt: true,
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ppeCatalogItem.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Returns one complete server-side projection for the PPE workspace. The
   * client receives totals that were calculated from the tenant's full set of
   * requirements, issues and latest inspections; it never derives totals from
   * a paginated prefix. Stock and certification expiry are explicit
   * non-registered dimensions because this schema does not model either one.
   */
  async aggregate(organizationId: string, query: PpeAggregateQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException('El inicio del periodo debe ser anterior al final.');
    }
    const [requirements, issues] = await Promise.all([
      this.prisma.workerPpeRequirement.findMany({
        where: {
          organizationId,
          status: { in: ['REQUIRED', 'FULFILLED'] },
          ...(query.workCenterId
            ? {
                OR: [
                  { workCenterId: query.workCenterId },
                  { workCenterId: null, worker: { workCenterId: query.workCenterId } },
                ],
              }
            : {}),
        },
        select: {
          ppeCatalogItemId: true,
          workCenterId: true,
          worker: { select: { status: true, workCenterId: true } },
          ppeCatalogItem: { select: { id: true, name: true, category: true, status: true } },
          workCenter: { select: { id: true, name: true } },
        },
      }),
      this.prisma.ppeIssue.findMany({
        where: {
          organizationId,
          ...(query.from || query.to
            ? {
                issuedAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
          ...(query.workCenterId ? { worker: { workCenterId: query.workCenterId } } : {}),
        },
        select: {
          id: true,
          ppeCatalogItemId: true,
          quantity: true,
          status: true,
          expectedReplacementAt: true,
          worker: { select: { status: true, workCenterId: true } },
          ppeCatalogItem: { select: { id: true, name: true, category: true, status: true } },
          inspections: {
            select: { condition: true, inspectedAt: true, createdAt: true, id: true },
            orderBy: [{ inspectedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          },
        },
      }),
    ]);
    const workCenterIds = new Set<string>();
    for (const requirement of requirements) {
      const id = requirement.workCenterId ?? requirement.worker.workCenterId;
      if (id) workCenterIds.add(id);
    }
    for (const issue of issues)
      if (issue.worker.workCenterId) workCenterIds.add(issue.worker.workCenterId);
    const workCenters = await this.prisma.workCenter.findMany({
      where: { organizationId, id: { in: [...workCenterIds] } },
      select: { id: true, name: true },
    });
    const workCenterById = new Map(workCenters.map((center) => [center.id, center]));
    type Aggregate = {
      key: string;
      catalogItem: { id: string; name: string; category: string; status: string };
      workCenter: { id: string; name: string } | null;
      requiredQuantity: number;
      requiredWorkerCount: number;
      currentQuantity: number;
      currentIssueCount: number;
      replacementDueQuantity: number;
      reviewRequiredQuantity: number;
      historicalQuantity: number;
      historicalIssueCount: number;
    };
    const groups = new Map<string, Aggregate>();
    const ensure = (catalogItem: Aggregate['catalogItem'], workCenter: Aggregate['workCenter']) => {
      const key = `${catalogItem.id}:${workCenter?.id ?? 'unassigned'}`;
      const current = groups.get(key);
      if (current) return current;
      const next: Aggregate = {
        key,
        catalogItem,
        workCenter,
        requiredQuantity: 0,
        requiredWorkerCount: 0,
        currentQuantity: 0,
        currentIssueCount: 0,
        replacementDueQuantity: 0,
        reviewRequiredQuantity: 0,
        historicalQuantity: 0,
        historicalIssueCount: 0,
      };
      groups.set(key, next);
      return next;
    };
    for (const requirement of requirements) {
      if (requirement.worker.status !== 'ACTIVE') continue;
      const centerId = requirement.workCenterId ?? requirement.worker.workCenterId;
      if (query.workCenterId && centerId !== query.workCenterId) continue;
      const group = ensure(
        requirement.ppeCatalogItem,
        centerId ? (workCenterById.get(centerId) ?? null) : null,
      );
      group.requiredQuantity += 1;
      group.requiredWorkerCount += 1;
    }
    const now = new Date();
    for (const issue of issues) {
      const centerId = issue.worker.workCenterId;
      if (query.workCenterId && centerId !== query.workCenterId) continue;
      const workCenter = centerId ? (workCenterById.get(centerId) ?? null) : null;
      const group = ensure(issue.ppeCatalogItem, workCenter);
      const quantity = issue.quantity;
      if (['REPLACED', 'RETIRED'].includes(issue.status)) {
        group.historicalQuantity += quantity;
        group.historicalIssueCount += 1;
        continue;
      }
      group.currentQuantity += quantity;
      group.currentIssueCount += 1;
      const due =
        issue.status === 'REPLACEMENT_DUE' ||
        (issue.expectedReplacementAt !== null && issue.expectedReplacementAt <= now);
      if (due) group.replacementDueQuantity += quantity;
      if (issue.inspections[0]?.condition === 'REVIEW_REQUIRED') {
        group.reviewRequiredQuantity += quantity;
      }
    }
    const rows = [...groups.values()]
      .sort(
        (left, right) =>
          left.catalogItem.name.localeCompare(right.catalogItem.name, 'es') ||
          (left.workCenter?.name ?? '').localeCompare(right.workCenter?.name ?? '', 'es'),
      )
      .map(({ key, ...row }) => ({ key, ...row }));
    return {
      complete: true,
      generatedAt: now.toISOString(),
      filters: {
        workCenterId: query.workCenterId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
      },
      totals: {
        groupCount: rows.length,
        requiredQuantity: rows.reduce((sum, row) => sum + row.requiredQuantity, 0),
        requiredWorkerCount: rows.reduce((sum, row) => sum + row.requiredWorkerCount, 0),
        currentQuantity: rows.reduce((sum, row) => sum + row.currentQuantity, 0),
        replacementDueQuantity: rows.reduce((sum, row) => sum + row.replacementDueQuantity, 0),
        reviewRequiredQuantity: rows.reduce((sum, row) => sum + row.reviewRequiredQuantity, 0),
        historicalQuantity: rows.reduce((sum, row) => sum + row.historicalQuantity, 0),
      },
      groups: rows,
      unavailable: {
        stock: 'NOT_REGISTERED',
        certifiedExpiry: 'NOT_REGISTERED',
      },
    };
  }

  async createCatalogItem(
    organizationId: string,
    userId: string,
    input: CreatePpeCatalogItemDto,
    context: Context,
  ) {
    if (
      input.referenceReviewStatus === 'REVIEWED' &&
      (!input.referenceStandard?.trim() || !input.referenceProvenance?.trim())
    ) {
      throw new BadRequestException(
        'Una referencia revisada requiere la referencia técnica y su proveniencia verificable.',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.ppeCatalogItem.create({
          data: {
            organizationId,
            createdById: userId,
            name: input.name.trim(),
            category: input.category,
            description: input.description?.trim(),
            manufacturerModel: input.manufacturerModel?.trim(),
            referenceStandard: input.referenceStandard?.trim(),
            referenceJurisdiction: input.referenceJurisdiction?.trim(),
            referenceProvenance: input.referenceProvenance?.trim(),
            referenceReviewStatus: input.referenceReviewStatus,
            defaultReplacementIntervalDays: input.defaultReplacementIntervalDays,
          },
        });
        await this.recordAudit(
          organizationId,
          userId,
          'PPE_CATALOG_ITEM_CREATED',
          'PpeCatalogItem',
          item.id,
          { category: item.category },
          context,
          tx,
        );
        return item;
      });
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw new ConflictException('Ya existe un elemento de EPP con ese nombre.');
      throw error;
    }
  }

  positionRequirements(organizationId: string) {
    return this.prisma.positionPpeRequirement.findMany({
      where: { organizationId, isActive: true },
      include: {
        position: { select: { id: true, name: true } },
        riskContext: { select: { id: true, category: true, description: true } },
        ppeCatalogItem: {
          select: {
            id: true,
            name: true,
            category: true,
            referenceStandard: true,
            referenceJurisdiction: true,
            referenceReviewStatus: true,
          },
        },
        workCenter: { select: { id: true, name: true } },
        workArea: { select: { id: true, name: true } },
        selectedBy: { select: { id: true, displayName: true } },
      },
      orderBy: [{ position: { name: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  async createPositionRequirement(
    organizationId: string,
    userId: string,
    input: CreatePositionPpeRequirementDto,
    context: Context,
  ) {
    const [position, risk, item, center, area] = await Promise.all([
      this.prisma.position.findFirst({
        where: { id: input.positionId, organizationId, isActive: true },
        select: { id: true },
      }),
      input.riskContextId
        ? this.prisma.positionRiskContext.findFirst({
            where: {
              id: input.riskContextId,
              organizationId,
              positionId: input.positionId,
              isActive: true,
            },
            select: { id: true },
          })
        : null,
      this.requireCatalogItem(organizationId, input.ppeCatalogItemId),
      input.workCenterId
        ? this.prisma.workCenter.findFirst({
            where: { id: input.workCenterId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.workAreaId
        ? this.prisma.workArea.findFirst({
            where: { id: input.workAreaId, organizationId, isActive: true },
            select: { id: true, workCenterId: true },
          })
        : null,
    ]);
    if (!position) throw new BadRequestException('El cargo no pertenece a la organización.');
    if (input.riskContextId && !risk)
      throw new BadRequestException('El riesgo no pertenece al cargo seleccionado.');
    if (input.workCenterId && !center)
      throw new BadRequestException('El centro no pertenece a la organización.');
    if (input.workAreaId && !area)
      throw new BadRequestException('El área no pertenece a la organización.');
    if (area && input.workCenterId && area.workCenterId !== input.workCenterId)
      throw new BadRequestException('El área no pertenece al centro seleccionado.');
    const requirement = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT id FROM "Position"
        WHERE id = ${position.id}::uuid AND "organizationId" = ${organizationId}::uuid
        FOR UPDATE
      `;
      const duplicate = await tx.positionPpeRequirement.findFirst({
        where: {
          organizationId,
          positionId: position.id,
          riskContextId: input.riskContextId ?? null,
          ppeCatalogItemId: item.id,
          workCenterId: input.workCenterId ?? null,
          workAreaId: input.workAreaId ?? null,
          isActive: true,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          'Ya existe un requisito activo idéntico para el cargo y alcance seleccionados.',
        );
      }
      const created = await tx.positionPpeRequirement.create({
        data: {
          organizationId,
          positionId: position.id,
          riskContextId: input.riskContextId,
          ppeCatalogItemId: item.id,
          workCenterId: input.workCenterId,
          workAreaId: input.workAreaId,
          reason: input.reason.trim(),
          decision: input.decision,
          selectedById: userId,
        },
      });
      await this.recordAudit(
        organizationId,
        userId,
        'POSITION_PPE_REQUIREMENT_SELECTED',
        'PositionPpeRequirement',
        created.id,
        { positionId: position.id, decision: input.decision },
        context,
        tx,
      );
      return created;
    });
    return requirement;
  }

  async workerWorkspace(organizationId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId },
      select: {
        id: true,
        displayName: true,
        status: true,
        workCenterId: true,
        workAreaId: true,
        positionId: true,
        position: { select: { id: true, name: true } },
      },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado.');
    const [requirements, issues] = await Promise.all([
      this.prisma.workerPpeRequirement.findMany({
        where: { organizationId, workerId },
        select: {
          id: true,
          reason: true,
          status: true,
          assignedAt: true,
          positionRequirementId: true,
          positionRequirement: {
            select: {
              id: true,
              reason: true,
              decision: true,
              createdAt: true,
              position: { select: { id: true, name: true } },
              riskContext: { select: { id: true, category: true, description: true } },
              workCenter: { select: { id: true, name: true } },
              workArea: { select: { id: true, name: true } },
              selectedBy: { select: { id: true, displayName: true } },
            },
          },
          fulfilledAt: true,
          version: true,
          ppeCatalogItem: {
            select: { id: true, name: true, category: true, status: true },
          },
          workCenter: { select: { id: true, name: true } },
          linkedAssessment: { select: { id: true, title: true } },
          linkedFinding: { select: { id: true, title: true, inspectionId: true } },
          assignedBy: { select: { id: true, displayName: true } },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.ppeIssue.findMany({
        where: { organizationId, workerId },
        include: issueInclude,
        orderBy: { issuedAt: 'desc' },
      }),
    ]);
    const now = new Date();
    return {
      worker,
      requirements,
      issues: issues.map((issue) => ({
        ...issue,
        replacementDue:
          issue.status === 'REPLACEMENT_DUE' ||
          (issue.expectedReplacementAt !== null &&
            issue.expectedReplacementAt <= now &&
            !['REPLACED', 'RETIRED'].includes(issue.status)),
      })),
    };
  }

  async createRequirement(
    organizationId: string,
    userId: string,
    input: CreatePpeRequirementDto,
    context: Context,
  ) {
    const [worker, catalogItem] = await Promise.all([
      this.requireWorker(organizationId, input.workerId, true),
      this.requireCatalogItem(organizationId, input.ppeCatalogItemId),
    ]);
    await this.requireTenantReferences(organizationId, input, worker);
    return await this.prisma.$transaction(async (tx) => {
      const requirement = await tx.workerPpeRequirement.create({
        data: {
          organizationId,
          workerId: worker.id,
          ppeCatalogItemId: catalogItem.id,
          workCenterId: input.workCenterId ?? worker.workCenterId,
          linkedAssessmentId: input.linkedAssessmentId,
          linkedFindingId: input.linkedFindingId,
          positionRequirementId: input.positionRequirementId,
          reason: input.reason.trim(),
          assignedById: userId,
        },
        select: { id: true, workerId: true, ppeCatalogItemId: true, reason: true, status: true },
      });
      await this.recordAudit(
        organizationId,
        userId,
        'PPE_REQUIREMENT_CREATED',
        'WorkerPpeRequirement',
        requirement.id,
        { workerId: worker.id, ppeCatalogItemId: catalogItem.id },
        context,
        tx,
      );
      return requirement;
    });
  }

  async issue(organizationId: string, userId: string, input: CreatePpeIssueDto, context: Context) {
    const worker = await this.requireWorker(organizationId, input.workerId, true);
    const catalogItem = await this.requireCatalogItem(organizationId, input.ppeCatalogItemId);
    this.assertEvidence(input.evidenceNote, input.evidenceUrl);
    const issue = await this.prisma.$transaction(async (tx) => {
      if (input.requirementId) {
        const requirement = await this.lockRequirement(tx, organizationId, input.requirementId);
        if (
          requirement.workerId !== worker.id ||
          requirement.ppeCatalogItemId !== catalogItem.id ||
          requirement.status !== 'REQUIRED'
        ) {
          throw new BadRequestException('El requisito no está disponible para esta entrega.');
        }
      }
      const issuedAt = new Date(input.issuedAt);
      const created = await tx.ppeIssue.create({
        data: {
          organizationId,
          workerId: worker.id,
          ppeCatalogItemId: catalogItem.id,
          requirementId: input.requirementId,
          issuedAt,
          issuedById: userId,
          quantity: input.quantity,
          assetReference: input.assetReference?.trim(),
          expectedReplacementAt: this.replacementDate(
            issuedAt,
            input.expectedReplacementAt,
            catalogItem.defaultReplacementIntervalDays,
          ),
          evidenceNote: input.evidenceNote?.trim(),
          evidenceUrl: input.evidenceUrl,
        },
        include: issueInclude,
      });
      if (input.requirementId) {
        await tx.workerPpeRequirement.update({
          where: { id: input.requirementId },
          data: { status: 'FULFILLED', fulfilledAt: issuedAt, version: { increment: 1 } },
        });
      }
      await this.recordAudit(
        organizationId,
        userId,
        'PPE_ISSUED',
        'PpeIssue',
        created.id,
        { workerId: worker.id, requirementId: input.requirementId ?? null },
        context,
        tx,
      );
      return this.requireIssue(tx, organizationId, created.id);
    });

    return issue;
  }

  async acknowledge(
    organizationId: string,
    issueId: string,
    userId: string,
    input: AcknowledgePpeIssueDto,
    context: Context,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.lockIssue(tx, organizationId, issueId);
      this.assertVersion(issue.version, input.expectedVersion, 'PPE_ISSUE_VERSION_CONFLICT');
      if (issue.status !== 'ISSUED' || issue.acknowledgementStatus !== 'PENDING') {
        throw new BadRequestException('La confirmación de entrega ya no está pendiente.');
      }
      assertPpeIssueTransition(issue.status, 'IN_SERVICE');
      const result = await tx.ppeIssue.updateMany({
        where: { id: issueId, organizationId, version: input.expectedVersion, status: 'ISSUED' },
        data: {
          status: 'IN_SERVICE',
          acknowledgementStatus: 'RECORDED',
          acknowledgedAt: new Date(),
          acknowledgedById: userId,
          acknowledgementNote: input.note.trim(),
          version: { increment: 1 },
        },
      });
      this.assertSingleWriter(result.count, 'PPE_ISSUE_VERSION_CONFLICT');
      await this.recordAudit(
        organizationId,
        userId,
        'PPE_DELIVERY_ACKNOWLEDGED',
        'PpeIssue',
        issueId,
        {},
        context,
        tx,
      );
      return this.requireIssue(tx, organizationId, issueId);
    });
  }

  async inspect(
    organizationId: string,
    issueId: string,
    userId: string,
    input: InspectPpeIssueDto,
    context: Context,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.lockIssue(tx, organizationId, issueId);
      this.assertVersion(issue.version, input.expectedVersion, 'PPE_ISSUE_VERSION_CONFLICT');
      if (['REPLACED', 'RETIRED'].includes(issue.status)) {
        throw new BadRequestException('El elemento histórico ya no admite inspecciones.');
      }
      const nextStatus: PpeIssueStatus =
        input.condition === 'UNSERVICEABLE' ? 'REPLACEMENT_DUE' : issue.status;
      if (nextStatus !== issue.status) assertPpeIssueTransition(issue.status, nextStatus);
      await tx.ppeInspection.create({
        data: {
          organizationId,
          issueId,
          inspectedAt: new Date(input.inspectedAt),
          condition: input.condition,
          note: input.note?.trim(),
          evidenceUrl: input.evidenceUrl,
          recordedById: userId,
        },
      });
      const result = await tx.ppeIssue.updateMany({
        where: { id: issueId, organizationId, version: input.expectedVersion },
        data: { status: nextStatus, version: { increment: 1 } },
      });
      this.assertSingleWriter(result.count, 'PPE_ISSUE_VERSION_CONFLICT');
      await this.recordAudit(
        organizationId,
        userId,
        'PPE_CONDITION_INSPECTED',
        'PpeIssue',
        issueId,
        { condition: input.condition },
        context,
        tx,
      );
      return this.requireIssue(tx, organizationId, issueId);
    });
  }

  async replace(
    organizationId: string,
    issueId: string,
    userId: string,
    input: ReplacePpeIssueDto,
    context: Context,
  ) {
    this.assertEvidence(input.evidenceNote, input.evidenceUrl);
    if (input.reason === 'OTHER_JUSTIFIED' && !input.reasonNote?.trim())
      throw new BadRequestException('Explica el motivo de reemplazo.');
    const replacement = await this.prisma.$transaction(async (tx) => {
      const issue = await this.lockIssue(tx, organizationId, issueId);
      this.assertVersion(issue.version, input.expectedVersion, 'PPE_ISSUE_VERSION_CONFLICT');
      if (!['REPLACEMENT_DUE', 'LOST_DAMAGED'].includes(issue.status)) {
        throw new BadRequestException('El elemento debe requerir reemplazo antes de sustituirse.');
      }
      assertPpeIssueTransition(issue.status, 'REPLACED');
      const worker = await tx.worker.findFirst({
        where: { id: issue.workerId, organizationId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!worker)
        throw new BadRequestException(
          'No se puede crear una nueva entrega para un trabajador inactivo.',
        );
      const catalogItem = await tx.ppeCatalogItem.findFirst({
        where: { id: issue.ppeCatalogItemId, organizationId, status: 'ACTIVE' },
        select: { id: true, defaultReplacementIntervalDays: true },
      });
      if (!catalogItem) throw new BadRequestException('El elemento de catálogo ya no está activo.');
      if (input.linkedIncidentId) {
        const incident = await tx.incident.findFirst({
          where: { id: input.linkedIncidentId, organizationId },
          select: {
            id: true,
            involvedWorkers: { where: { workerId: issue.workerId }, select: { id: true } },
          },
        });
        if (!incident)
          throw new BadRequestException('El incidente no pertenece a la organización.');
        if (incident.involvedWorkers.length === 0) {
          throw new BadRequestException(
            'Vincula explícitamente al trabajador con el incidente antes de asociar su EPP.',
          );
        }
      }
      const result = await tx.ppeIssue.updateMany({
        where: {
          id: issueId,
          organizationId,
          version: input.expectedVersion,
          status: issue.status,
        },
        data: { status: 'REPLACED', version: { increment: 1 } },
      });
      this.assertSingleWriter(result.count, 'PPE_ISSUE_VERSION_CONFLICT');
      const issuedAt = new Date(input.issuedAt);
      const created = await tx.ppeIssue.create({
        data: {
          organizationId,
          workerId: issue.workerId,
          ppeCatalogItemId: issue.ppeCatalogItemId,
          requirementId: issue.requirementId,
          issuedAt,
          issuedById: userId,
          quantity: input.quantity,
          assetReference: input.assetReference?.trim(),
          expectedReplacementAt: this.replacementDate(
            issuedAt,
            input.expectedReplacementAt,
            catalogItem.defaultReplacementIntervalDays,
          ),
          evidenceNote: input.evidenceNote?.trim(),
          evidenceUrl: input.evidenceUrl,
          replacesIssueId: issueId,
          replacementReason: input.reason,
          replacementReasonNote: input.reasonNote?.trim(),
        },
        include: issueInclude,
      });
      if (input.linkedIncidentId) {
        await tx.incidentPpeIssue.create({
          data: {
            organizationId,
            incidentId: input.linkedIncidentId,
            ppeIssueId: issueId,
            note:
              input.reason === 'DAMAGE'
                ? 'Entrega original vinculada por daño antes del reemplazo.'
                : 'Entrega original vinculada al evento antes del reemplazo.',
          },
        });
      }
      await this.recordAudit(
        organizationId,
        userId,
        'PPE_REPLACED',
        'PpeIssue',
        created.id,
        { replacesIssueId: issueId, workerId: created.workerId },
        context,
        tx,
      );
      return created;
    });

    return replacement;
  }

  private async requireWorker(organizationId: string, workerId: string, active: boolean) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId, ...(active ? { status: 'ACTIVE' } : {}) },
      select: { id: true, status: true, workCenterId: true, workAreaId: true, positionId: true },
    });
    if (!worker)
      throw new BadRequestException(
        active
          ? 'El trabajador no pertenece a la organización o está inactivo.'
          : 'El trabajador no pertenece a la organización.',
      );
    return worker;
  }

  private async requireCatalogItem(organizationId: string, catalogItemId: string) {
    const item = await this.prisma.ppeCatalogItem.findFirst({
      where: { id: catalogItemId, organizationId, status: 'ACTIVE' },
      select: { id: true, defaultReplacementIntervalDays: true },
    });
    if (!item) throw new BadRequestException('El elemento de EPP no pertenece al catálogo activo.');
    return item;
  }

  private async requireTenantReferences(
    organizationId: string,
    input: CreatePpeRequirementDto,
    worker: {
      id: string;
      workCenterId: string | null;
      workAreaId: string | null;
      positionId: string | null;
    },
  ) {
    const [workCenter, assessment, finding, positionRequirement] = await Promise.all([
      input.workCenterId
        ? this.prisma.workCenter.findFirst({
            where: { id: input.workCenterId, organizationId, isActive: true },
            select: { id: true },
          })
        : null,
      input.linkedAssessmentId
        ? this.prisma.technicalAssessment.findFirst({
            where: { id: input.linkedAssessmentId, organizationId },
            select: { id: true },
          })
        : null,
      input.linkedFindingId
        ? this.prisma.inspectionFinding.findFirst({
            where: { id: input.linkedFindingId, organizationId },
            select: { id: true },
          })
        : null,
      input.positionRequirementId
        ? this.prisma.positionPpeRequirement.findFirst({
            where: { id: input.positionRequirementId, organizationId, isActive: true },
            select: {
              id: true,
              positionId: true,
              ppeCatalogItemId: true,
              workCenterId: true,
              workAreaId: true,
            },
          })
        : null,
    ]);
    if (input.workCenterId && !workCenter)
      throw new BadRequestException('El centro de trabajo no pertenece a la organización.');
    if (input.linkedAssessmentId && !assessment)
      throw new BadRequestException('La evaluación de riesgo no pertenece a la organización.');
    if (input.linkedFindingId && !finding)
      throw new BadRequestException('El hallazgo no pertenece a la organización.');
    if (input.positionRequirementId && !positionRequirement)
      throw new BadRequestException('El requisito por cargo no pertenece a la organización.');
    if (positionRequirement && positionRequirement.ppeCatalogItemId !== input.ppeCatalogItemId)
      throw new BadRequestException('El EPP no coincide con el requisito seleccionado por cargo.');
    if (positionRequirement && !worker.positionId)
      throw new BadRequestException('El trabajador no tiene un cargo para aplicar este requisito.');
    if (positionRequirement && positionRequirement.positionId !== worker.positionId)
      throw new BadRequestException('El requisito de EPP corresponde a otro cargo.');
    if (
      positionRequirement?.workCenterId &&
      positionRequirement.workCenterId !== worker.workCenterId
    )
      throw new BadRequestException('El requisito de EPP corresponde a otro centro de trabajo.');
    if (positionRequirement?.workAreaId && positionRequirement.workAreaId !== worker.workAreaId)
      throw new BadRequestException('El requisito de EPP corresponde a otra área de trabajo.');
  }

  private async requireIssue(
    tx: Prisma.TransactionClient,
    organizationId: string,
    issueId: string,
  ) {
    const issue = await tx.ppeIssue.findFirst({
      where: { id: issueId, organizationId },
      include: issueInclude,
    });
    if (!issue) throw new NotFoundException('Entrega de EPP no encontrada.');
    return issue;
  }

  private async lockRequirement(
    tx: Prisma.TransactionClient,
    organizationId: string,
    requirementId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WorkerPpeRequirement"
      WHERE id = ${requirementId}::uuid AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new BadRequestException('El requisito de EPP no existe.');
    return tx.workerPpeRequirement.findUniqueOrThrow({
      where: { id: requirementId },
      select: { id: true, workerId: true, ppeCatalogItemId: true, status: true },
    });
  }

  private async lockIssue(tx: Prisma.TransactionClient, organizationId: string, issueId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "PpeIssue"
      WHERE id = ${issueId}::uuid AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new NotFoundException('Entrega de EPP no encontrada.');
    return tx.ppeIssue.findUniqueOrThrow({
      where: { id: issueId },
      select: {
        id: true,
        workerId: true,
        ppeCatalogItemId: true,
        requirementId: true,
        status: true,
        acknowledgementStatus: true,
        version: true,
      },
    });
  }

  private replacementDate(issuedAt: Date, explicit: string | undefined, interval: number | null) {
    if (explicit) return new Date(explicit);
    if (!interval) return undefined;
    const replacement = new Date(issuedAt);
    replacement.setUTCDate(replacement.getUTCDate() + interval);
    return replacement;
  }

  private assertEvidence(note?: string, url?: string) {
    if (note && url)
      throw new BadRequestException('Registra una nota o un enlace de evidencia, no ambos.');
  }

  private assertVersion(current: number, expected: number, code: string) {
    if (current !== expected) this.assertSingleWriter(0, code);
  }

  private assertSingleWriter(count: number, code: string) {
    if (count !== 1)
      throw new ConflictException({
        code,
        message: 'El registro cambió en otra sesión. Actualiza e intenta nuevamente.',
      });
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private recordAudit(
    organizationId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
    context: Context,
    tx: Prisma.TransactionClient,
  ) {
    return this.audit.record(
      {
        organizationId,
        actorUserId,
        action,
        entityType,
        entityId,
        metadata,
        ...context,
      },
      tx,
    );
  }
}
