import type { SstAssessmentResult, SstAssessmentSnapshot } from '@sst/contracts';

type Foundation = NonNullable<SstAssessmentResult['items'][number]['regulatoryFoundation']>;

const EMPTY_FOUNDATION: Foundation = {
  status: 'NO_EXACT_SOURCE_MAPPING',
  interpretationStatus: 'PROFESSIONAL_REVIEW_REQUIRED',
};

const ELECTRICAL_FOUNDATION: Omit<Foundation, 'status' | 'interpretationStatus'> = {
  sourceKey: 'EC_MDT_2024_196_ANNEX_3',
  sourceVersionId: 'a2000000-0000-4000-8000-000000000015',
  officialUrl:
    'https://www.trabajo.gob.ec/wp-content/uploads/2024/11/Anexo-3_Norma-Tecnica-de-Seguridad-e-Higiene-del-Trabajo-signed-signed-signed-signed.pdf',
  officialDocumentSha256: 'sha256:d588c7b8e0dadf68dc5b06763a6dbf80e445ee5b55c7972ae063e56228e27ddc',
  unitIds: [
    'c3000000-0000-4000-8000-000000000101',
    'c3000000-0000-4000-8000-000000000102',
    'c3000000-0000-4000-8000-000000000103',
    'c3000000-0000-4000-8000-000000000104',
    'c3000000-0000-4000-8000-000000000105',
    'c3000000-0000-4000-8000-000000000106',
    'c3000000-0000-4000-8000-000000000107',
    'c3000000-0000-4000-8000-000000000108',
    'c3000000-0000-4000-8000-000000000109',
  ],
  unitLocators: [
    'Art. 82',
    'Art. 83',
    'Art. 84',
    'Art. 85',
    'Art. 86',
    'Art. 87',
    'Art. 88',
    'Art. 89',
    'Art. 90',
  ],
};

function statusFoundation(
  status: Foundation['status'],
  source: Omit<Foundation, 'status' | 'interpretationStatus'> = {},
): Foundation {
  return { ...source, status, interpretationStatus: 'PROFESSIONAL_REVIEW_REQUIRED' };
}

/**
 * Every emitted motor rule key gets an explicit foundation result. The five
 * MDT-2024-196 RuleDrafts intentionally remain NO_EXACT_SOURCE_MAPPING here:
 * their source articles are present, but dependencies and professional review
 * are incomplete, so they cannot be represented as executable obligations.
 */
export function resolveAssessmentFoundation(
  snapshot: SstAssessmentSnapshot,
  scopeKey: string,
  ruleKeys: readonly string[],
): Foundation {
  if (ruleKeys.length !== 1 || ruleKeys[0] !== 'HIGH_ENERGY_RULE') return EMPTY_FOUNDATION;
  const highEnergy = snapshot.facts.find(
    (fact) =>
      fact.scopeKey === scopeKey &&
      fact.factKey === 'workCenter.hasHighEnergyOperations' &&
      fact.answerState === 'KNOWN' &&
      fact.value === true,
  );
  if (!highEnergy) return EMPTY_FOUNDATION;
  const sourceTypes = snapshot.facts.find(
    (fact) => fact.scopeKey === scopeKey && fact.factKey === 'workCenter.highEnergySourceTypes',
  );
  const types =
    sourceTypes?.answerState === 'KNOWN' && Array.isArray(sourceTypes.value)
      ? sourceTypes.value
      : [];
  if (!types.includes('ELECTRICAL')) {
    return statusFoundation(
      sourceTypes?.answerState === 'KNOWN' ? 'NO_EXACT_SOURCE_MAPPING' : 'SOURCE_CONTEXT_REQUIRED',
    );
  }
  return statusFoundation('OFFICIAL_ARTIFACT_VERIFIED', ELECTRICAL_FOUNDATION);
}
