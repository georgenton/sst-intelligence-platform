import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validateInspectionDraftProposal } from '@sst/contracts';
import { AuditService, type AuditEvent } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateInspectionDraftProposalDto,
  InspectionResourceQueryDto,
  ReviewInspectionDraftProposalDto,
} from './dto';
import { InspectionDraftingProvider } from './inspection-drafting.provider';

type Context = Pick<AuditEvent, 'requestId' | 'ip' | 'userAgent'>;

@Injectable()
export class InspectionResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drafting: InspectionDraftingProvider,
    private readonly audit: AuditService,
  ) {}

  async catalog(organizationId: string, query: InspectionResourceQueryDto) {
    const include = {
      taxonomy: true,
      resources: { orderBy: { displayOrder: 'asc' as const } },
      mappingVersions: {
        where: {
          status: 'ACTIVE' as const,
          ...(query.standardVersionId ? { standardVersionId: query.standardVersionId } : {}),
          OR: [{ organizationId: null }, { organizationId }],
        },
        orderBy: { version: 'desc' as const },
        include: { mappings: { orderBy: { displayOrder: 'asc' as const } } },
      },
    };
    const find = (privateOrganizationId: string | null) =>
      this.prisma.inspectionResourceTaxonomyVersion.findFirst({
        where: {
          status: 'ACTIVE',
          taxonomy: {
            inspectionDomain: query.domain,
            organizationId: privateOrganizationId,
          },
        },
        orderBy: { version: 'desc' },
        include,
      });
    const version = (await find(organizationId)) ?? (await find(null));
    if (!version) return null;
    version.mappingVersions.sort(
      (left, right) =>
        Number(right.organizationId === organizationId) -
          Number(left.organizationId === organizationId) || right.version - left.version,
    );
    return version;
  }

  async resolveForInspection(
    organizationId: string,
    domain: string,
    resourceId: string | undefined,
    standardVersionId: string | undefined,
  ) {
    const catalog = await this.catalog(organizationId, {
      domain: domain as InspectionResourceQueryDto['domain'],
      standardVersionId,
    });
    if (!catalog) return null;
    // Omitting resourceId is the explicit legacy API path. The V0 workspace sends a
    // resource for new scoped inspections; historical clients remain snapshot-free.
    if (!resourceId) return null;
    const resource = catalog.resources.find(({ id }) => id === resourceId);
    if (!resource) {
      throw new BadRequestException({
        code: 'INSPECTION_RESOURCE_NOT_AVAILABLE',
        message: 'El recurso no pertenece al alcance activo de este dominio.',
      });
    }
    const mappingVersion = catalog.mappingVersions[0];
    if (!standardVersionId || !mappingVersion) {
      throw new BadRequestException({
        code: 'INSPECTION_RESOURCE_MAPPING_REQUIRED',
        message:
          'El recurso está configurado, pero no existe un mapping activo para la base técnica seleccionada. Revisa Alcance de recursos.',
      });
    }
    const mapped = mappingVersion.mappings.filter((mapping) => mapping.resourceId === resource.id);
    if (!mapped.length) {
      throw new BadRequestException({
        code: 'INSPECTION_RESOURCE_CRITERIA_REQUIRED',
        message:
          'El recurso seleccionado todavía no tiene criterios mapeados. Revisa Alcance de recursos.',
      });
    }
    const criterionIds = mapped
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map(({ criterionId }) => criterionId);
    return {
      taxonomyVersion: catalog,
      resource,
      mappingVersion,
      criterionIds,
      snapshot: {
        inspectionDomain: catalog.taxonomy.inspectionDomain,
        taxonomy: {
          id: catalog.taxonomy.id,
          code: catalog.taxonomy.code,
          name: catalog.taxonomy.name,
          versionId: catalog.id,
          version: catalog.version,
          contentDigest: catalog.contentDigest,
        },
        resource: {
          id: resource.id,
          code: resource.code,
          name: resource.name,
          level: resource.level,
        },
        mapping: {
          id: mappingVersion.id,
          version: mappingVersion.version,
          contentDigest: mappingVersion.contentDigest,
          standardVersionId: mappingVersion.standardVersionId,
          criterionIds,
        },
      },
    };
  }

  listProposals(organizationId: string) {
    return this.prisma.inspectionDraftProposal.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        resource: { select: { id: true, code: true, name: true, level: true } },
        createdBy: { select: { id: true, displayName: true } },
        reviewedBy: { select: { id: true, displayName: true } },
      },
    });
  }

  async createProposal(
    organizationId: string,
    userId: string,
    input: CreateInspectionDraftProposalDto,
    context: Context,
  ) {
    const resource = await this.requireResource(organizationId, input.resourceId);
    const keywords = [...new Set([resource.name, ...input.keywords].map((value) => value.trim()))]
      .filter(Boolean)
      .slice(0, 8);
    const units = await this.prisma.regulatoryUnit.findMany({
      where: {
        reviewStatus: 'VERIFIED',
        sourceVersion: {
          artifactVerificationStatus: 'OFFICIAL_ARTIFACT_VERIFIED',
          source: { countryCode: 'EC' },
        },
        OR: keywords.flatMap((keyword) => [
          { heading: { contains: keyword, mode: 'insensitive' as const } },
          { officialText: { contains: keyword, mode: 'insensitive' as const } },
        ]),
      },
      select: {
        id: true,
        identifier: true,
        locator: true,
        heading: true,
        sourceVersionId: true,
        sourceVersion: { select: { sourceId: true } },
      },
      orderBy: [{ sourceVersionId: 'asc' }, { ordinal: 'asc' }],
      take: 12,
    });
    if (!units.length) {
      throw new ServiceUnavailableException({
        code: 'INSPECTION_DRAFTING_NO_OFFICIAL_CONTEXT',
        message: 'No hay unidades oficiales verificadas y acotadas para preparar este borrador.',
      });
    }
    const response = await this.drafting.propose({
      organizationId,
      userId,
      resource,
      units: units.map((unit) => ({
        id: unit.id,
        sourceId: unit.sourceVersion.sourceId,
        sourceVersionId: unit.sourceVersionId,
        identifier: unit.identifier,
        locator: unit.locator,
        heading: unit.heading,
      })),
    });
    const output = validateInspectionDraftProposal({
      output: response.output,
      expectedJurisdictionCode: 'EC',
      expectedResourceId: resource.id,
      allowedUnits: new Map(
        units.map((unit) => [
          unit.id,
          {
            locator: unit.locator,
            sourceId: unit.sourceVersion.sourceId,
            sourceVersionId: unit.sourceVersionId,
          },
        ]),
      ),
    });
    const proposal = await this.prisma.inspectionDraftProposal.create({
      data: {
        organizationId,
        resourceId: resource.id,
        provider: response.provider,
        model: response.model,
        jurisdictionCode: 'EC',
        sourceUnitIds: units.map(({ id }) => id),
        proposedCriteria: output.criteria as Prisma.InputJsonValue,
        validationSnapshot: {
          schema: 'INSPECTION_EDITORIAL_PROPOSAL_V1',
          citationValidation: 'PASS',
          allowedUnitCount: units.length,
          activationAllowed: false,
        },
        createdById: userId,
      },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'INSPECTION_EDITORIAL_PROPOSAL_CREATED',
      entityType: 'InspectionDraftProposal',
      entityId: proposal.id,
      metadata: {
        provider: response.provider,
        model: response.model,
        resourceId: resource.id,
        sourceUnitCount: units.length,
        citationValidation: 'PASS',
      },
      ...context,
    });
    return proposal;
  }

  async submit(organizationId: string, proposalId: string, userId: string, context: Context) {
    const result = await this.prisma.inspectionDraftProposal.updateMany({
      where: { id: proposalId, organizationId, status: 'AI_PROPOSED' },
      data: { status: 'PENDING_EXPERT_REVIEW', submittedAt: new Date() },
    });
    if (result.count !== 1)
      throw new BadRequestException('La propuesta no puede enviarse a revisión.');
    await this.recordReviewEvent(
      organizationId,
      userId,
      proposalId,
      'INSPECTION_EDITORIAL_PROPOSAL_SUBMITTED',
      context,
    );
    return this.requireProposal(organizationId, proposalId);
  }

  async review(
    organizationId: string,
    proposalId: string,
    userId: string,
    input: ReviewInspectionDraftProposalDto,
    context: Context,
  ) {
    if (!['APPROVED', 'REJECTED'].includes(input.decision))
      throw new BadRequestException('La decisión editorial no es válida.');
    const result = await this.prisma.inspectionDraftProposal.updateMany({
      where: { id: proposalId, organizationId, status: 'PENDING_EXPERT_REVIEW' },
      data: {
        status: input.decision,
        reviewedById: userId,
        reviewComment: input.comment,
        reviewedAt: new Date(),
      },
    });
    if (result.count !== 1)
      throw new BadRequestException('La propuesta no está pendiente de revisión.');
    await this.recordReviewEvent(
      organizationId,
      userId,
      proposalId,
      'INSPECTION_EDITORIAL_PROPOSAL_REVIEWED',
      context,
      input.decision,
    );
    return this.requireProposal(organizationId, proposalId);
  }

  private async requireResource(organizationId: string, resourceId: string) {
    const resource = await this.prisma.inspectionResource.findFirst({
      where: {
        id: resourceId,
        taxonomyVersion: {
          status: 'ACTIVE',
          taxonomy: { OR: [{ organizationId: null }, { organizationId }] },
        },
      },
      select: { id: true, name: true, level: true },
    });
    if (!resource) throw new NotFoundException('Recurso de inspección no encontrado.');
    return resource;
  }

  private async requireProposal(organizationId: string, proposalId: string) {
    const proposal = await this.prisma.inspectionDraftProposal.findFirst({
      where: { id: proposalId, organizationId },
    });
    if (!proposal) throw new NotFoundException('Propuesta editorial no encontrada.');
    return proposal;
  }

  private recordReviewEvent(
    organizationId: string,
    actorUserId: string,
    proposalId: string,
    action: string,
    context: Context,
    decision?: string,
  ) {
    return this.audit.record({
      organizationId,
      actorUserId,
      action,
      entityType: 'InspectionDraftProposal',
      entityId: proposalId,
      metadata: decision ? { decision, runtimePublication: false } : { runtimePublication: false },
      ...context,
    });
  }
}
