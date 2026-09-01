import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InspectionDomain } from '@prisma/client';
import {
  adaptiveContentHash,
  inspectionStandardPolicyInputSchema,
  nextInspectionStandardPolicyVersion,
} from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateOrganizationInspectionStandardDto,
  SaveInspectionStandardPolicyDto,
} from './dto';

const standardInclude = {
  source: {
    select: {
      id: true,
      organizationId: true,
      code: true,
      name: true,
      publisher: true,
      originCountry: true,
      referenceUrl: true,
      rightsType: true,
      sourceType: true,
      status: true,
    },
  },
  sections: {
    orderBy: { displayOrder: 'asc' as const },
    include: { criteria: { orderBy: { displayOrder: 'asc' as const } } },
  },
  criteria: { orderBy: { displayOrder: 'asc' as const } },
} as const;

@Injectable()
export class InspectionStandardsService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(organizationId: string) {
    const versions = await this.prisma.inspectionStandardVersion.findMany({
      where: {
        status: { in: ['AVAILABLE', 'RETIRED'] },
        source: {
          OR: [{ organizationId: null }, { organizationId }],
          status: { in: ['ACTIVE', 'RETIRED'] },
        },
      },
      include: standardInclude,
      orderBy: [{ source: { name: 'asc' } }, { versionCode: 'desc' }],
    });
    return versions.map((version) => ({
      ...version,
      inspectionDomain: this.metadataDomain(version.metadata),
      responsibilityNotice:
        version.source.organizationId &&
        ['CUSTOMER_PROVIDED', 'LICENSED'].includes(version.source.rightsType)
          ? 'La organización es responsable de contar con autorización para usar este contenido.'
          : null,
    }));
  }

  async source(organizationId: string, sourceId: string) {
    const source = await this.prisma.inspectionStandardSource.findFirst({
      where: { id: sourceId, OR: [{ organizationId: null }, { organizationId }] },
      include: { versions: { include: standardInclude, orderBy: { createdAt: 'desc' } } },
    });
    if (!source) throw new NotFoundException('Estándar de inspección no encontrado.');
    return source;
  }

  async policy(organizationId: string) {
    const versions = await this.prisma.organizationInspectionStandardPolicyVersion.findMany({
      where: { organizationId },
      orderBy: { version: 'desc' },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        bindings: {
          orderBy: { inspectionDomain: 'asc' },
          include: { standardVersion: { include: standardInclude } },
        },
      },
    });
    return { current: versions[0] ?? null, history: versions };
  }

  async savePolicy(
    organizationId: string,
    userId: string,
    rawInput: SaveInspectionStandardPolicyDto,
  ) {
    const input = inspectionStandardPolicyInputSchema.safeParse(rawInput);
    if (!input.success) {
      throw new BadRequestException({
        code: 'INVALID_INSPECTION_STANDARD_POLICY',
        message: input.error.issues[0]?.message ?? 'La política de estándares no es válida.',
      });
    }
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
        const versions = await tx.inspectionStandardVersion.findMany({
          where: {
            id: { in: input.data.bindings.map(({ standardVersionId }) => standardVersionId) },
            status: 'AVAILABLE',
            source: { OR: [{ organizationId: null }, { organizationId }], status: 'ACTIVE' },
          },
          select: { id: true, metadata: true },
        });
        if (versions.length !== input.data.bindings.length) {
          throw new BadRequestException({
            code: 'INSPECTION_STANDARD_NOT_AVAILABLE',
            message: 'Uno de los estándares no está disponible para la organización activa.',
          });
        }
        const byId = new Map(versions.map((version) => [version.id, version]));
        for (const binding of input.data.bindings) {
          if (
            this.metadataDomain(byId.get(binding.standardVersionId)!.metadata) !==
            binding.inspectionDomain
          ) {
            throw new BadRequestException({
              code: 'INSPECTION_STANDARD_DOMAIN_MISMATCH',
              message: 'El estándar seleccionado no corresponde al dominio de inspección.',
            });
          }
        }
        const current = await tx.organizationInspectionStandardPolicyVersion.findFirst({
          where: { organizationId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        return tx.organizationInspectionStandardPolicyVersion.create({
          data: {
            organizationId,
            version: nextInspectionStandardPolicyVersion(current?.version ?? null),
            createdById: userId,
            reason: input.data.reason,
            bindings: { create: input.data.bindings },
          },
          include: {
            createdBy: { select: { id: true, displayName: true } },
            bindings: { include: { standardVersion: { include: standardInclude } } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createOrganizationStandard(
    organizationId: string,
    input: CreateOrganizationInspectionStandardDto,
  ) {
    if (
      !['LICENSED', 'CUSTOMER_PROVIDED', 'INTERNAL_ORGANIZATION_STANDARD'].includes(
        input.rightsType,
      )
    ) {
      throw new BadRequestException({
        code: 'ORGANIZATION_STANDARD_RIGHTS_REQUIRED',
        message: 'Clasifica el contenido interno, proporcionado o licenciado antes de guardarlo.',
      });
    }
    const normalizedCode = input.code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, '_');
    const code = `ORG_${organizationId.slice(0, 8).toUpperCase()}_${normalizedCode}`;
    const manifest = {
      domain: input.inspectionDomain,
      versionCode: input.versionCode.trim(),
      editionLabel: input.editionLabel.trim(),
      sections: input.sections.map((section) => ({
        code: section.code.trim(),
        title: section.title.trim(),
        displayOrder: section.displayOrder,
        criteria: section.criteria.map((criterion) => ({
          ...criterion,
          code: criterion.code.trim(),
          title: criterion.title.trim(),
          guidance: criterion.guidance.trim(),
          evidenceExpectation: criterion.evidenceExpectation?.trim() ?? null,
        })),
      })),
    };
    const contentDigest = adaptiveContentHash(manifest);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const source = await tx.inspectionStandardSource.create({
          data: {
            organizationId,
            code,
            name: input.name.trim(),
            publisher: input.publisher.trim(),
            originCountry: input.originCountry?.trim(),
            referenceUrl: input.referenceUrl,
            rightsType: input.rightsType,
            sourceType: 'ORGANIZATION_AUTHORED',
            status: 'ACTIVE',
          },
        });
        const version = await tx.inspectionStandardVersion.create({
          data: {
            sourceId: source.id,
            versionCode: input.versionCode.trim(),
            editionLabel: input.editionLabel.trim(),
            status: 'AVAILABLE',
            contentDigest,
            metadata: { domain: input.inspectionDomain, organizationAuthored: true },
          },
        });
        for (const sectionInput of manifest.sections) {
          const section = await tx.inspectionStandardSection.create({
            data: {
              standardVersionId: version.id,
              code: sectionInput.code,
              title: sectionInput.title,
              displayOrder: sectionInput.displayOrder,
            },
          });
          await tx.inspectionStandardCriterion.createMany({
            data: sectionInput.criteria.map((criterion) => ({
              ...criterion,
              standardVersionId: version.id,
              sectionId: section.id,
              contentDigest: adaptiveContentHash(criterion),
            })),
          });
        }
        return tx.inspectionStandardVersion.findUniqueOrThrow({
          where: { id: version.id },
          include: standardInclude,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException({
          code: 'ORGANIZATION_STANDARD_CODE_EXISTS',
          message: 'Ya existe un estándar interno con ese código.',
        });
      }
      throw error;
    }
  }

  async resolveRequired(organizationId: string, inspectionDomain: InspectionDomain) {
    const policy = await this.prisma.organizationInspectionStandardPolicyVersion.findFirst({
      where: { organizationId },
      orderBy: { version: 'desc' },
      include: {
        bindings: {
          where: { inspectionDomain },
          include: { standardVersion: { include: standardInclude } },
        },
      },
    });
    const binding = policy?.bindings[0];
    if (!policy || !binding || binding.standardVersion.status !== 'AVAILABLE') {
      throw new BadRequestException({
        code: 'INSPECTION_STANDARD_CONFIGURATION_REQUIRED',
        message:
          'Configura el estándar de inspección para este dominio antes de iniciar esta inspección.',
      });
    }
    return { policy, binding, standardVersion: binding.standardVersion };
  }

  snapshot(
    version: Awaited<ReturnType<InspectionStandardsService['resolveRequired']>>['standardVersion'],
  ) {
    return {
      source: {
        code: version.source.code,
        name: version.source.name,
        publisher: version.source.publisher,
        rightsType: version.source.rightsType,
        sourceType: version.source.sourceType,
      },
      version: {
        versionCode: version.versionCode,
        editionLabel: version.editionLabel,
        contentDigest: version.contentDigest,
      },
      semanticBoundary: 'TECHNICAL_INSPECTION_BASIS_NOT_AUTOMATIC_LEGAL_REQUIREMENT',
    };
  }

  private metadataDomain(metadata: Prisma.JsonValue): InspectionDomain | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const domain = (metadata as Record<string, unknown>).domain;
    return typeof domain === 'string' ? (domain as InspectionDomain) : null;
  }
}
