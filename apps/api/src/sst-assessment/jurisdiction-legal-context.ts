import {
  normalizeJurisdictionCode,
  type SstAssessmentQuestion,
  type SstAssessmentQuestionLegalBasis,
  type SstAssessmentSnapshot,
} from '@sst/contracts';

const MDT_2024_196 = {
  sourceKey: 'EC_MDT_2024_196',
  sourceVersionId: 'a2000000-0000-4000-8000-000000000012',
  title: 'Acuerdo Ministerial Nro. MDT-2024-196',
  issuer: 'Ministerio del Trabajo',
  referenceNumber: 'MDT-2024-196',
  officialUrl:
    'https://www.trabajo.gob.ec/wp-content/uploads/2024/10/ACUERDO-MINISTERIAL-NRO.-MDT-2024-196-signed.pdf',
  officialDocumentSha256: 'sha256:4fe2da2ddf2b730c0c9e56e321d5a817f94b98d6d9f9e02bb97c18f2cc47473d',
} as const;

const MDT_2024_196_ANNEX_3 = {
  sourceKey: 'EC_MDT_2024_196_ANNEX_3',
  sourceVersionId: 'a2000000-0000-4000-8000-000000000015',
  title: 'Anexo 3 — Norma Técnica de Seguridad e Higiene en el Trabajo',
  issuer: 'Ministerio del Trabajo',
  referenceNumber: 'MDT-2024-196-ANEXO-3',
  officialUrl:
    'https://www.trabajo.gob.ec/wp-content/uploads/2024/11/Anexo-3_Norma-Tecnica-de-Seguridad-e-Higiene-del-Trabajo-signed-signed-signed-signed.pdf',
  officialDocumentSha256: 'sha256:d588c7b8e0dadf68dc5b06763a6dbf80e445ee5b55c7972ae063e56228e27ddc',
} as const;

const HEADCOUNT_UNITS = [
  { id: 'cf6e2ac7-9468-4961-871e-00df51c091a8', locator: 'Artículo 18 · página 16' },
  { id: 'a94e7382-be6f-4773-82fa-4c080ace38ed', locator: 'Artículo 19 · páginas 16–17' },
  { id: '4881a467-def6-4a34-85e9-edca244fa749', locator: 'Artículo 20 · páginas 17–18' },
] as const;

const CENTER_HEADCOUNT_UNITS = [
  { id: '9ba2338a-da1b-47f0-8133-a9e68eba8bac', locator: 'Artículo 13 · páginas 13–14' },
] as const;

const ELECTRICAL_UNITS = Array.from({ length: 9 }, (_, index) => ({
  id: `c3000000-0000-4000-8000-000000000${String(index + 101).padStart(3, '0')}`,
  locator: `Art. ${index + 82}`,
}));

function source(
  metadata: typeof MDT_2024_196 | typeof MDT_2024_196_ANNEX_3,
  units: readonly { id: string; locator: string }[],
) {
  return {
    ...metadata,
    unitIds: units.map(({ id }) => id),
    unitLocators: units.map(({ locator }) => locator),
  };
}

function knownCountry(snapshot: SstAssessmentSnapshot) {
  const fact = snapshot.facts.find(
    (item) => item.scopeKey === 'organization' && item.factKey === 'organization.country',
  );
  return fact?.answerState === 'KNOWN' ? normalizeJurisdictionCode(fact.value) : null;
}

function basis(
  jurisdictionCode: string,
  status: SstAssessmentQuestionLegalBasis['status'],
  explanation: string,
  sources: SstAssessmentQuestionLegalBasis['sources'] = [],
): SstAssessmentQuestionLegalBasis {
  return { jurisdictionCode, status, explanation, sources };
}

export function resolveAssessmentQuestionLegalBasis(
  snapshot: SstAssessmentSnapshot,
  question: Pick<SstAssessmentQuestion, 'factKey' | 'scopeKey'>,
): SstAssessmentQuestionLegalBasis {
  const jurisdictionCode = knownCountry(snapshot);
  if (!jurisdictionCode) {
    return basis(
      'UNKNOWN',
      'CONTEXT_REQUIRED',
      'Confirma el país para mostrar el fundamento legal correspondiente.',
    );
  }
  if (jurisdictionCode !== 'EC') {
    return basis(
      jurisdictionCode,
      'JURISDICTION_NOT_SUPPORTED',
      `La evaluación operativa puede continuar, pero todavía no disponemos de cobertura normativa verificada para ${jurisdictionCode === 'CO' ? 'Colombia' : 'esta jurisdicción'}. No utilizaremos normas de otro país.`,
    );
  }

  if (question.factKey === 'organization.totalWorkerCount') {
    return basis(
      jurisdictionCode,
      'VERIFIED',
      'La norma diferencia las obligaciones de registro y gestión SST según la cantidad de trabajadores: 1 a 10 y más de 10. El Art. 20 establece además las vigencias correspondientes.',
      [source(MDT_2024_196, HEADCOUNT_UNITS)],
    );
  }
  if (question.factKey === 'workCenter.workerCount') {
    return basis(
      jurisdictionCode,
      'VERIFIED',
      'La cantidad de personas de este centro participa en la determinación de la gestión preventiva requerida. El Art. 13 también fija horas mínimas de gestión según la clasificación y el nivel de riesgo; aquí no calculamos ese límite porque faltan otros datos.',
      [source(MDT_2024_196, CENTER_HEADCOUNT_UNITS)],
    );
  }
  if (question.factKey === 'workCenter.hasElectricalWorkOrExposure') {
    return basis(
      jurisdictionCode,
      'VERIFIED',
      'Esta pregunta funciona como un cribado de aplicabilidad para revisar el Capítulo III del Anexo 3 cuando existe exposición eléctrica. No determina por sí sola una obligación ni un incumplimiento.',
      [source(MDT_2024_196_ANNEX_3, ELECTRICAL_UNITS)],
    );
  }
  if (question.factKey === 'workCenter.highEnergySourceTypes') {
    const highEnergy = snapshot.facts.find(
      (fact) =>
        fact.scopeKey === question.scopeKey &&
        fact.factKey === 'workCenter.hasHighEnergyOperations' &&
        fact.answerState === 'KNOWN' &&
        fact.value === true,
    );
    const sourceTypes = snapshot.facts.find(
      (fact) => fact.scopeKey === question.scopeKey && fact.factKey === question.factKey,
    );
    const electricalConfirmed =
      sourceTypes?.answerState === 'KNOWN' &&
      Array.isArray(sourceTypes.value) &&
      sourceTypes.value.includes('ELECTRICAL');
    if (highEnergy && !electricalConfirmed) {
      return basis(
        jurisdictionCode,
        'CONTEXT_REQUIRED',
        'Necesitamos confirmar el tipo de fuente de alta energía antes de determinar qué fundamento corresponde.',
      );
    }
    if (electricalConfirmed) {
      return basis(
        jurisdictionCode,
        'VERIFIED',
        'Con la fuente eléctrica confirmada, el Anexo 3 ofrece el fundamento técnico y legal relacionado con este cribado.',
        [source(MDT_2024_196_ANNEX_3, ELECTRICAL_UNITS)],
      );
    }
  }
  return basis(
    jurisdictionCode,
    'NO_DIRECT_LEGAL_BASIS',
    'Esta pregunta aporta contexto operativo para orientar la evaluación; no representa por sí sola una obligación legal.',
  );
}

export function enrichAssessmentQuestions(
  snapshot: SstAssessmentSnapshot,
  questions: readonly SstAssessmentQuestion[],
) {
  return questions.map((question) => ({
    ...question,
    // Resolve on every response so a country change cannot leave a stale
    // Ecuador source attached to a question now outside that jurisdiction.
    legalBasis: resolveAssessmentQuestionLegalBasis(snapshot, question),
  }));
}
