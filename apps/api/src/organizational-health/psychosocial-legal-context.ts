import { normalizeJurisdictionCode } from '@sst/contracts';

export type PsychosocialLegalContextStatus =
  | 'VERIFIED_CONTEXT'
  | 'NO_DIRECT_LEGAL_BASIS'
  | 'CONTEXT_REQUIRED'
  | 'JURISDICTION_NOT_SUPPORTED';

export type PsychosocialLegalContext = {
  status: PsychosocialLegalContextStatus;
  jurisdictionCode: string;
  totalWorkerCount: number | null;
  explanation: string;
  source?: {
    sourceKey: string;
    sourceVersionId: string;
    title: string;
    issuer: string;
    officialUrl: string | null;
    unitIds: string[];
    unitLocators: string[];
  };
};

const MDT_SOURCE = {
  sourceKey: 'EC_MDT_2024_196',
  sourceVersionId: 'a2000000-0000-4000-8000-000000000012',
  title: 'Acuerdo Ministerial Nro. MDT-2024-196',
  issuer: 'Ministerio del Trabajo',
  officialUrl:
    'https://www.trabajo.gob.ec/wp-content/uploads/2024/10/ACUERDO-MINISTERIAL-NRO.-MDT-2024-196-signed.pdf',
  unitIds: [
    'a94e7382-be6f-4773-82fa-4c080ace38ed',
    '4881a467-def6-4a34-85e9-edca244fa749',
  ],
  unitLocators: ['Artículo 19 · páginas 16–17', 'Artículo 20 · páginas 17–18'],
} as const;

export function resolvePsychosocialLegalContext(input: {
  country: unknown;
  totalWorkerCount?: unknown;
  sourceAvailable?: boolean;
}): PsychosocialLegalContext {
  const jurisdictionCode = normalizeJurisdictionCode(input.country) ?? 'UNKNOWN';
  const totalWorkerCount =
    typeof input.totalWorkerCount === 'number' &&
    Number.isInteger(input.totalWorkerCount) &&
    input.totalWorkerCount >= 1
      ? input.totalWorkerCount
      : null;

  if (jurisdictionCode !== 'EC') {
    return {
      status: jurisdictionCode === 'UNKNOWN' ? 'CONTEXT_REQUIRED' : 'JURISDICTION_NOT_SUPPORTED',
      jurisdictionCode,
      totalWorkerCount,
      explanation:
        jurisdictionCode === 'UNKNOWN'
          ? 'Necesitamos confirmar la jurisdicción y el número total de trabajadores para mostrar el fundamento legal correspondiente.'
          : `La gestión operativa puede continuar, pero todavía no disponemos de cobertura normativa verificada para ${jurisdictionCode === 'CO' ? 'Colombia' : 'esta jurisdicción'}. No utilizaremos normas de otro país.`,
    };
  }

  if (totalWorkerCount === null) {
    return {
      status: 'CONTEXT_REQUIRED',
      jurisdictionCode,
      totalWorkerCount,
      explanation:
        'Necesitamos confirmar el número total de trabajadores para mostrar el fundamento legal correspondiente.',
    };
  }

  if (totalWorkerCount <= 10) {
    return {
      status: 'NO_DIRECT_LEGAL_BASIS',
      jurisdictionCode,
      totalWorkerCount,
      explanation:
        'Con el número total de trabajadores registrado no mostramos el Artículo 19 como obligación aplicable. La coordinación preventiva puede continuar.',
    };
  }

  if (!input.sourceAvailable) {
    return {
      status: 'CONTEXT_REQUIRED',
      jurisdictionCode,
      totalWorkerCount,
      explanation:
        'El contexto de trabajadores está confirmado, pero la fuente legal canónica no está disponible para mostrar un fundamento verificable.',
    };
  }

  return {
    status: 'VERIFIED_CONTEXT',
    jurisdictionCode,
    totalWorkerCount,
    explanation:
      'Para una organización ecuatoriana con más de 10 trabajadores, este contexto permite mostrar MDT-2024-196 como fundamento relacionado. No activa reglas ni determina cumplimiento automáticamente.',
    source: { ...MDT_SOURCE, unitIds: [...MDT_SOURCE.unitIds], unitLocators: [...MDT_SOURCE.unitLocators] },
  };
}

