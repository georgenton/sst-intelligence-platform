export const DEMO_RISK_METHOD = {
  key: 'DEMO_5X5',
  version: '1.0.0',
  label: 'Matriz demostrativa 5×5',
  regulatory: false,
  disclaimer: 'Metodología demostrativa 5×5. No constituye una metodología regulatoria validada.',
  thresholds: [
    { min: 1, max: 4, level: 'LOW' },
    { min: 5, max: 9, level: 'MODERATE' },
    { min: 10, max: 16, level: 'HIGH' },
    { min: 17, max: 25, level: 'CRITICAL' },
  ],
} as const;

export type RiskLevel = (typeof DEMO_RISK_METHOD.thresholds)[number]['level'];
export type InspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type CorrectiveActionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PENDING_VERIFICATION'
  | 'COMPLETED'
  | 'CANCELED';
export type RecurrenceStatus = 'NONE' | 'REPEATED' | 'SYSTEMIC_REVIEW_RECOMMENDED';

export const FINDING_CATEGORIES = [
  'ELECTRICAL',
  'FIRE',
  'MECHANICAL',
  'CHEMICAL',
  'ERGONOMIC',
  'PHYSICAL',
  'BIOLOGICAL',
  'PSYCHOSOCIAL',
  'HOUSEKEEPING',
  'OTHER',
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  ELECTRICAL: 'Eléctrico',
  FIRE: 'Incendio',
  MECHANICAL: 'Mecánico',
  CHEMICAL: 'Químico',
  ERGONOMIC: 'Ergonómico',
  PHYSICAL: 'Físico',
  BIOLOGICAL: 'Biológico',
  PSYCHOSOCIAL: 'Psicosocial',
  HOUSEKEEPING: 'Orden y limpieza',
  OTHER: 'Otro',
};

export const INSPECTION_RECURRENCE_POLICY = {
  windowDays: 90,
  systemicReviewPreviousCount: 2,
} as const;

export type RiskAssessment = {
  methodKey: typeof DEMO_RISK_METHOD.key;
  methodVersion: typeof DEMO_RISK_METHOD.version;
  likelihood: number;
  consequence: number;
  score: number;
  level: RiskLevel;
};

function assertScaleValue(name: string, value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new RangeError(`${name} must be an integer from 1 to 5`);
  }
}

export function calculateDemoRisk(likelihood: number, consequence: number): RiskAssessment {
  assertScaleValue('likelihood', likelihood);
  assertScaleValue('consequence', consequence);
  const score = likelihood * consequence;
  const threshold = DEMO_RISK_METHOD.thresholds.find(
    ({ min, max }) => score >= min && score <= max,
  );
  if (!threshold) throw new Error('Risk score is outside the configured method');
  return {
    methodKey: DEMO_RISK_METHOD.key,
    methodVersion: DEMO_RISK_METHOD.version,
    likelihood,
    consequence,
    score,
    level: threshold.level,
  };
}

const INSPECTION_TRANSITIONS: Record<InspectionStatus, readonly InspectionStatus[]> = {
  DRAFT: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
};

export function canTransitionInspection(from: InspectionStatus, to: InspectionStatus) {
  return INSPECTION_TRANSITIONS[from].includes(to);
}

export function assertInspectionTransition(from: InspectionStatus, to: InspectionStatus) {
  if (!canTransitionInspection(from, to))
    throw new Error(`Invalid inspection transition: ${from} -> ${to}`);
}

const CORRECTIVE_ACTION_TRANSITIONS: Record<
  CorrectiveActionStatus,
  readonly CorrectiveActionStatus[]
> = {
  OPEN: ['IN_PROGRESS', 'PENDING_VERIFICATION', 'CANCELED'],
  IN_PROGRESS: ['PENDING_VERIFICATION', 'CANCELED'],
  PENDING_VERIFICATION: ['COMPLETED'],
  COMPLETED: [],
  CANCELED: [],
};

export function canTransitionCorrectiveAction(
  from: CorrectiveActionStatus,
  to: CorrectiveActionStatus,
) {
  return CORRECTIVE_ACTION_TRANSITIONS[from].includes(to);
}

export function assertCorrectiveActionTransition(
  from: CorrectiveActionStatus,
  to: CorrectiveActionStatus,
) {
  if (!canTransitionCorrectiveAction(from, to))
    throw new Error(`Invalid corrective action transition: ${from} -> ${to}`);
}

export function findingClosureEligibility(input: {
  actionStatuses: readonly string[];
  hasResidualRisk: boolean;
}) {
  if (input.actionStatuses.length === 0)
    return { allowed: false, reason: 'El hallazgo debe tener al menos una acción correctiva.' };
  const activeActions = input.actionStatuses.filter((status) => status !== 'CANCELED');
  if (activeActions.length === 0 || activeActions.some((status) => status !== 'COMPLETED'))
    return { allowed: false, reason: 'Todas las acciones no canceladas deben estar verificadas.' };
  if (!input.hasResidualRisk)
    return { allowed: false, reason: 'Debe registrarse el riesgo residual antes de cerrar.' };
  return { allowed: true, reason: null };
}

export function recurrenceStatus(previousCount: number): RecurrenceStatus {
  if (!Number.isInteger(previousCount) || previousCount < 0)
    throw new RangeError('previousCount must be a non-negative integer');
  if (previousCount === 0) return 'NONE';
  if (previousCount < INSPECTION_RECURRENCE_POLICY.systemicReviewPreviousCount) return 'REPEATED';
  return 'SYSTEMIC_REVIEW_RECOMMENDED';
}

export type RecurrenceCandidate = {
  organizationId: string;
  workCenterId: string;
  category: FindingCategory;
  createdAt: Date;
};

export function analyzeRecurrence(
  current: RecurrenceCandidate,
  candidates: readonly RecurrenceCandidate[],
  now = current.createdAt,
  windowDays = INSPECTION_RECURRENCE_POLICY.windowDays,
) {
  const threshold = now.getTime() - windowDays * 86_400_000;
  const previous = candidates.filter(
    (candidate) =>
      candidate.organizationId === current.organizationId &&
      candidate.workCenterId === current.workCenterId &&
      candidate.category === current.category &&
      candidate.createdAt.getTime() >= threshold &&
      candidate.createdAt.getTime() <= now.getTime(),
  );
  return { count: previous.length, status: recurrenceStatus(previous.length), windowDays };
}

export function normalizeInspectionSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

const FINDING_CATEGORY_SEARCH_ALIASES: Record<FindingCategory, readonly string[]> = {
  ELECTRICAL: ['electrico', 'electricidad'],
  FIRE: ['incendio'],
  MECHANICAL: ['mecanico'],
  CHEMICAL: ['quimico'],
  ERGONOMIC: ['ergonomico'],
  PHYSICAL: ['fisico'],
  BIOLOGICAL: ['biologico'],
  PSYCHOSOCIAL: ['psicosocial'],
  HOUSEKEEPING: ['orden', 'limpieza'],
  OTHER: ['otro'],
};

export function resolveFindingCategoriesFromSearch(value: string): FindingCategory[] {
  const terms = new Set(normalizeInspectionSearchText(value).split(/[^a-z0-9]+/).filter(Boolean));
  return FINDING_CATEGORIES.filter((category) =>
    FINDING_CATEGORY_SEARCH_ALIASES[category].some((alias) => terms.has(alias)),
  );
}

export function isCorrectiveActionOverdue(status: string, dueAt: Date | null, now = new Date()) {
  return (
    dueAt !== null &&
    dueAt.getTime() < now.getTime() &&
    status !== 'COMPLETED' &&
    status !== 'CANCELED'
  );
}
