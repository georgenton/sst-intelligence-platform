import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  adaptiveRulePackSchema,
  adaptivePackContentHash,
  evaluateAdaptiveConfiguration,
  type AdaptiveFactInput,
  type AdaptiveRulePackContract,
  type AdaptiveScopeInput,
  type SstAssessmentFact,
  type SstAssessmentSnapshot,
} from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';
import {
  loadRegulatoryCandidatePack,
  normalizeRegulatoryCountryCode,
} from '../unified-sst-evaluation/regulatory-candidate-evaluator';

type SpecialistEvaluation = {
  adaptive: ReturnType<typeof evaluateAdaptiveConfiguration>;
  regulatory: ReturnType<typeof evaluateAdaptiveConfiguration>;
  adaptivePack: { packKey: string; version: string; contentHash: string };
  regulatoryPack: { packKey: string; version: string; contentHash: string };
};

export type AssessmentSpecialistPins = {
  adaptive: { id: string; packKey: string; version: string; contentHash: string };
  regulatory: { packKey: string; version: string; contentHash: string };
};

function knownFacts(facts: SstAssessmentFact[]) {
  return facts.filter(
    (fact): fact is Extract<SstAssessmentFact, { answerState: 'KNOWN' }> =>
      fact.answerState === 'KNOWN',
  );
}

export function adaptAssessmentFactsToAdaptive(
  snapshot: SstAssessmentSnapshot,
  pack: AdaptiveRulePackContract,
): AdaptiveFactInput[] {
  const supported = new Set(pack.factVersions.map(({ factKey }) => factKey));
  return knownFacts(snapshot.facts)
    .flatMap((fact): AdaptiveFactInput[] => {
      if (!supported.has(fact.factKey)) return [];
      if (
        fact.factKey === 'workCenter.activityCategories' ||
        fact.factKey === 'workCenter.facilityTypes'
      ) {
        return [];
      }
      return [
        {
          scopeKey: fact.scopeKey,
          factKey: fact.factKey,
          value: fact.value,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.scopeKey.localeCompare(right.scopeKey) || left.factKey.localeCompare(right.factKey),
    );
}

function scopesForAdaptive(snapshot: SstAssessmentSnapshot): AdaptiveScopeInput[] {
  return snapshot.scopes.map((scope) => ({
    scopeKey: scope.scopeKey,
    kind: scope.kind,
    order: scope.order,
    displayName: scope.kind === 'ORGANIZATION' ? 'Organización' : `Centro ${scope.order}`,
  }));
}

@Injectable()
export class AssessmentSpecialists {
  constructor(private readonly prisma: PrismaService) {}

  async resolveVersions(): Promise<AssessmentSpecialistPins> {
    const packRow = await this.prisma.adaptiveRulePackVersion.findFirst({
      where: {
        isDemo: true,
        regulatory: false,
        sealedAt: { not: null },
        packDefinition: { packKey: 'DEMO_ADAPTIVE_SST_CONFIGURATION' },
      },
      select: {
        id: true,
        version: true,
        schema: true,
        contentHash: true,
        packDefinition: { select: { packKey: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }],
    });
    if (!packRow) {
      throw new InternalServerErrorException({
        code: 'SST_ASSESSMENT_PACK_UNAVAILABLE',
        message: 'El pack canónico de evaluación SST no está disponible.',
      });
    }
    const adaptivePack = adaptiveRulePackSchema.parse(packRow.schema);
    const regulatoryPack = loadRegulatoryCandidatePack();
    return {
      adaptive: {
        id: packRow.id,
        packKey: adaptivePack.packKey,
        version: adaptivePack.version,
        contentHash: packRow.contentHash,
      },
      regulatory: {
        packKey: regulatoryPack.packKey,
        version: regulatoryPack.version,
        contentHash: adaptivePackContentHash(regulatoryPack),
      },
    };
  }

  async evaluate(
    snapshot: SstAssessmentSnapshot,
    pins: AssessmentSpecialistPins,
  ): Promise<SpecialistEvaluation> {
    const packRow = await this.prisma.adaptiveRulePackVersion.findFirst({
      where: {
        id: pins.adaptive.id,
        isDemo: true,
        regulatory: false,
        sealedAt: { not: null },
        contentHash: pins.adaptive.contentHash,
      },
      select: { schema: true, contentHash: true },
    });
    if (!packRow) {
      throw new InternalServerErrorException({
        code: 'SST_ASSESSMENT_PINNED_PACK_UNAVAILABLE',
        message: 'La versión fijada del evaluador SST no está disponible.',
      });
    }
    const adaptivePack = adaptiveRulePackSchema.parse(packRow.schema);
    if (
      adaptivePack.packKey !== pins.adaptive.packKey ||
      adaptivePack.version !== pins.adaptive.version
    ) {
      throw new InternalServerErrorException(
        'La versión fijada del evaluador SST es inconsistente.',
      );
    }
    const scopes = scopesForAdaptive(snapshot);
    const adaptive = evaluateAdaptiveConfiguration({
      pack: adaptivePack,
      scopes,
      facts: adaptAssessmentFactsToAdaptive(snapshot, adaptivePack),
      auditContext: {
        packVersionId: `${pins.adaptive.packKey}@${pins.adaptive.version}`,
        packContentHash: packRow.contentHash,
      },
    });

    const regulatoryPack = loadRegulatoryCandidatePack();
    if (
      regulatoryPack.packKey !== pins.regulatory.packKey ||
      regulatoryPack.version !== pins.regulatory.version ||
      adaptivePackContentHash(regulatoryPack) !== pins.regulatory.contentHash
    ) {
      throw new InternalServerErrorException({
        code: 'SST_ASSESSMENT_PINNED_REGULATORY_PACK_UNAVAILABLE',
        message: 'La versión fijada del especialista regulatorio no está disponible.',
      });
    }
    const regulatoryFacts = knownFacts(snapshot.facts).flatMap((fact): AdaptiveFactInput[] => {
      if (fact.scopeKey !== 'organization') return [];
      if (fact.factKey === 'organization.country' && typeof fact.value === 'string') {
        return [
          {
            scopeKey: 'organization',
            factKey: fact.factKey,
            value: normalizeRegulatoryCountryCode(fact.value),
          },
        ];
      }
      if (fact.factKey === 'organization.totalWorkerCount' && typeof fact.value === 'number') {
        return [{ scopeKey: 'organization', factKey: fact.factKey, value: fact.value }];
      }
      return [];
    });
    const regulatory = evaluateAdaptiveConfiguration({
      pack: regulatoryPack,
      scopes: scopes.filter(({ kind }) => kind === 'ORGANIZATION'),
      facts: regulatoryFacts,
    });
    return {
      adaptive,
      regulatory,
      adaptivePack: {
        packKey: adaptivePack.packKey,
        version: adaptivePack.version,
        contentHash: pins.adaptive.contentHash,
      },
      regulatoryPack: {
        packKey: regulatoryPack.packKey,
        version: regulatoryPack.version,
        contentHash: pins.regulatory.contentHash,
      },
    };
  }
}
