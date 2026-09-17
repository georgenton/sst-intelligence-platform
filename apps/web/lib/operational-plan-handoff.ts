import type { SstCapabilityEvaluation } from '@sst/contracts';

export function canCreateAssessmentPlan(
  accessChannel: string,
  status: string,
  evaluation?: SstCapabilityEvaluation | null,
) {
  return (
    accessChannel === 'AUTHENTICATED' &&
    status === 'FINALIZED' &&
    Boolean(evaluation?.recommendations.length)
  );
}

export function planHandoffStorageKey(
  userId: string,
  organizationId: string,
  assessmentId: string,
) {
  return `sst:plan-handoff:v1:${userId}:${organizationId}:${assessmentId}`;
}

export function planHandoffRetryKey(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  scope: string,
  createKey: () => string,
) {
  const previous = storage.getItem(scope);
  if (
    previous &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previous)
  )
    return previous;
  const key = createKey();
  storage.setItem(scope, key);
  return key;
}

export function operationalPlanError() {
  return 'No pudimos guardar el plan. Revisa los datos e intenta nuevamente. Si el intento anterior usó otros datos, revisa primero el listado de planes.';
}

export function planItemSource(type: string, snapshot?: Record<string, unknown>) {
  if (type === 'UNIFIED_SST_EVALUATION' && snapshot?.assessmentSessionId) return 'Diagnóstico SST';
  return (
    (
      {
        MANUAL: 'Plan manual',
        UNIFIED_SST_EVALUATION: 'Evaluación SST',
        APPLICABILITY_DECISION: 'Decisión revisada',
        FINDING: 'Hallazgo de inspección',
        CORRECTIVE_ACTION: 'Acción correctiva',
        OBLIGATION_EXECUTION: 'Ejecución de obligación',
        GAP_ANALYSIS: 'Análisis de brechas',
      } as Record<string, string>
    )[type] ?? 'Trabajo planificado'
  );
}
