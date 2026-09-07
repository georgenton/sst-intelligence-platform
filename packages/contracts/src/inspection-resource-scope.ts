import { z } from 'zod';
import { adaptiveContentHash } from './adaptive-configuration.js';

export const inspectionResourceLevels = ['MINOR', 'MAJOR', 'INDUSTRIAL_SERVICE'] as const;

export const inspectionResourceManifestSchema = z.object({
  taxonomy: z.object({
    id: z.uuid(),
    versionId: z.uuid(),
    code: z.string().min(3).max(160),
    version: z.number().int().positive(),
    inspectionDomain: z.enum([
      'ELECTRICAL',
      'FIRE_PROTECTION',
      'MACHINERY',
      'CHEMICAL_STORAGE',
      'EMERGENCY',
      'INFRASTRUCTURE',
    ]),
    name: z.string().min(3).max(200),
  }),
  resources: z.array(
    z.object({
      id: z.uuid(),
      code: z.string().min(2).max(160),
      name: z.string().min(2).max(200),
      level: z.enum(inspectionResourceLevels),
      parentId: z.uuid().nullable().optional(),
      displayOrder: z.number().int().positive(),
    }),
  ),
});

export type InspectionResourceManifest = z.infer<typeof inspectionResourceManifestSchema>;

export function inspectionResourceManifestDigest(input: InspectionResourceManifest) {
  return adaptiveContentHash(inspectionResourceManifestSchema.parse(input));
}

export const inspectionDraftCriterionSchema = z.object({
  title: z.string().trim().min(3).max(240),
  guidance: z.string().trim().min(3).max(1000),
  sourceId: z.uuid(),
  sourceVersionId: z.uuid(),
  sourceUnitId: z.uuid(),
  sourceLocator: z.string().trim().min(1).max(240),
});

export const inspectionDraftProposalOutputSchema = z.object({
  jurisdictionCode: z.string().length(2),
  resourceId: z.uuid(),
  criteria: z.array(inspectionDraftCriterionSchema).min(1).max(12),
  requestedAction: z.literal('CREATE_EDITORIAL_PROPOSAL'),
});

export type InspectionDraftProposalOutput = z.infer<typeof inspectionDraftProposalOutputSchema>;

export function validateInspectionDraftProposal(input: {
  output: unknown;
  expectedJurisdictionCode: string;
  expectedResourceId: string;
  allowedUnits: ReadonlyMap<string, { locator: string; sourceId: string; sourceVersionId: string }>;
}) {
  const output = inspectionDraftProposalOutputSchema.parse(input.output);
  if (output.jurisdictionCode !== input.expectedJurisdictionCode)
    throw new Error('AI_PROPOSAL_JURISDICTION_MISMATCH');
  if (output.resourceId !== input.expectedResourceId)
    throw new Error('AI_PROPOSAL_RESOURCE_MISMATCH');
  for (const criterion of output.criteria) {
    const unit = input.allowedUnits.get(criterion.sourceUnitId);
    if (!unit) throw new Error('AI_PROPOSAL_CITATION_NOT_ALLOWED');
    if (unit.sourceId !== criterion.sourceId) throw new Error('AI_PROPOSAL_SOURCE_MISMATCH');
    if (unit.sourceVersionId !== criterion.sourceVersionId)
      throw new Error('AI_PROPOSAL_SOURCE_VERSION_MISMATCH');
    if (unit.locator !== criterion.sourceLocator) throw new Error('AI_PROPOSAL_LOCATOR_MISMATCH');
  }
  return output;
}
