import type { TechnicalQuestion } from '@sst/contracts';

export const TECHNICAL_RISK_WRITE_ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
] as const;

export const TECHNICAL_RISK_REVIEW_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

export const TECHNICAL_RISK_DEMO_COPY =
  'Metodología demostrativa. No constituye una evaluación regulatoria validada.';

export const TECHNICAL_RISK_REVIEW_COPY =
  'Aprobada significa revisada por un usuario autorizado, no certificación regulatoria.';

export function canWriteTechnicalRisk(role?: string): boolean {
  return TECHNICAL_RISK_WRITE_ROLES.includes(role as (typeof TECHNICAL_RISK_WRITE_ROLES)[number]);
}

export function canReviewTechnicalRisk(role?: string): boolean {
  return TECHNICAL_RISK_REVIEW_ROLES.includes(role as (typeof TECHNICAL_RISK_REVIEW_ROLES)[number]);
}

type StatusTone = 'neutral' | 'info' | 'success' | 'warning';

const ASSESSMENT_STATUS: Record<string, { label: string; tone: StatusTone; symbol: string }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral', symbol: '○' },
  IN_PROGRESS: { label: 'En curso', tone: 'info', symbol: '→' },
  COMPLETED: { label: 'Completada', tone: 'warning', symbol: '✓' },
  REVIEWED: { label: 'Revisada', tone: 'success', symbol: '✓' },
  CANCELED: { label: 'Cancelada', tone: 'neutral', symbol: '—' },
};

export function technicalAssessmentStatusMeta(status: string) {
  return (
    ASSESSMENT_STATUS[status] ?? {
      label: status.toLocaleLowerCase('es').replaceAll('_', ' '),
      tone: 'neutral' as const,
      symbol: '•',
    }
  );
}

const RISK_LABELS: Record<string, string> = {
  LOW: 'Bajo',
  MODERATE: 'Moderado',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
};

export function technicalRiskLabel(level?: string | null): string {
  if (!level) return 'Sin resultado';
  return RISK_LABELS[level] ?? level.toLocaleLowerCase('es').replaceAll('_', ' ');
}

export type TechnicalReviewRecord = {
  decision: string;
  createdAt: string;
  comment?: string;
  reviewer?: { displayName: string };
};

export function latestTechnicalReview(reviews?: TechnicalReviewRecord[]) {
  return reviews?.at(-1);
}

export function technicalReviewState(
  status: string,
  reviews?: TechnicalReviewRecord[],
): { label: string; tone: StatusTone; description: string } {
  const latest = latestTechnicalReview(reviews);
  if (status === 'REVIEWED' && latest?.decision === 'APPROVED') {
    return {
      label: 'Revisión aprobada',
      tone: 'success',
      description: 'Revisada por un usuario autorizado. El resultado técnico no cambió.',
    };
  }
  if (status === 'COMPLETED' && latest?.decision === 'NEEDS_REVISION') {
    return {
      label: 'Revisión: requiere ajustes',
      tone: 'warning',
      description: 'La evaluación permanece completada y requiere una nueva decisión profesional.',
    };
  }
  if (status === 'COMPLETED') {
    return {
      label: 'Revisión pendiente',
      tone: 'warning',
      description: 'La ejecución terminó; todavía no existe una aprobación profesional.',
    };
  }
  return {
    label: 'Revisión no disponible',
    tone: 'neutral',
    description: 'La revisión profesional ocurre después de completar la evaluación.',
  };
}

export function methodSnapshotProvenance(assessment: {
  methodVersion: string;
  methodSnapshot: { methodName: string; isDemo: boolean; disclaimer: string | null };
}) {
  return {
    name: assessment.methodSnapshot.methodName,
    version: assessment.methodVersion,
    isDemo: assessment.methodSnapshot.isDemo,
    disclaimer: assessment.methodSnapshot.disclaimer,
  };
}

export type QuestionControl =
  | 'boolean-radio'
  | 'select'
  | 'integer-input'
  | 'decimal-input'
  | 'textarea'
  | 'likelihood-radio'
  | 'consequence-radio';

export function technicalQuestionControl(question: TechnicalQuestion): QuestionControl {
  switch (question.type) {
    case 'BOOLEAN':
      return 'boolean-radio';
    case 'SINGLE_CHOICE':
      return 'select';
    case 'INTEGER':
      return 'integer-input';
    case 'DECIMAL':
      return 'decimal-input';
    case 'TEXT':
      return 'textarea';
    case 'LIKELIHOOD':
      return 'likelihood-radio';
    case 'CONSEQUENCE':
      return 'consequence-radio';
  }
}

export function technicalQuestionExpectation(question: TechnicalQuestion): string {
  switch (question.type) {
    case 'BOOLEAN':
      return 'Selecciona Sí o No.';
    case 'SINGLE_CHOICE':
      return 'Selecciona una opción disponible.';
    case 'INTEGER':
      return `Ingresa un número entero${numericRange(question.min, question.max)}.`;
    case 'DECIMAL':
      return `Ingresa un número${numericRange(question.min, question.max)}.`;
    case 'TEXT':
      return `Ingresa un texto de hasta ${question.maxLength} caracteres.`;
    case 'LIKELIHOOD':
    case 'CONSEQUENCE':
      return `Selecciona un valor de ${question.min} a ${question.max}.`;
  }
}

export function isTechnicalAnswerValid(question: TechnicalQuestion, value: unknown): boolean {
  switch (question.type) {
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'SINGLE_CHOICE':
      return typeof value === 'string' && question.options.some((option) => option.value === value);
    case 'INTEGER':
      return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        (question.min === undefined || value >= question.min) &&
        (question.max === undefined || value <= question.max)
      );
    case 'DECIMAL':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (question.min === undefined || value >= question.min) &&
        (question.max === undefined || value <= question.max)
      );
    case 'TEXT':
      return typeof value === 'string' && value.length <= question.maxLength;
    case 'LIKELIHOOD':
    case 'CONSEQUENCE':
      return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= question.min &&
        value <= question.max
      );
  }
}

function numericRange(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return ` entre ${min} y ${max}`;
  if (min !== undefined) return ` mayor o igual que ${min}`;
  if (max !== undefined) return ` menor o igual que ${max}`;
  return '';
}

export function technicalAnswerLabel(question: TechnicalQuestion, value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Sin respuesta';
  if (question.type === 'BOOLEAN') return value === true ? 'Sí' : 'No';
  if (question.type === 'SINGLE_CHOICE') {
    return question.options.find((option) => option.value === value)?.label ?? String(value);
  }
  return String(value);
}

export function technicalMutationError(error: unknown): {
  kind: 'stale' | 'permission' | 'request';
  message: string;
} {
  const candidate = error as { status?: number; payload?: { code?: string } };
  if (candidate.status === 409) {
    return {
      kind: 'stale',
      message:
        'Otra persona actualizó esta evaluación. Cargamos el estado vigente; revisa antes de continuar.',
    };
  }
  if (candidate.status === 403) {
    return {
      kind: 'permission',
      message:
        'Tu rol o el plan activo no permiten esta operación. La API mantuvo el registro sin cambios.',
    };
  }
  return {
    kind: 'request',
    message: 'No pudimos completar la operación. Tus respuestas permanecen en este formulario.',
  };
}
