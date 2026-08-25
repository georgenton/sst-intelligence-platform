import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, RiskMethodVersion } from '@prisma/client';
import {
  GTC45_CONSEQUENCE_OPTIONS,
  GTC45_DEFICIENCY_OPTIONS,
  GTC45_EXPOSURE_OPTIONS,
  GUIDED_5X5_HUMAN_SEVERITY_CRITERIA,
  GUIDED_5X5_PROBABILITY_CRITERIA,
} from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { riskMethodProvider } from './risk-method-provider.registry';

type JsonRecord = Record<string, unknown>;

export type PersistableRiskCalculation = {
  input: JsonRecord;
  result: JsonRecord;
  explanation: { heading: string; summary: string; methodDisclosure: string };
  likelihood: number | null;
  consequence: number | null;
  score: number | null;
  semanticLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  resultLabel: string;
};

@Injectable()
export class RiskMethodologyService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog() {
    const versions = await this.prisma.riskMethodVersion.findMany({
      where: { publicationStatus: { in: ['PUBLISHED', 'CANDIDATE'] } },
      include: {
        methodDefinition: { select: { methodKey: true } },
        sourceLinks: {
          include: {
            methodologySourceVersion: {
              include: { source: { select: { sourceKey: true } } },
            },
          },
        },
        regulatoryContexts: true,
        guidanceVersions: {
          where: { publicationStatus: { in: ['PUBLISHED', 'CANDIDATE'] } },
        },
      },
      orderBy: [{ isDemo: 'asc' }, { displayName: 'asc' }],
    });
    return versions.map((version) => this.presentCatalogVersion(version));
  }

  async catalogVersion(versionId: string) {
    const versions = await this.catalog();
    const version = versions.find(({ id }) => id === versionId);
    if (!version) throw new NotFoundException('Metodología de valoración no disponible.');
    return version;
  }

  async requireAvailableVersion(versionId: string) {
    const version = await this.prisma.riskMethodVersion.findFirst({
      where: { id: versionId, publicationStatus: { in: ['PUBLISHED', 'CANDIDATE'] } },
      include: {
        methodDefinition: { select: { methodKey: true } },
        guidanceVersions: {
          where: { publicationStatus: { in: ['PUBLISHED', 'CANDIDATE'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!version || !riskMethodProvider(version.calculationProviderKey))
      throw new BadRequestException({
        code: 'RISK_METHOD_UNAVAILABLE',
        message: 'La versión de metodología seleccionada no está disponible.',
      });
    return version;
  }

  calculate(version: RiskMethodVersion, rawInput: unknown, residual = false) {
    const provider = riskMethodProvider(version.calculationProviderKey);
    if (!provider)
      throw new BadRequestException({
        code: 'RISK_METHOD_PROVIDER_UNAVAILABLE',
        message: 'La metodología no tiene un proveedor de cálculo disponible.',
      });
    try {
      const parsed = provider.validateInput(rawInput) as JsonRecord;
      const result = provider.calculate(parsed as never) as JsonRecord;
      const explanation = provider.explainResult(parsed as never, result as never);
      return this.normalize(version.calculationProviderKey, parsed, result, explanation, residual);
    } catch {
      throw new BadRequestException({
        code: residual ? 'INVALID_RESIDUAL_METHOD_INPUT' : 'INVALID_RISK_METHOD_INPUT',
        message: 'Completa los criterios requeridos por la metodología seleccionada.',
      });
    }
  }

  snapshot(version: RiskMethodVersion) {
    return version.manifest as Prisma.InputJsonValue;
  }

  private normalize(
    providerKey: string,
    input: JsonRecord,
    result: JsonRecord,
    explanation: PersistableRiskCalculation['explanation'],
    residual: boolean,
  ): PersistableRiskCalculation {
    if (providerKey === 'GTC45_2010_CANONICAL') {
      return {
        input,
        result: { ...result, explanation },
        explanation,
        likelihood: typeof result.probabilityValue === 'number' ? result.probabilityValue : null,
        consequence: result.consequenceValue as number,
        score: typeof result.riskValue === 'number' ? result.riskValue : null,
        semanticLevel: null,
        resultLabel: `Nivel de intervención ${String(result.riskLevel)}`,
      };
    }
    const probabilityKey = providerKey === 'GUIDED_5X5' ? 'probability' : 'likelihood';
    return {
      input,
      result: { ...result, explanation, valuationPhase: residual ? 'RESIDUAL' : 'INITIAL' },
      explanation,
      likelihood: result[probabilityKey] as number,
      consequence: (result.severity ?? result.consequence) as number,
      score: result.score as number,
      semanticLevel: result.level as PersistableRiskCalculation['semanticLevel'],
      resultLabel: String(result.level),
    };
  }

  private presentCatalogVersion(version: {
    id: string;
    semanticVersion: string;
    displayName: string;
    methodKind: string;
    isDemo: boolean;
    regulatory: boolean;
    publicationStatus: string;
    technicalReviewStatus: string;
    legalReviewStatus: string;
    disclaimer: string;
    methodDefinition: { methodKey: string };
    sourceLinks: Array<{
      methodologySourceVersion: {
        semanticVersion: string;
        title: string;
        issuer: string;
        edition: string;
        sourceFingerprint: string;
        sourceStatus: string;
        licenseReproductionNote: string;
        reviewStatus: string;
        publicationStatus: string;
        source: { sourceKey: string };
      };
    }>;
    regulatoryContexts: Array<{
      contextKey: string;
      contextVersion: string;
      jurisdiction: string;
      relationship: string;
      statement: string;
      technicalReviewStatus: string;
      legalReviewStatus: string;
      officialSutMethodOptions: string;
    }>;
    guidanceVersions: Array<{
      id: string;
      guidanceKey: string;
      guidanceVersion: string;
      reviewStatus: string;
      officialUiVerification: string;
      helpDefinitions: Prisma.JsonValue;
      disclaimer: string;
    }>;
  }) {
    return {
      id: version.id,
      methodKey: version.methodDefinition.methodKey,
      semanticVersion: version.semanticVersion,
      displayName: version.displayName,
      purpose:
        version.methodDefinition.methodKey === 'GTC45_2010'
          ? 'Valora peligro, exposición y consecuencia mediante niveles de intervención.'
          : version.methodDefinition.methodKey === 'GUIDED_5X5'
            ? 'Estructura el juicio profesional sobre probabilidad y severidad humana.'
            : 'Conserva la valoración histórica demostrativa de inspecciones.',
      methodKind: version.methodKind,
      isDemo: version.isDemo,
      regulatory: version.regulatory,
      publicationStatus: version.publicationStatus,
      technicalReviewStatus: version.technicalReviewStatus,
      legalReviewStatus: version.legalReviewStatus,
      disclaimer: version.disclaimer,
      technicalSources: version.sourceLinks.map(({ methodologySourceVersion: source }) => ({
        sourceKey: source.source.sourceKey,
        semanticVersion: source.semanticVersion,
        title: source.title,
        issuer: source.issuer,
        edition: source.edition,
        sourceFingerprint: source.sourceFingerprint,
        sourceStatus: source.sourceStatus,
        licenseReproductionNote: source.licenseReproductionNote,
        reviewStatus: source.reviewStatus,
        publicationStatus: source.publicationStatus,
      })),
      regulatoryContexts: version.regulatoryContexts,
      guidanceVersions: version.guidanceVersions,
      criteria:
        version.methodDefinition.methodKey === 'GTC45_2010'
          ? {
              deficiency: GTC45_DEFICIENCY_OPTIONS,
              exposure: GTC45_EXPOSURE_OPTIONS,
              consequence: GTC45_CONSEQUENCE_OPTIONS,
            }
          : version.methodDefinition.methodKey === 'GUIDED_5X5'
            ? {
                probability: GUIDED_5X5_PROBABILITY_CRITERIA,
                severity: GUIDED_5X5_HUMAN_SEVERITY_CRITERIA,
              }
            : null,
    };
  }
}
