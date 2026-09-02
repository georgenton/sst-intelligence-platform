import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type InspectionDomain, Prisma } from '@prisma/client';
import {
  adaptiveContentHash,
  inspectionBasisCompositionSchema,
  type InspectionBasisComposition,
} from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateInspectionBasisDto,
  InspectionBasisCompositionDto,
  SearchRegulatoryUnitsDto,
} from './dto';

const basisInclude = {
  definition: true,
  createdBy: { select: { id: true, displayName: true } },
  technicalSources: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      standardVersion: {
        include: {
          source: true,
          sections: {
            orderBy: { displayOrder: 'asc' as const },
            include: { criteria: { orderBy: { displayOrder: 'asc' as const } } },
          },
          criteria: { orderBy: { displayOrder: 'asc' as const } },
        },
      },
    },
  },
  regulatoryUnits: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      regulatoryUnit: {
        include: {
          sourceVersion: { include: { source: true } },
        },
      },
    },
  },
  criterionRegulatoryLinks: {
    include: {
      criterion: { include: { standardVersion: { include: { source: true } } } },
      regulatoryUnit: { include: { sourceVersion: { include: { source: true } } } },
    },
  },
} as const;

@Injectable()
export class InspectionBasisService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.inspectionBasisDefinition.findMany({
      where: { organizationId },
      orderBy: [{ inspectionDomain: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, displayName: true } },
        versions: { orderBy: { version: 'desc' }, include: basisInclude },
      },
    });
  }

  async getVersion(organizationId: string, versionId: string) {
    const version = await this.prisma.inspectionBasisVersion.findFirst({
      where: { id: versionId, organizationId },
      include: basisInclude,
    });
    if (!version) throw new NotFoundException('Versión de base de inspección no encontrada.');
    return this.present(version);
  }

  async active(organizationId: string, inspectionDomain: InspectionDomain) {
    const version = await this.resolveActive(organizationId, inspectionDomain);
    if (!version) {
      throw new NotFoundException('No existe una base de inspección activa para este dominio.');
    }
    return this.present(version);
  }

  async activeOrNull(organizationId: string, inspectionDomain: InspectionDomain) {
    const version = await this.resolveActive(organizationId, inspectionDomain);
    return version ? this.present(version) : null;
  }

  async createDefinition(organizationId: string, userId: string, input: CreateInspectionBasisDto) {
    const composition = await this.validateComposition(
      organizationId,
      input.inspectionDomain,
      input,
    );
    try {
      const versionId = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
          const definition = await tx.inspectionBasisDefinition.create({
            data: {
              organizationId,
              inspectionDomain: input.inspectionDomain,
              name: input.name.trim(),
              createdById: userId,
            },
          });
          return this.createVersionRecord(
            tx,
            definition.id,
            organizationId,
            input.inspectionDomain,
            userId,
            1,
            composition,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getVersion(organizationId, versionId);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async createVersion(
    organizationId: string,
    definitionId: string,
    userId: string,
    input: InspectionBasisCompositionDto,
  ) {
    const definition = await this.prisma.inspectionBasisDefinition.findFirst({
      where: { id: definitionId, organizationId },
    });
    if (!definition) throw new NotFoundException('Base de inspección no encontrada.');
    const composition = await this.validateComposition(
      organizationId,
      definition.inspectionDomain,
      input,
    );
    const versionId = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM "InspectionBasisDefinition" WHERE id = ${definitionId}::uuid FOR UPDATE`;
        const current = await tx.inspectionBasisVersion.findFirst({
          where: { definitionId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        return this.createVersionRecord(
          tx,
          definitionId,
          organizationId,
          definition.inspectionDomain,
          userId,
          (current?.version ?? 0) + 1,
          composition,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.getVersion(organizationId, versionId);
  }

  async activate(organizationId: string, versionId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
        const version = await tx.inspectionBasisVersion.findFirst({
          where: { id: versionId, organizationId },
          include: { technicalSources: true },
        });
        if (!version) throw new NotFoundException('Versión de base de inspección no encontrada.');
        if (version.status !== 'DRAFT') {
          throw new BadRequestException('Solo una versión en borrador puede activarse.');
        }
        if (
          version.technicalSources.filter(({ role }) => role === 'PRIMARY_TECHNICAL').length !== 1
        ) {
          throw new BadRequestException(
            'La base requiere exactamente una fuente técnica principal.',
          );
        }
        const now = new Date();
        await tx.inspectionBasisVersion.updateMany({
          where: {
            organizationId,
            inspectionDomain: version.inspectionDomain,
            status: 'ACTIVE',
          },
          data: { status: 'RETIRED', retiredAt: now },
        });
        await tx.inspectionBasisDefinition.updateMany({
          where: { organizationId, inspectionDomain: version.inspectionDomain, status: 'ACTIVE' },
          data: { status: 'RETIRED' },
        });
        await tx.inspectionBasisVersion.update({
          where: { id: versionId },
          data: { status: 'ACTIVE', activatedAt: now },
        });
        await tx.inspectionBasisDefinition.update({
          where: { id: version.definitionId },
          data: { status: 'ACTIVE' },
        });
      },
      {
        // The organization row is the activation mutex. READ COMMITTED lets a concurrent waiter
        // observe the winner after acquiring that lock instead of failing on a stale serializable
        // snapshot; the partial unique index remains the final database invariant.
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
    return this.getVersion(organizationId, versionId);
  }

  async retire(organizationId: string, versionId: string) {
    const version = await this.prisma.inspectionBasisVersion.findFirst({
      where: { id: versionId, organizationId },
    });
    if (!version) throw new NotFoundException('Versión de base de inspección no encontrada.');
    if (version.status === 'RETIRED') return this.getVersion(organizationId, versionId);
    await this.prisma.inspectionBasisVersion.update({
      where: { id: versionId },
      data: { status: 'RETIRED', retiredAt: new Date() },
    });
    return this.getVersion(organizationId, versionId);
  }

  async searchRegulatoryUnits(input: SearchRegulatoryUnitsDto) {
    const q = input.q?.trim();
    return this.prisma.regulatoryUnit.findMany({
      where: q
        ? {
            OR: [
              { identifier: { contains: q, mode: 'insensitive' } },
              { heading: { contains: q, mode: 'insensitive' } },
              { locator: { contains: q, mode: 'insensitive' } },
              {
                sourceVersion: {
                  source: { canonicalTitle: { contains: q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : undefined,
      take: input.take,
      orderBy: [{ sourceVersion: { source: { canonicalTitle: 'asc' } } }, { ordinal: 'asc' }],
      select: {
        id: true,
        unitType: true,
        identifier: true,
        heading: true,
        locator: true,
        reviewStatus: true,
        sourceVersion: {
          select: {
            catalogVersion: true,
            officialUrl: true,
            source: {
              select: {
                sourceKey: true,
                countryCode: true,
                issuer: true,
                canonicalTitle: true,
              },
            },
          },
        },
      },
    });
  }

  async resolveActive(organizationId: string, inspectionDomain: InspectionDomain) {
    const version = await this.prisma.inspectionBasisVersion.findFirst({
      where: { organizationId, inspectionDomain, status: 'ACTIVE' },
      include: basisInclude,
    });
    if (!version) return null;
    return version;
  }

  snapshot(version: NonNullable<Awaited<ReturnType<InspectionBasisService['resolveActive']>>>) {
    return {
      id: version.id,
      definition: { id: version.definition.id, name: version.definition.name },
      domain: version.inspectionDomain,
      version: version.version,
      contentDigest: version.contentDigest,
      technicalSources: version.technicalSources.map(({ role, standardVersion }) => ({
        role,
        source: {
          code: standardVersion.source.code,
          name: standardVersion.source.name,
          jurisdiction: standardVersion.source.originCountry,
        },
        version: {
          id: standardVersion.id,
          code: standardVersion.versionCode,
          edition: standardVersion.editionLabel,
          digest: standardVersion.contentDigest,
        },
      })),
      regulatoryUnits: version.regulatoryUnits.map(({ regulatoryUnit }) => ({
        id: regulatoryUnit.id,
        identifier: regulatoryUnit.identifier,
        locator: regulatoryUnit.locator,
        sourceKey: regulatoryUnit.sourceVersion.source.sourceKey,
        jurisdiction: regulatoryUnit.sourceVersion.source.countryCode,
      })),
      semanticBoundary: 'INSPECTION_BASIS_NOT_LAW_OR_RISK_METHOD_OR_PROTOCOL',
    };
  }

  private async validateComposition(
    organizationId: string,
    inspectionDomain: InspectionDomain,
    raw: InspectionBasisCompositionDto,
  ) {
    const parsed = inspectionBasisCompositionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_INSPECTION_BASIS',
        message: parsed.error.issues[0]?.message ?? 'La base de inspección no es válida.',
      });
    }
    const input = parsed.data;
    const standardIds = input.technicalSources.map(({ standardVersionId }) => standardVersionId);
    const standards = await this.prisma.inspectionStandardVersion.findMany({
      where: {
        id: { in: standardIds },
        status: 'AVAILABLE',
        source: { OR: [{ organizationId: null }, { organizationId }], status: 'ACTIVE' },
      },
      include: { source: true, criteria: { select: { id: true } } },
    });
    if (standards.length !== standardIds.length) {
      throw new BadRequestException('Una fuente técnica no está disponible para la organización.');
    }
    const standardById = new Map(standards.map((standard) => [standard.id, standard]));
    for (const link of input.technicalSources) {
      const standard = standardById.get(link.standardVersionId)!;
      if (this.metadataDomain(standard.metadata) !== inspectionDomain) {
        throw new BadRequestException('Una fuente técnica no corresponde al dominio seleccionado.');
      }
      if (
        link.role === 'INTERNAL_ORGANIZATION' &&
        (standard.source.sourceType !== 'ORGANIZATION_AUTHORED' ||
          standard.source.organizationId !== organizationId)
      ) {
        throw new BadRequestException(
          'Una fuente interna debe pertenecer a la organización activa.',
        );
      }
    }
    const unitIds = input.regulatoryUnits.map(({ regulatoryUnitId }) => regulatoryUnitId);
    const unitCount = await this.prisma.regulatoryUnit.count({ where: { id: { in: unitIds } } });
    if (unitCount !== unitIds.length) {
      throw new BadRequestException('Una unidad regulatoria seleccionada no existe.');
    }
    const criterionIds = new Set(standards.flatMap(({ criteria }) => criteria.map(({ id }) => id)));
    if (input.criterionRegulatoryLinks.some(({ criterionId }) => !criterionIds.has(criterionId))) {
      throw new BadRequestException(
        'La procedencia de criterio debe pertenecer a una fuente técnica seleccionada.',
      );
    }
    return {
      ...input,
      reason: input.reason?.trim(),
      technicalSources: [...input.technicalSources].sort((a, b) => a.displayOrder - b.displayOrder),
      regulatoryUnits: [...input.regulatoryUnits].sort((a, b) => a.displayOrder - b.displayOrder),
    } satisfies InspectionBasisComposition;
  }

  private createVersionRecord(
    tx: Prisma.TransactionClient,
    definitionId: string,
    organizationId: string,
    inspectionDomain: InspectionDomain,
    userId: string,
    version: number,
    composition: InspectionBasisComposition,
  ) {
    const manifest = { definitionId, version, ...composition };
    return tx.inspectionBasisVersion
      .create({
        data: {
          definitionId,
          organizationId,
          inspectionDomain,
          version,
          reason: composition.reason,
          contentDigest: adaptiveContentHash(manifest),
          createdById: userId,
          technicalSources: { create: composition.technicalSources },
          regulatoryUnits: { create: composition.regulatoryUnits },
          criterionRegulatoryLinks: { create: composition.criterionRegulatoryLinks },
        },
        select: { id: true },
      })
      .then(({ id }) => id);
  }

  private metadataDomain(metadata: Prisma.JsonValue): InspectionDomain | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const domain = (metadata as Record<string, unknown>).domain;
    return typeof domain === 'string' ? (domain as InspectionDomain) : null;
  }

  private present<T>(version: T) {
    return {
      ...version,
      semanticBoundary: 'INSPECTION_BASIS_NOT_LAW_OR_RISK_METHOD_OR_PROTOCOL' as const,
    };
  }

  private rethrowConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ya existe una base con ese nombre para el dominio.');
    }
    throw error;
  }
}
