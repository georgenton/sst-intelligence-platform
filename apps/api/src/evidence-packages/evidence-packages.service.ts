import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EvidencePackageItemType, Prisma } from '@prisma/client';
import { assertEvidencePackageTransition, orderEvidenceManifestItems } from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { EntitlementService } from '../catalog/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AddEvidencePackageItemDto,
  CreateEvidencePackageDto,
  EvidenceReferenceQueryDto,
} from './dto';
import { EVIDENCE_REFERENCE_ENTITLEMENTS } from './evidence-packages.policy';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;
type CanonicalReference = {
  label: string;
  sourceVersion: string | null;
  provenance: Prisma.InputJsonValue;
  contentDigest: string | null;
};
type CanonicalReferenceOption = { id: string; label: string; detail: string };
type CanonicalReferenceCatalog = {
  items: CanonicalReferenceOption[];
  total: number;
  page: number;
  pageSize: number;
};

const packageInclude = {
  createdBy: { select: { id: true, displayName: true } },
  items: { orderBy: [{ type: 'asc' as const }, { sourceId: 'asc' as const }] },
} satisfies Prisma.EvidencePackageInclude;

@Injectable()
export class EvidencePackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementService,
  ) {}

  list(organizationId: string) {
    return this.prisma.evidencePackage.findMany({
      where: { organizationId },
      include: packageInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listCanonicalReferences(
    organizationId: string,
    type: EvidencePackageItemType,
    query: EvidenceReferenceQueryDto,
  ): Promise<CanonicalReferenceCatalog> {
    await this.requireReferenceEntitlements(organizationId, [type]);
    const search = query.q?.trim();
    const paging = { skip: (query.page - 1) * query.pageSize, take: query.pageSize };

    switch (type) {
      case 'INSPECTION': {
        const where: Prisma.InspectionWhereInput = {
          organizationId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.inspection.findMany({
            where,
            select: { id: true, title: true, status: true },
            orderBy: { updatedAt: 'desc' },
            ...paging,
          }),
          this.prisma.inspection.count({ where }),
        ]);
        return this.catalog(this.options(values), total, query);
      }
      case 'FINDING': {
        const where: Prisma.InspectionFindingWhereInput = {
          organizationId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.inspectionFinding.findMany({
            where,
            select: { id: true, title: true, status: true },
            orderBy: { updatedAt: 'desc' },
            ...paging,
          }),
          this.prisma.inspectionFinding.count({ where }),
        ]);
        return this.catalog(this.options(values), total, query);
      }
      case 'CORRECTIVE_ACTION': {
        const where: Prisma.CorrectiveActionWhereInput = {
          organizationId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.correctiveAction.findMany({
            where,
            select: { id: true, title: true, status: true },
            orderBy: { updatedAt: 'desc' },
            ...paging,
          }),
          this.prisma.correctiveAction.count({ where }),
        ]);
        return this.catalog(this.options(values), total, query);
      }
      case 'ACTION_EVIDENCE': {
        const where: Prisma.ActionEvidenceWhereInput = {
          organizationId,
          ...(search
            ? { correctiveAction: { title: { contains: search, mode: 'insensitive' } } }
            : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.actionEvidence.findMany({
            where,
            select: {
              id: true,
              type: true,
              createdAt: true,
              correctiveAction: { select: { title: true } },
            },
            orderBy: { createdAt: 'desc' },
            ...paging,
          }),
          this.prisma.actionEvidence.count({ where }),
        ]);
        return this.catalog(
          values.map((value) => ({
            id: value.id,
            label: `${value.correctiveAction.title} · Evidencia ${value.type}`,
            detail: value.createdAt.toLocaleDateString('es-EC'),
          })),
          total,
          query,
        );
      }
      case 'TECHNICAL_ASSESSMENT': {
        const where: Prisma.TechnicalAssessmentWhereInput = {
          organizationId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.technicalAssessment.findMany({
            where,
            select: { id: true, title: true, status: true },
            orderBy: { updatedAt: 'desc' },
            ...paging,
          }),
          this.prisma.technicalAssessment.count({ where }),
        ]);
        return this.catalog(this.options(values), total, query);
      }
      case 'INCIDENT': {
        const where: Prisma.IncidentWhereInput = {
          organizationId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.incident.findMany({
            where,
            select: { id: true, title: true, status: true },
            orderBy: { createdAt: 'desc' },
            ...paging,
          }),
          this.prisma.incident.count({ where }),
        ]);
        return this.catalog(this.options(values), total, query);
      }
      case 'PPE_ISSUE': {
        const where: Prisma.PpeIssueWhereInput = {
          organizationId,
          ...(search
            ? {
                OR: [
                  { worker: { displayName: { contains: search, mode: 'insensitive' } } },
                  { ppeCatalogItem: { name: { contains: search, mode: 'insensitive' } } },
                  { assetReference: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.ppeIssue.findMany({
            where,
            select: {
              id: true,
              status: true,
              issuedAt: true,
              worker: { select: { displayName: true } },
              ppeCatalogItem: { select: { name: true } },
            },
            orderBy: { issuedAt: 'desc' },
            ...paging,
          }),
          this.prisma.ppeIssue.count({ where }),
        ]);
        return this.catalog(
          values.map((value) => ({
            id: value.id,
            label: `${value.worker.displayName} · ${value.ppeCatalogItem.name}`,
            detail: `${value.status} · ${value.issuedAt.toLocaleDateString('es-EC')}`,
          })),
          total,
          query,
        );
      }
      case 'TRAINING_COMPLETION': {
        const where: Prisma.WorkerTrainingCompletionWhereInput = {
          organizationId,
          ...(search
            ? {
                OR: [
                  { worker: { displayName: { contains: search, mode: 'insensitive' } } },
                  { trainingDefinition: { title: { contains: search, mode: 'insensitive' } } },
                ],
              }
            : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.workerTrainingCompletion.findMany({
            where,
            select: {
              id: true,
              completedAt: true,
              worker: { select: { displayName: true } },
              trainingDefinition: { select: { title: true } },
            },
            orderBy: { completedAt: 'desc' },
            ...paging,
          }),
          this.prisma.workerTrainingCompletion.count({ where }),
        ]);
        return this.catalog(
          values.map((value) => ({
            id: value.id,
            label: `${value.worker.displayName} · ${value.trainingDefinition.title}`,
            detail: `Completada ${value.completedAt.toLocaleDateString('es-EC')}`,
          })),
          total,
          query,
        );
      }
      case 'WORK_PERMIT': {
        const where: Prisma.WorkPermitWhereInput = {
          organizationId,
          ...(search ? { activity: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.workPermit.findMany({
            where,
            select: { id: true, activity: true, status: true },
            orderBy: { createdAt: 'desc' },
            ...paging,
          }),
          this.prisma.workPermit.count({ where }),
        ]);
        return this.catalog(
          values.map((value) => ({ id: value.id, label: value.activity, detail: value.status })),
          total,
          query,
        );
      }
      case 'OBLIGATION_EXECUTION': {
        const where: Prisma.ObligationExecutionWhereInput = {
          organizationId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.obligationExecution.findMany({
            where,
            select: { id: true, title: true, status: true },
            orderBy: { createdAt: 'desc' },
            ...paging,
          }),
          this.prisma.obligationExecution.count({ where }),
        ]);
        return this.catalog(this.options(values), total, query);
      }
      case 'GOVERNANCE_MEETING': {
        const where: Prisma.GovernanceMeetingWhereInput = {
          organizationId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.governanceMeeting.findMany({
            where,
            select: { id: true, title: true, status: true },
            orderBy: { scheduledAt: 'desc' },
            ...paging,
          }),
          this.prisma.governanceMeeting.count({ where }),
        ]);
        return this.catalog(this.options(values), total, query);
      }
      case 'GOVERNANCE_DECISION': {
        const where: Prisma.GovernanceDecisionWhereInput = {
          organizationId,
          ...(search ? { summary: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.governanceDecision.findMany({
            where,
            select: { id: true, summary: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            ...paging,
          }),
          this.prisma.governanceDecision.count({ where }),
        ]);
        return this.catalog(
          values.map((value) => ({
            id: value.id,
            label: value.summary,
            detail: value.createdAt.toLocaleDateString('es-EC'),
          })),
          total,
          query,
        );
      }
      case 'REGULATORY_UNIT': {
        const where: Prisma.RegulatoryUnitWhereInput = search
          ? {
              OR: [
                { identifier: { contains: search, mode: 'insensitive' } },
                { locator: { contains: search, mode: 'insensitive' } },
                { heading: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {};
        const [values, total] = await Promise.all([
          this.prisma.regulatoryUnit.findMany({
            where,
            select: {
              id: true,
              identifier: true,
              locator: true,
              heading: true,
              reviewStatus: true,
            },
            orderBy: [{ identifier: 'asc' }, { locator: 'asc' }],
            ...paging,
          }),
          this.prisma.regulatoryUnit.count({ where }),
        ]);
        return this.catalog(
          values.map((value) => ({
            id: value.id,
            label: `${value.identifier} · ${value.locator}`,
            detail: value.heading ?? value.reviewStatus,
          })),
          total,
          query,
        );
      }
      case 'INSPECTION_BASIS_VERSION': {
        const where: Prisma.InspectionBasisVersionWhereInput = {
          organizationId,
          ...(search
            ? {
                OR: [
                  { definition: { name: { contains: search, mode: 'insensitive' } } },
                  { reason: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
        const [values, total] = await Promise.all([
          this.prisma.inspectionBasisVersion.findMany({
            where,
            select: {
              id: true,
              version: true,
              status: true,
              inspectionDomain: true,
              definition: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            ...paging,
          }),
          this.prisma.inspectionBasisVersion.count({ where }),
        ]);
        return this.catalog(
          values.map((value) => ({
            id: value.id,
            label: `${value.definition.name} · v${value.version}`,
            detail: `${value.inspectionDomain} · ${value.status}`,
          })),
          total,
          query,
        );
      }
    }
  }

  async get(organizationId: string, packageId: string) {
    const result = await this.prisma.evidencePackage.findFirst({
      where: { id: packageId, organizationId },
      include: packageInclude,
    });
    if (!result) throw new NotFoundException('Paquete de evidencia no encontrado.');
    return result;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateEvidencePackageDto,
    context: Context,
  ) {
    const result = await this.prisma.evidencePackage.create({
      data: {
        organizationId,
        createdById: userId,
        title: input.title.trim(),
        scope: input.scope.trim(),
      },
      include: packageInclude,
    });
    await this.record(
      organizationId,
      userId,
      'EVIDENCE_PACKAGE_CREATED',
      result.id,
      { scope: result.scope },
      context,
    );
    return result;
  }

  async addItem(
    organizationId: string,
    packageId: string,
    userId: string,
    input: AddEvidencePackageItemDto,
    context: Context,
  ) {
    await this.requireReferenceEntitlements(organizationId, [input.type]);
    const evidencePackage = await this.requireDraft(organizationId, packageId);
    const reference = await this.resolveCanonicalReference(
      organizationId,
      input.type,
      input.sourceId,
    );
    try {
      const item = await this.prisma.evidencePackageItem.create({
        data: {
          organizationId,
          packageId: evidencePackage.id,
          type: input.type,
          sourceId: input.sourceId,
          sourceVersion: reference.sourceVersion,
          labelSnapshot: reference.label,
          provenance: reference.provenance,
          contentDigest: reference.contentDigest,
        },
      });
      await this.record(
        organizationId,
        userId,
        'EVIDENCE_PACKAGE_ITEM_ADDED',
        packageId,
        { itemId: item.id, type: item.type, sourceId: item.sourceId },
        context,
      );
      return item;
    } catch (error) {
      if (this.isUnique(error)) {
        throw new ConflictException('La referencia ya forma parte del paquete.');
      }
      throw error;
    }
  }

  async finalize(organizationId: string, packageId: string, userId: string, context: Context) {
    let result: { manifestDigest: string; itemCount: number };
    try {
      result = await this.prisma.$transaction(
        async (transaction) => {
          const evidencePackage = await transaction.evidencePackage.findFirst({
            where: { id: packageId, organizationId },
            include: { items: true },
          });
          if (!evidencePackage) throw new NotFoundException('Paquete de evidencia no encontrado.');
          if (evidencePackage.status !== 'DRAFT') {
            throw new ConflictException(
              'El paquete finalizado es inmutable; crea uno nuevo para regenerar.',
            );
          }
          if (!evidencePackage.items.length) {
            throw new BadRequestException('Agrega al menos una referencia antes de finalizar.');
          }
          await this.requireReferenceEntitlements(
            organizationId,
            evidencePackage.items.map((item) => item.type),
          );
          assertEvidencePackageTransition(evidencePackage.status, 'FINALIZED');
          const organization = await transaction.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: { id: true, name: true },
          });
          const generatedAt = new Date();
          const capturedItems = await Promise.all(
            evidencePackage.items.map(async (item) => {
              const reference = await this.resolveCanonicalReference(
                organizationId,
                item.type,
                item.sourceId,
                transaction,
              );
              return transaction.evidencePackageItem.update({
                where: { id: item.id },
                data: {
                  sourceVersion: reference.sourceVersion,
                  labelSnapshot: reference.label,
                  provenance: reference.provenance,
                  contentDigest: reference.contentDigest,
                },
              });
            }),
          );
          const manifest = {
            schemaVersion: 'EVIDENCE_PACKAGE_MANIFEST_V1',
            generatedAt: generatedAt.toISOString(),
            generatedBy: userId,
            organization,
            package: {
              id: evidencePackage.id,
              title: evidencePackage.title,
              scope: evidencePackage.scope,
              version: evidencePackage.version,
            },
            items: orderEvidenceManifestItems(capturedItems).map((item) => ({
              type: item.type,
              sourceId: item.sourceId,
              sourceVersion: item.sourceVersion,
              label: item.labelSnapshot,
              provenance: item.provenance,
              contentDigest: item.contentDigest,
            })),
            representation:
              'Instantánea histórica capturada al finalizar; las fuentes canónicas pueden tener un estado actual diferente.',
            certificationClaimed: false,
          } satisfies Prisma.InputJsonValue;
          const manifestDigest = createHash('sha256')
            .update(JSON.stringify(manifest))
            .digest('hex');
          const updated = await transaction.evidencePackage.updateMany({
            where: { id: packageId, organizationId, status: 'DRAFT' },
            data: {
              status: 'FINALIZED',
              generatedAt,
              generatedById: userId,
              finalizedAt: generatedAt,
              manifest,
              manifestDigest,
            },
          });
          if (updated.count !== 1) throw new ConflictException('El paquete cambió en otra sesión.');
          return { manifestDigest, itemCount: capturedItems.length };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (this.isSerializationConflict(error)) {
        throw new ConflictException('El paquete cambió en otra sesión.');
      }
      throw error;
    }
    await this.record(
      organizationId,
      userId,
      'EVIDENCE_PACKAGE_FINALIZED',
      packageId,
      { manifestDigest: result.manifestDigest, itemCount: result.itemCount },
      context,
    );
    return this.get(organizationId, packageId);
  }

  async archive(organizationId: string, packageId: string, userId: string, context: Context) {
    const current = await this.get(organizationId, packageId);
    try {
      assertEvidencePackageTransition(current.status, 'ARCHIVED');
    } catch {
      throw new BadRequestException('Solo un paquete finalizado puede archivarse.');
    }
    const updated = await this.prisma.evidencePackage.updateMany({
      where: { id: packageId, organizationId, status: 'FINALIZED' },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    if (updated.count !== 1) throw new ConflictException('El paquete cambió en otra sesión.');
    await this.record(organizationId, userId, 'EVIDENCE_PACKAGE_ARCHIVED', packageId, {}, context);
    return this.get(organizationId, packageId);
  }

  private async requireDraft(organizationId: string, packageId: string) {
    const evidencePackage = await this.get(organizationId, packageId);
    if (evidencePackage.status !== 'DRAFT') {
      throw new ConflictException(
        'El paquete finalizado es inmutable; crea uno nuevo para regenerar.',
      );
    }
    return evidencePackage;
  }

  private async resolveCanonicalReference(
    organizationId: string,
    type: EvidencePackageItemType,
    sourceId: string,
    database: Prisma.TransactionClient = this.prisma,
  ): Promise<CanonicalReference> {
    switch (type) {
      case 'INSPECTION': {
        const value = await database.inspection.findFirst({
          where: { id: sourceId, organizationId },
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            workCenterId: true,
            riskMethodVersionId: true,
            inspectionBasisVersionId: true,
          },
        });
        if (!value) break;
        return this.reference(value.title, value.updatedAt.toISOString(), value, null);
      }
      case 'FINDING': {
        const value = await database.inspectionFinding.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, title: true, status: true, updatedAt: true, inspectionId: true },
        });
        if (!value) break;
        return this.reference(value.title, value.updatedAt.toISOString(), value, null);
      }
      case 'CORRECTIVE_ACTION': {
        const value = await database.correctiveAction.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, title: true, status: true, updatedAt: true, findingId: true },
        });
        if (!value) break;
        return this.reference(value.title, value.updatedAt.toISOString(), value, null);
      }
      case 'ACTION_EVIDENCE': {
        const value = await database.actionEvidence.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, type: true, createdAt: true, correctiveActionId: true },
        });
        if (!value) break;
        return this.reference(
          `Evidencia ${value.type}`,
          value.createdAt.toISOString(),
          value,
          null,
        );
      }
      case 'TECHNICAL_ASSESSMENT': {
        const value = await database.technicalAssessment.findFirst({
          where: { id: sourceId, organizationId },
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            methodKey: true,
            methodVersion: true,
          },
        });
        if (!value) break;
        return this.reference(value.title, value.updatedAt.toISOString(), value, null);
      }
      case 'INCIDENT': {
        const value = await database.incident.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, title: true, status: true, version: true, workCenterId: true },
        });
        if (!value) break;
        return this.reference(value.title, String(value.version), value, null);
      }
      case 'PPE_ISSUE': {
        const value = await database.ppeIssue.findFirst({
          where: { id: sourceId, organizationId },
          select: {
            id: true,
            status: true,
            version: true,
            workerId: true,
            ppeCatalogItem: { select: { name: true } },
          },
        });
        if (!value) break;
        return this.reference(value.ppeCatalogItem.name, String(value.version), value, null);
      }
      case 'TRAINING_COMPLETION': {
        const value = await database.workerTrainingCompletion.findFirst({
          where: { id: sourceId, organizationId },
          select: {
            id: true,
            completedAt: true,
            workerId: true,
            trainingDefinition: { select: { title: true } },
          },
        });
        if (!value) break;
        return this.reference(
          value.trainingDefinition.title,
          value.completedAt.toISOString(),
          value,
          null,
        );
      }
      case 'WORK_PERMIT': {
        const value = await database.workPermit.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, activity: true, status: true, version: true, workCenterId: true },
        });
        if (!value) break;
        return this.reference(value.activity, String(value.version), value, null);
      }
      case 'OBLIGATION_EXECUTION': {
        const value = await database.obligationExecution.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, title: true, status: true, version: true, originType: true },
        });
        if (!value) break;
        return this.reference(value.title, String(value.version), value, null);
      }
      case 'GOVERNANCE_MEETING': {
        const value = await database.governanceMeeting.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, title: true, status: true, updatedAt: true, bodyId: true },
        });
        if (!value) break;
        return this.reference(value.title, value.updatedAt.toISOString(), value, null);
      }
      case 'GOVERNANCE_DECISION': {
        const value = await database.governanceDecision.findFirst({
          where: { id: sourceId, organizationId },
          select: { id: true, summary: true, createdAt: true, meetingId: true },
        });
        if (!value) break;
        return this.reference(value.summary, value.createdAt.toISOString(), value, null);
      }
      case 'REGULATORY_UNIT': {
        const value = await database.regulatoryUnit.findUnique({
          where: { id: sourceId },
          select: {
            id: true,
            identifier: true,
            locator: true,
            reviewStatus: true,
            normalizedTextHash: true,
            sourceVersionId: true,
          },
        });
        if (!value) break;
        return this.reference(
          `${value.identifier} · ${value.locator}`,
          value.sourceVersionId,
          value,
          value.normalizedTextHash.replace(/^sha256:/, ''),
        );
      }
      case 'INSPECTION_BASIS_VERSION': {
        const value = await database.inspectionBasisVersion.findFirst({
          where: { id: sourceId, organizationId },
          select: {
            id: true,
            version: true,
            status: true,
            inspectionDomain: true,
            definitionId: true,
            contentDigest: true,
          },
        });
        if (!value) break;
        return this.reference(
          `Base ${value.inspectionDomain} v${value.version}`,
          String(value.version),
          value,
          value.contentDigest,
        );
      }
    }
    throw new BadRequestException('La referencia canónica no existe en la organización activa.');
  }

  private reference(
    label: string,
    sourceVersion: string | null,
    provenance: unknown,
    contentDigest: string | null,
  ): CanonicalReference {
    return {
      label: label.slice(0, 500),
      sourceVersion,
      provenance: JSON.parse(JSON.stringify(provenance)) as Prisma.InputJsonValue,
      contentDigest,
    };
  }

  private options(values: Array<{ id: string; title: string; status: string }>) {
    return values.map(({ id, title, status }) => ({ id, label: title, detail: status }));
  }

  private catalog(
    items: CanonicalReferenceOption[],
    total: number,
    query: EvidenceReferenceQueryDto,
  ): CanonicalReferenceCatalog {
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  private async requireReferenceEntitlements(
    organizationId: string,
    types: readonly EvidencePackageItemType[],
  ) {
    const features = new Set<string>();
    for (const type of types) {
      const feature = EVIDENCE_REFERENCE_ENTITLEMENTS[type];
      if (feature) features.add(feature);
    }
    await Promise.all(
      [...features].map((feature) => this.entitlements.require(organizationId, feature)),
    );
  }

  private isUnique(error: unknown) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
  }

  private isSerializationConflict(error: unknown) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2034');
  }

  private record(
    organizationId: string,
    userId: string,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
    context: Context,
  ) {
    return this.audit.record({
      organizationId,
      actorUserId: userId,
      action,
      entityType: 'EvidencePackage',
      entityId,
      metadata,
      ...context,
    });
  }
}
