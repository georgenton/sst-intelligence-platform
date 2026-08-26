import { describe, expect, it } from 'vitest';
import {
  assertRegulatoryPilotManifestRevision,
  regulatoryPilotMaterialHash,
  validateRegulatoryPilotManifest,
  type RegulatoryPilotManifestBundle,
} from '@sst/contracts';
import { loadRegulatoryPilotManifest } from './manifest.js';
import {
  LARGE_TARGETS,
  SMALL_TARGETS,
  evaluatePilotWorkerCount,
  validateRegulatoryPilotCampaign,
} from './validation.js';

function cloneManifest() {
  return structuredClone(loadRegulatoryPilotManifest());
}

function rehash(manifest: RegulatoryPilotManifestBundle) {
  manifest.index.manifestSha256 = regulatoryPilotMaterialHash({
    source: manifest.source,
    provisions: manifest.provisions,
    requirements: manifest.requirements,
    ruleDrafts: manifest.ruleDrafts,
    shadowPack: manifest.shadowPack,
  });
  return manifest;
}

describe('controlled MDT-2024-196 regulatory pilot', () => {
  it('validates exact boundaries, scenarios, missing input and publication gate', () => {
    const report = validateRegulatoryPilotCampaign(loadRegulatoryPilotManifest());
    expect(report).toMatchObject({
      provisions: 2,
      requirements: 5,
      ruleDrafts: 5,
      publicationBlocked: true,
      constructionSpecificRulesAdded: false,
    });
    expect(report.workerCases['1']).toEqual([...SMALL_TARGETS].sort());
    expect(report.workerCases['10']).toEqual([...SMALL_TARGETS].sort());
    expect(report.workerCases['11']).toEqual([...LARGE_TARGETS].sort());
    expect(report.workerCases['80']).toEqual([...LARGE_TARGETS].sort());
    expect(report.missingWhyAsked).toContain('evaluación regulatoria');
    expect(report.missingWhyAsked).not.toContain('DEMO');
  });

  it('rejects zero rather than treating it as Article 18', () => {
    expect(() => evaluatePilotWorkerCount(loadRegulatoryPilotManifest(), 0)).toThrow(
      'Value below minimum',
    );
  });

  it.each([
    [
      'source fingerprint',
      (m: RegulatoryPilotManifestBundle) =>
        (m.source.officialDocumentSha256 = `sha256:${'0'.repeat(64)}`),
    ],
    [
      'source version',
      (m: RegulatoryPilotManifestBundle) => (m.source.sourceCatalogVersion = 1 as 2),
    ],
    [
      'article scope',
      (m: RegulatoryPilotManifestBundle) => (m.provisions[0]!.provisionKey = 'MDT_2024_196_ART_17'),
    ],
    [
      'orphan provision',
      (m: RegulatoryPilotManifestBundle) =>
        (m.requirements[0]!.provisionKeys = ['UNKNOWN_PROVISION']),
    ],
    [
      'orphan requirement',
      (m: RegulatoryPilotManifestBundle) =>
        (m.ruleDrafts[0]!.requirementKeys = ['UNKNOWN_REQUIREMENT']),
    ],
    [
      'unsupported fact',
      (m: RegulatoryPilotManifestBundle) =>
        (m.ruleDrafts[0]!.rule.condition = {
          kind: 'PREDICATE',
          factKey: 'organization.economicSector',
          factScope: 'ORGANIZATION',
          operator: 'EQUALS',
          value: 'CONSTRUCTION',
        }),
    ],
  ])('rejects invalid %s', (_label, mutate) => {
    const manifest = cloneManifest();
    mutate(manifest);
    expect(() => validateRegulatoryPilotManifest(rehash(manifest))).toThrow();
  });

  it.each([
    ['gap at 11', 11, 12],
    ['overlap at 10', 11, 10],
  ])('detects worker-band %s', (_label, original, replacement) => {
    const manifest = cloneManifest();
    const large = manifest.ruleDrafts.filter(({ rule }) => rule.ruleKey.endsWith('_GT_10_RULE'));
    for (const draft of large) {
      if (draft.rule.condition.kind !== 'PREDICATE') throw new Error('unexpected fixture');
      if (draft.rule.condition.value === original) draft.rule.condition.value = replacement;
    }
    rehash(manifest);
    expect(() =>
      validateRegulatoryPilotCampaign(validateRegulatoryPilotManifest(manifest)),
    ).toThrow(/SHADOW_SCENARIO_FAILED/);
  });

  it('detects a single rule draft assigned to the wrong worker band', () => {
    const manifest = cloneManifest();
    const draft = manifest.ruleDrafts.find(({ rule }) =>
      rule.ruleKey.includes('PSYCHOSOCIAL_PROGRAM'),
    );
    if (!draft || draft.rule.condition.kind !== 'PREDICATE') throw new Error('unexpected fixture');
    draft.rule.condition.value = 1;
    rehash(manifest);
    expect(() =>
      validateRegulatoryPilotCampaign(validateRegulatoryPilotManifest(manifest)),
    ).toThrow(/SHADOW_SCENARIO_FAILED/);
  });

  it('rejects same manifest version with changed canonical content', () => {
    const existing = cloneManifest();
    const incoming = cloneManifest();
    incoming.requirements[0]!.title = 'Contenido cambiado sin nueva versión';
    rehash(incoming);
    expect(() => assertRegulatoryPilotManifestRevision(existing.index, incoming.index)).toThrow(
      'MANIFEST_VERSION_DRIFT',
    );
  });
});
