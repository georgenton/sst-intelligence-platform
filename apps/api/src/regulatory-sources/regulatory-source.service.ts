import { Injectable, NotFoundException } from '@nestjs/common';
import type { RegulatoryCandidateStatus, RegulatoryDocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const sourceIdentitySelect = {
  sourceKey: true,
  countryCode: true,
  issuer: true,
  documentType: true,
  referenceNumber: true,
  canonicalTitle: true,
} as const;

const versionSelect = {
  catalogVersion: true,
  candidateStatus: true,
  officialDocumentLocated: true,
  officialUrl: true,
  officialDocumentSha256: true,
  officialDocumentRetrievedAt: true,
  officialDocumentMediaType: true,
  officialPublicationReference: true,
  publicationDate: true,
  effectiveFrom: true,
  effectiveTo: true,
  supersessionStatus: true,
  readyForExtraction: true,
  readyForRules: true,
  reviewNotes: true,
  recordedAt: true,
} as const;

const sourceVersionReferenceSelect = {
  catalogVersion: true,
  candidateStatus: true,
  recordedAt: true,
} as const;

const provisionSelect = {
  id: true,
  sourceVersionId: true,
  provisionKey: true,
  locatorType: true,
  locatorLabel: true,
  heading: true,
  summary: true,
  editorialStatus: true,
  supersedesProvisionId: true,
  createdAt: true,
} as const;

const requirementSelect = {
  id: true,
  requirementKey: true,
  title: true,
  description: true,
  editorialStatus: true,
  scopeHint: true,
  supersedesRequirementId: true,
  createdAt: true,
} as const;

@Injectable()
export class RegulatorySourceService {
  constructor(private readonly prisma: PrismaService) {}

  async listSources(filters: {
    issuer?: string;
    documentType?: RegulatoryDocumentType;
    candidateStatus?: RegulatoryCandidateStatus;
  }) {
    const sources = await this.prisma.regulatorySource.findMany({
      where: {
        ...(filters.issuer
          ? { issuer: { contains: filters.issuer.trim(), mode: 'insensitive' as const } }
          : {}),
        ...(filters.documentType ? { documentType: filters.documentType } : {}),
      },
      select: {
        ...sourceIdentitySelect,
        versions: {
          select: versionSelect,
          orderBy: { catalogVersion: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ issuer: 'asc' }, { canonicalTitle: 'asc' }],
    });

    return sources
      .map(({ versions, ...source }) => {
        const latest = versions[0];
        if (!latest) return null;
        return {
          ...source,
          latestCatalogVersion: latest.catalogVersion,
          candidateStatus: latest.candidateStatus,
          officialDocumentLocated: latest.officialDocumentLocated,
          readyForExtraction: latest.readyForExtraction,
          readyForRules: latest.readyForRules,
          supersessionStatus: latest.supersessionStatus,
        };
      })
      .filter((source) => source !== null)
      .filter(
        (source) => !filters.candidateStatus || source.candidateStatus === filters.candidateStatus,
      );
  }

  async getSource(sourceKey: string) {
    const source = await this.prisma.regulatorySource.findUnique({
      where: { sourceKey },
      select: {
        ...sourceIdentitySelect,
        versions: {
          select: versionSelect,
          orderBy: { catalogVersion: 'desc' },
          take: 1,
        },
      },
    });
    const latestVersion = source?.versions[0];
    if (!source || !latestVersion) throw new NotFoundException('Fuente candidata no encontrada.');
    return {
      source: {
        sourceKey: source.sourceKey,
        countryCode: source.countryCode,
        issuer: source.issuer,
        documentType: source.documentType,
        referenceNumber: source.referenceNumber,
        canonicalTitle: source.canonicalTitle,
      },
      latestVersion,
      metadataBoundary: 'CATALOG_METADATA_NOT_LEGAL_INTERPRETATION' as const,
    };
  }

  async getVersions(sourceKey: string) {
    const source = await this.requireSource(sourceKey);
    return this.prisma.regulatorySourceVersion.findMany({
      where: { sourceId: source.id },
      select: versionSelect,
      orderBy: { catalogVersion: 'desc' },
    });
  }

  async getRelationships(sourceKey: string) {
    const source = await this.requireSource(sourceKey);
    return this.prisma.regulatorySourceRelationship.findMany({
      where: { OR: [{ fromSourceId: source.id }, { toSourceId: source.id }] },
      select: {
        relationshipType: true,
        reviewStatus: true,
        notes: true,
        createdAt: true,
        fromSource: { select: sourceIdentitySelect },
        toSource: { select: sourceIdentitySelect },
      },
      orderBy: [{ reviewStatus: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getProvisions(sourceKey: string) {
    const source = await this.requireSource(sourceKey);
    const provisions = await this.prisma.regulatoryProvision.findMany({
      where: { sourceVersion: { sourceId: source.id } },
      select: {
        ...provisionSelect,
        sourceVersion: { select: sourceVersionReferenceSelect },
        requirementSources: {
          select: {
            relationshipType: true,
            requirement: { select: requirementSelect },
          },
          orderBy: [{ relationshipType: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [
        { sourceVersion: { catalogVersion: 'desc' } },
        { locatorLabel: 'asc' },
        { provisionKey: 'asc' },
      ],
    });

    return provisions.map(({ sourceVersion, requirementSources, ...provision }) => ({
      provision,
      sourceVersion,
      requirements: requirementSources,
    }));
  }

  async getProvision(provisionId: string) {
    const row = await this.prisma.regulatoryProvision.findUnique({
      where: { id: provisionId },
      select: {
        ...provisionSelect,
        sourceVersion: {
          select: {
            ...sourceVersionReferenceSelect,
            source: { select: sourceIdentitySelect },
          },
        },
        requirementSources: {
          select: {
            relationshipType: true,
            requirement: { select: requirementSelect },
          },
          orderBy: [{ relationshipType: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!row) throw new NotFoundException('Disposición estructurada no encontrada.');
    const { sourceVersion, requirementSources, ...provision } = row;
    const { source, ...version } = sourceVersion;
    return {
      provision,
      sourceVersion: version,
      source,
      requirements: requirementSources,
      semanticBoundary: 'EDITORIAL_LOCATOR_NOT_AUTHORITATIVE_LEGAL_TEXT' as const,
    };
  }

  async listRequirements() {
    const rows = await this.prisma.regulatoryRequirement.findMany({
      select: {
        ...requirementSelect,
        _count: { select: { sources: true } },
      },
      orderBy: [{ title: 'asc' }, { requirementKey: 'asc' }],
    });
    return rows.map(({ _count, ...requirement }) => ({
      ...requirement,
      provenanceCount: _count.sources,
    }));
  }

  async getRequirement(requirementKey: string) {
    const row = await this.prisma.regulatoryRequirement.findUnique({
      where: { requirementKey },
      select: {
        ...requirementSelect,
        sources: {
          select: {
            relationshipType: true,
            provision: {
              select: {
                ...provisionSelect,
                sourceVersion: {
                  select: {
                    ...sourceVersionReferenceSelect,
                    source: { select: sourceIdentitySelect },
                  },
                },
              },
            },
          },
          orderBy: [{ relationshipType: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!row) throw new NotFoundException('Requisito estructurado no encontrado.');
    const { sources, ...requirement } = row;
    return {
      requirement,
      provenance: sources.map(({ relationshipType, provision }) => {
        const { sourceVersion, ...provisionRecord } = provision;
        const { source, ...version } = sourceVersion;
        return {
          relationshipType,
          provision: provisionRecord,
          sourceVersion: version,
          source,
        };
      }),
      semanticBoundary: 'STRUCTURED_CANDIDATE_NOT_APPLICABILITY_DECISION' as const,
    };
  }

  private async requireSource(sourceKey: string) {
    const source = await this.prisma.regulatorySource.findUnique({
      where: { sourceKey },
      select: { id: true },
    });
    if (!source) throw new NotFoundException('Fuente candidata no encontrada.');
    return source;
  }
}
