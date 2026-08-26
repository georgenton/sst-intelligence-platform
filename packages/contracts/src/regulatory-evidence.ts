import { createHash } from 'node:crypto';
import { z } from 'zod';

export const regulatoryArtifactVerificationStatusSchema = z.enum([
  'OFFICIAL_ARTIFACT_VERIFIED',
  'OFFICIAL_REFERENCE_ONLY',
  'ARTIFACT_PENDING',
  'REJECTED_UNVERIFIED',
]);

export const regulatoryTextExtractionStatusSchema = z.enum([
  'COMPLETE',
  'PARTIAL',
  'PENDING',
  'NOT_APPLICABLE',
]);

export const regulatoryVigenciaReviewStatusSchema = z.enum([
  'CURRENT_VERIFIED',
  'AMENDED',
  'PARTIALLY_AMENDED',
  'REPEALED',
  'SUPERSEDED',
  'PENDING_REVIEW',
  'UNKNOWN',
]);

export const regulatoryUnitTypeSchema = z.enum([
  'TITLE',
  'CHAPTER',
  'SECTION',
  'ARTICLE',
  'DISPOSITION_GENERAL',
  'DISPOSITION_TRANSITORY',
  'DISPOSITION_REPEAL',
  'DISPOSITION_FINAL',
  'ANNEX',
  'ANNEX_ITEM',
  'OTHER',
]);

export const regulatoryUnitRecordSchema = z
  .object({
    id: z.uuid(),
    sourceVersionId: z.uuid(),
    parentUnitId: z.uuid().nullable(),
    unitType: regulatoryUnitTypeSchema,
    identifier: z.string().min(1).max(160),
    heading: z.string().min(1).max(500).nullable(),
    ordinal: z.number().int().nonnegative(),
    officialText: z.string().trim().min(1),
    editorialSummary: z.string().trim().min(1).nullable(),
    normalizedTextHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    pageStart: z.number().int().positive().nullable(),
    pageEnd: z.number().int().positive().nullable(),
    locator: z.string().min(1).max(240),
    extractionStatus: z.enum(['EXTRACTED', 'OCR_REVIEW_REQUIRED', 'MANUAL_REVIEW_REQUIRED']),
    reviewStatus: z.enum([
      'UNREVIEWED',
      'TECHNICAL_REVIEW_PENDING',
      'LEGAL_REVIEW_PENDING',
      'VERIFIED',
    ]),
  })
  .superRefine((unit, context) => {
    if ((unit.pageStart === null) !== (unit.pageEnd === null))
      context.addIssue({ code: 'custom', message: 'REGULATORY_UNIT_PAGE_RANGE_INCOMPLETE' });
    if (unit.pageStart !== null && unit.pageEnd !== null && unit.pageEnd < unit.pageStart)
      context.addIssue({ code: 'custom', message: 'REGULATORY_UNIT_PAGE_RANGE_INVALID' });
  });

export type RegulatoryUnitRecord = z.infer<typeof regulatoryUnitRecordSchema>;

/** Normalize extraction whitespace only; punctuation, accents and letter case remain substantive. */
export function normalizeOfficialRegulatoryText(text: string) {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

export function regulatoryOfficialTextHash(text: string) {
  return `sha256:${createHash('sha256').update(normalizeOfficialRegulatoryText(text)).digest('hex')}`;
}

export type RegulatoryCoverageAudit = {
  expectedUnitCount: number;
  discoveredUnitCount: number;
  coveragePercent: number;
  duplicateIdentifiers: string[];
  missingIdentifiers: string[];
  emptyTextIdentifiers: string[];
  unresolvedPageIdentifiers: string[];
  invalidParentIdentifiers: string[];
  hashMismatchIdentifiers: string[];
  complete: boolean;
};

export function auditRegulatoryUnitCoverage(
  units: readonly RegulatoryUnitRecord[],
  expectedIdentifiers: readonly string[],
): RegulatoryCoverageAudit {
  const identifiers = units.map(({ identifier }) => identifier);
  const seen = new Set<string>();
  const duplicateIdentifiers = [
    ...new Set(identifiers.filter((id) => (seen.has(id) ? true : !seen.add(id)))),
  ].sort();
  const available = new Set(identifiers);
  const idByRecord = new Set(units.map(({ id }) => id));
  const missingIdentifiers = expectedIdentifiers.filter((id) => !available.has(id));
  const emptyTextIdentifiers = units
    .filter(({ officialText }) => normalizeOfficialRegulatoryText(officialText).length === 0)
    .map(({ identifier }) => identifier);
  const unresolvedPageIdentifiers = units
    .filter(({ pageStart, pageEnd }) => pageStart === null || pageEnd === null)
    .map(({ identifier }) => identifier);
  const invalidParentIdentifiers = units
    .filter(({ parentUnitId }) => parentUnitId !== null && !idByRecord.has(parentUnitId))
    .map(({ identifier }) => identifier);
  const hashMismatchIdentifiers = units
    .filter(
      ({ officialText, normalizedTextHash }) =>
        regulatoryOfficialTextHash(officialText) !== normalizedTextHash,
    )
    .map(({ identifier }) => identifier);
  const expectedUnitCount = expectedIdentifiers.length;
  const discoveredExpectedCount = expectedIdentifiers.filter((id) => available.has(id)).length;
  const coveragePercent =
    expectedUnitCount === 0
      ? 0
      : Number(((discoveredExpectedCount / expectedUnitCount) * 100).toFixed(2));
  const complete =
    expectedUnitCount > 0 &&
    coveragePercent === 100 &&
    duplicateIdentifiers.length === 0 &&
    emptyTextIdentifiers.length === 0 &&
    unresolvedPageIdentifiers.length === 0 &&
    invalidParentIdentifiers.length === 0 &&
    hashMismatchIdentifiers.length === 0;
  return {
    expectedUnitCount,
    discoveredUnitCount: units.length,
    coveragePercent,
    duplicateIdentifiers,
    missingIdentifiers,
    emptyTextIdentifiers,
    unresolvedPageIdentifiers,
    invalidParentIdentifiers,
    hashMismatchIdentifiers,
    complete,
  };
}

export const regulatoryRiskLinkInputSchema = z
  .object({
    unitId: z.uuid().optional(),
    requirementId: z.uuid().optional(),
    provenance: z.enum(['SYSTEM_RULE_MATCH', 'EXPERT_LINK', 'USER_REFERENCE']),
    rationale: z.string().trim().min(3).max(1000),
  })
  .refine(({ unitId, requirementId }) => Boolean(unitId || requirementId), {
    message: 'REGULATORY_RISK_LINK_TARGET_REQUIRED',
  });

export const organizationRiskMethodPolicyInputSchema = z
  .object({
    allowedRiskMethodVersionIds: z.array(z.uuid()).min(1).max(2),
    defaultRiskMethodVersionId: z.uuid(),
  })
  .superRefine((policy, context) => {
    if (
      new Set(policy.allowedRiskMethodVersionIds).size !== policy.allowedRiskMethodVersionIds.length
    )
      context.addIssue({ code: 'custom', message: 'DUPLICATE_ALLOWED_RISK_METHOD' });
    if (!policy.allowedRiskMethodVersionIds.includes(policy.defaultRiskMethodVersionId))
      context.addIssue({ code: 'custom', message: 'DEFAULT_RISK_METHOD_MUST_BE_ALLOWED' });
  });

export const guided5x5OrganizationProfileInputSchema = z
  .object({
    probabilityGuidance: z
      .array(
        z.object({
          value: z.number().int().min(1).max(5),
          label: z.string().trim().min(1).max(80),
          help: z.string().trim().min(1).max(400),
          cues: z.array(z.string().trim().min(1).max(200)).max(10),
        }),
      )
      .length(5),
    severityGuidance: z
      .array(
        z.object({
          value: z.number().int().min(1).max(5),
          label: z.string().trim().min(1).max(80),
          help: z.string().trim().min(1).max(400),
          cues: z.array(z.string().trim().min(1).max(200)).max(10),
        }),
      )
      .length(5),
    additionalCriteria: z.array(z.string().trim().min(1).max(300)).max(20),
  })
  .superRefine((profile, context) => {
    for (const [key, guidance] of [
      ['probabilityGuidance', profile.probabilityGuidance],
      ['severityGuidance', profile.severityGuidance],
    ] as const) {
      const values = guidance.map(({ value }) => value).sort();
      if (values.join(',') !== '1,2,3,4,5')
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'GUIDANCE_VALUES_MUST_BE_1_TO_5',
        });
    }
  });
