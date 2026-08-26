import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  RegulatoryCandidateStatus,
  RegulatoryDocumentType,
  RegulatoryUnitType,
} from '@prisma/client';
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
  artifactVerificationStatus: true,
  textExtractionStatus: true,
  vigenciaReviewStatus: true,
  artifactPageCount: true,
  artifactVersionKey: true,
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

const unitSelect = {
  id: true,
  sourceVersionId: true,
  parentUnitId: true,
  unitType: true,
  identifier: true,
  heading: true,
  ordinal: true,
  officialText: true,
  editorialSummary: true,
  normalizedTextHash: true,
  pageStart: true,
  pageEnd: true,
  locator: true,
  extractionStatus: true,
  reviewStatus: true,
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
    q?: string;
    issuer?: string;
    documentType?: RegulatoryDocumentType;
    candidateStatus?: RegulatoryCandidateStatus;
  }) {
    const sources = await this.prisma.regulatorySource.findMany({
      where: {
        ...(filters.q
          ? {
              OR: [
                { canonicalTitle: { contains: filters.q.trim(), mode: 'insensitive' as const } },
                { referenceNumber: { contains: filters.q.trim(), mode: 'insensitive' as const } },
                { issuer: { contains: filters.q.trim(), mode: 'insensitive' as const } },
              ],
            }
          : {}),
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
          artifactVerificationStatus: latest.artifactVerificationStatus,
          textExtractionStatus: latest.textExtractionStatus,
          vigenciaReviewStatus: latest.vigenciaReviewStatus,
          articleCatalogAvailable: latest.textExtractionStatus === 'COMPLETE',
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
        units: { select: { unit: { select: unitSelect } }, orderBy: { unit: { ordinal: 'asc' } } },
      },
      orderBy: [
        { sourceVersion: { catalogVersion: 'desc' } },
        { locatorLabel: 'asc' },
        { provisionKey: 'asc' },
      ],
    });

    return provisions.map(({ sourceVersion, requirementSources, units, ...provision }) => ({
      provision,
      sourceVersion,
      requirements: requirementSources,
      units: units.map(({ unit }) => unit),
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
        units: { select: { unit: { select: unitSelect } }, orderBy: { unit: { ordinal: 'asc' } } },
      },
    });
    if (!row) throw new NotFoundException('Disposición estructurada no encontrada.');
    const { sourceVersion, requirementSources, units, ...provision } = row;
    const { source, ...version } = sourceVersion;
    return {
      provision,
      sourceVersion: version,
      source,
      requirements: requirementSources,
      units: units.map(({ unit }) => unit),
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
                units: {
                  select: { unit: { select: unitSelect } },
                  orderBy: { unit: { ordinal: 'asc' } },
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
        const { sourceVersion, units, ...provisionRecord } = provision;
        const { source, ...version } = sourceVersion;
        return {
          relationshipType,
          provision: provisionRecord,
          sourceVersion: version,
          source,
          units: units.map(({ unit }) => unit),
        };
      }),
      semanticBoundary: 'STRUCTURED_CANDIDATE_NOT_APPLICABILITY_DECISION' as const,
    };
  }

  async listUnits(sourceKey: string, filters: { q?: string; unitType?: RegulatoryUnitType }) {
    const source = await this.requireSource(sourceKey);
    const version = await this.prisma.regulatorySourceVersion.findFirst({
      where: { sourceId: source.id, textExtractionStatus: 'COMPLETE' },
      orderBy: { catalogVersion: 'desc' },
      select: {
        id: true,
        catalogVersion: true,
        artifactVerificationStatus: true,
        textExtractionStatus: true,
      },
    });
    if (!version)
      return {
        sourceKey,
        version: null,
        items: [],
        structuralBoundary: 'OFFICIAL_ARTIFACT_NOT_FULLY_STRUCTURED' as const,
      };
    const query = filters.q?.trim();
    const items = await this.prisma.regulatoryUnit.findMany({
      where: {
        sourceVersionId: version.id,
        ...(filters.unitType ? { unitType: filters.unitType } : {}),
        ...(query
          ? {
              OR: [
                { identifier: { contains: query, mode: 'insensitive' as const } },
                { heading: { contains: query, mode: 'insensitive' as const } },
                { locator: { contains: query, mode: 'insensitive' as const } },
                { officialText: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: unitSelect,
      orderBy: { ordinal: 'asc' },
      take: query ? 100 : 1_500,
    });
    return {
      sourceKey,
      version,
      items,
      structuralBoundary: 'STRUCTURAL_COVERAGE_NOT_LEGAL_COMPLETENESS_SCORE' as const,
    };
  }

  async getUnit(unitId: string) {
    const unit = await this.prisma.regulatoryUnit.findUnique({
      where: { id: unitId },
      select: {
        ...unitSelect,
        sourceVersion: { select: { ...versionSelect, source: { select: sourceIdentitySelect } } },
        provisions: {
          select: {
            provision: {
              select: {
                ...provisionSelect,
                requirementSources: {
                  select: { relationshipType: true, requirement: { select: requirementSelect } },
                },
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unidad regulatoria no encontrada.');
    const { sourceVersion, provisions, ...record } = unit;
    const { source, ...version } = sourceVersion;
    return {
      unit: record,
      source,
      sourceVersion: version,
      interpretations: provisions.map(({ provision }) => provision),
      textBoundary: 'OFFICIAL_TEXT_SEPARATE_FROM_PLATFORM_INTERPRETATION' as const,
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
