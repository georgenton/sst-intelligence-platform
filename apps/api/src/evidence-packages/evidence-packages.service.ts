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
import { PrismaService } from '../prisma/prisma.service';
import type { AddEvidencePackageItemDto, CreateEvidencePackageDto } from './dto';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;
type CanonicalReference = {
  label: string;
  sourceVersion: string | null;
  provenance: Prisma.InputJsonValue;
  contentDigest: string | null;
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
  ) {}

  list(organizationId: string) {
    return this.prisma.evidencePackage.findMany({
      where: { organizationId },
      include: packageInclude,
      orderBy: { createdAt: 'desc' },
    });
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
          value.normalizedTextHash,
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
