import { z } from 'zod';

export const GAP_TYPES = [
  'INFORMATION_REQUIRED',
  'EVIDENCE_REQUIRED',
  'ACTIVITY_NOT_PLANNED',
  'CAPABILITY_ABSENT',
  'PROFESSIONAL_REVIEW_PENDING',
  'IMPLEMENTATION_MISMATCH',
  'PARTIALLY_IMPLEMENTED',
  'IMPLEMENTED_EVIDENCE_AVAILABLE',
] as const;

export const gapAnalysisItemSchema = z.object({
  key: z.string().trim().min(3).max(200),
  targetKey: z.string().trim().min(3).max(200),
  title: z.string().trim().min(3).max(240),
  type: z.enum(GAP_TYPES),
  expectedState: z.string().trim().min(1).max(80),
  knownState: z.string().trim().min(1).max(80),
  explanation: z.string().trim().min(3).max(1000),
  workCenterId: z.uuid().nullable(),
  evidenceReferences: z.array(z.string().trim().min(1).max(500)).max(20),
  source: z.object({
    type: z.enum(['ADAPTIVE_CONFIGURATION', 'UNIFIED_SST_EVALUATION']),
    id: z.uuid(),
    itemId: z.uuid(),
  }),
  professionalReviewRequired: z.boolean(),
});

export type GapAnalysisItem = z.infer<typeof gapAnalysisItemSchema>;

export type GapCandidate = {
  itemId: string;
  targetKey: string;
  title: string;
  expectedState: string;
  currentState?: 'IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'NOT_IMPLEMENTED' | 'UNKNOWN';
  evidenceReferences?: readonly string[];
  missingFacts?: readonly string[];
  professionalReviewRequired?: boolean;
  workCenterId?: string | null;
};

export function deriveGapAnalysisItems(
  source: { type: 'ADAPTIVE_CONFIGURATION' | 'UNIFIED_SST_EVALUATION'; id: string },
  candidates: readonly GapCandidate[],
): GapAnalysisItem[] {
  return [...candidates]
    .sort(
      (left, right) =>
        left.targetKey.localeCompare(right.targetKey) || left.itemId.localeCompare(right.itemId),
    )
    .map((candidate) => {
      const evidence = [...(candidate.evidenceReferences ?? [])].sort();
      const missing = [...(candidate.missingFacts ?? [])].sort();
      const knownState = candidate.currentState ?? 'UNKNOWN';
      let type: GapAnalysisItem['type'];
      if (candidate.professionalReviewRequired) type = 'PROFESSIONAL_REVIEW_PENDING';
      else if (missing.length || knownState === 'UNKNOWN') type = 'INFORMATION_REQUIRED';
      else if (knownState === 'NOT_IMPLEMENTED') type = 'CAPABILITY_ABSENT';
      else if (knownState === 'PARTIALLY_IMPLEMENTED') type = 'PARTIALLY_IMPLEMENTED';
      else if (evidence.length === 0) type = 'EVIDENCE_REQUIRED';
      else type = 'IMPLEMENTED_EVIDENCE_AVAILABLE';
      return gapAnalysisItemSchema.parse({
        key: `${source.type}:${source.id}:${candidate.itemId}`,
        targetKey: candidate.targetKey,
        title: candidate.title,
        type,
        expectedState: candidate.expectedState,
        knownState,
        explanation:
          type === 'INFORMATION_REQUIRED'
            ? `Falta información verificable: ${missing.join(', ') || 'estado actual'}.`
            : type === 'EVIDENCE_REQUIRED'
              ? 'El estado fue declarado, pero aún no tiene evidencia referenciada.'
              : type === 'PROFESSIONAL_REVIEW_PENDING'
                ? 'La propuesta requiere decisión profesional antes de cualquier conclusión.'
                : type === 'CAPABILITY_ABSENT'
                  ? 'La capacidad operativa fue declarada como no implementada.'
                  : type === 'PARTIALLY_IMPLEMENTED'
                    ? 'La implementación fue declarada como parcial.'
                    : 'Existe una declaración implementada con evidencia disponible.',
        workCenterId: candidate.workCenterId ?? null,
        evidenceReferences: evidence,
        source: { ...source, itemId: candidate.itemId },
        professionalReviewRequired: candidate.professionalReviewRequired ?? false,
      });
    });
}

export const INSPECTION_DEPTHS = ['BASIC', 'TECHNICAL', 'SYSTEMIC'] as const;
export const inspectionDepthSchema = z.enum(INSPECTION_DEPTHS);
export const INSPECTION_DEPTH_VERSION = '1.0.0' as const;
export const INSPECTION_DEPTH_GUIDANCE = {
  BASIC: 'Verificación visible o de primera línea.',
  TECHNICAL: 'Revisión especializada con mayor profundidad técnica.',
  SYSTEMIC: 'Revisión transversal de programas, recurrencia y controles organizacionales.',
} as const;

export function inspectionDepthSnapshot(depth: z.infer<typeof inspectionDepthSchema>) {
  return { depth, version: INSPECTION_DEPTH_VERSION, guidance: INSPECTION_DEPTH_GUIDANCE[depth] };
}

export const operationalSearchTypes = [
  'FINDING',
  'INSPECTION',
  'SAFETY_OBSERVATION',
  'INCIDENT',
  'ACTION',
  'PLAN_ITEM',
  'WORKER',
  'POSITION',
  'TRAINING',
  'PPE',
  'WORK_CENTER',
] as const;

export const managementPrioritySchema = z.enum(['ROUTINE', 'FOCUSED', 'URGENT']);

export function assertMethodologyComparable(methodVersionIds: readonly (string | null)[]) {
  const present = [...new Set(methodVersionIds.filter((value): value is string => value !== null))];
  return { comparable: present.length <= 1, methodVersionIds: present.sort() };
}
