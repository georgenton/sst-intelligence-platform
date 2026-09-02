export const OPERATIONAL_SIGNAL_WINDOW_DAYS = 90;
export const OPERATIONAL_SIGNAL_MINIMUM_COUNT = 3;
export const OPERATIONAL_SIGNAL_RULE_VERSION = '1.0.0';

export type OperationalSignalCandidate = {
  type: 'REPEATED_FINDING' | 'OVERDUE_ACTION_CLUSTER';
  fingerprintInput: string;
  workCenterId: string;
  title: string;
  explanation: string;
  attention: 'REVIEW';
  ruleKey: 'REPEATED_FINDING_90D_V1' | 'OVERDUE_ACTION_CLUSTER_90D_V1';
  ruleVersion: typeof OPERATIONAL_SIGNAL_RULE_VERSION;
  threshold: typeof OPERATIONAL_SIGNAL_MINIMUM_COUNT;
  observedCount: number;
  windowStart: Date;
  windowEnd: Date;
  sourceRecords: Array<Record<string, string>>;
};

export function normalizeSignalCategory(value: string) {
  return value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')
    .replaceAll(/\s+/g, ' ');
}

export function deriveRepeatedFindingSignals(
  findings: readonly {
    id: string;
    organizationId: string;
    workCenterId: string;
    category: string;
    status: string;
    createdAt: Date;
  }[],
  now: Date,
) {
  const windowStart = windowStartFor(now);
  const groups = new Map<string, typeof findings>();
  for (const finding of findings) {
    if (finding.createdAt < windowStart || finding.createdAt > now) continue;
    const normalizedCategory = normalizeSignalCategory(finding.category);
    const key = `${finding.organizationId}:${finding.workCenterId}:${normalizedCategory}`;
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length >= OPERATIONAL_SIGNAL_MINIMUM_COUNT)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]): OperationalSignalCandidate => {
      const ordered = [...values].sort((left, right) => left.id.localeCompare(right.id));
      const category = normalizeSignalCategory(ordered[0]!.category);
      return {
        type: 'REPEATED_FINDING',
        fingerprintInput: `REPEATED_FINDING:${key}`,
        workCenterId: ordered[0]!.workCenterId,
        title: `Patrón recurrente: ${category}`,
        explanation: `${ordered.length} hallazgos de la misma categoría normalizada fueron registrados en este centro de trabajo durante la ventana operativa de ${OPERATIONAL_SIGNAL_WINDOW_DAYS} días. Requiere revisión profesional; no identifica causa raíz.`,
        attention: 'REVIEW',
        ruleKey: 'REPEATED_FINDING_90D_V1',
        ruleVersion: OPERATIONAL_SIGNAL_RULE_VERSION,
        threshold: OPERATIONAL_SIGNAL_MINIMUM_COUNT,
        observedCount: ordered.length,
        windowStart,
        windowEnd: now,
        sourceRecords: ordered.map((item) => ({
          type: 'FINDING',
          id: item.id,
          category: item.category,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    });
}

export function deriveOverdueActionClusterSignals(
  actions: readonly {
    id: string;
    organizationId: string;
    workCenterId: string;
    sourceType: string;
    title: string;
    status: string;
    dueAt: Date;
    createdAt: Date;
  }[],
  now: Date,
) {
  const windowStart = windowStartFor(now);
  const groups = new Map<string, typeof actions>();
  for (const action of actions) {
    if (action.createdAt < windowStart || action.createdAt > now || action.dueAt >= now) continue;
    const key = `${action.organizationId}:${action.workCenterId}`;
    groups.set(key, [...(groups.get(key) ?? []), action]);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length >= OPERATIONAL_SIGNAL_MINIMUM_COUNT)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]): OperationalSignalCandidate => {
      const ordered = [...values].sort((left, right) => left.id.localeCompare(right.id));
      return {
        type: 'OVERDUE_ACTION_CLUSTER',
        fingerprintInput: `OVERDUE_ACTION_CLUSTER:${key}`,
        workCenterId: ordered[0]!.workCenterId,
        title: 'Concentración de acciones vencidas',
        explanation: `${ordered.length} acciones continúan abiertas después de su fecha objetivo en este centro de trabajo durante la ventana operativa de ${OPERATIONAL_SIGNAL_WINDOW_DAYS} días. Es una señal operativa que requiere revisión.`,
        attention: 'REVIEW',
        ruleKey: 'OVERDUE_ACTION_CLUSTER_90D_V1',
        ruleVersion: OPERATIONAL_SIGNAL_RULE_VERSION,
        threshold: OPERATIONAL_SIGNAL_MINIMUM_COUNT,
        observedCount: ordered.length,
        windowStart,
        windowEnd: now,
        sourceRecords: ordered.map((item) => ({
          type: item.sourceType,
          id: item.id,
          title: item.title,
          status: item.status,
          dueAt: item.dueAt.toISOString(),
          createdAt: item.createdAt.toISOString(),
        })),
      };
    });
}

function windowStartFor(now: Date) {
  return new Date(now.getTime() - OPERATIONAL_SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
