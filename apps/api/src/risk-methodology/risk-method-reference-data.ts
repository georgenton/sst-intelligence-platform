export const RISK_METHOD_REFERENCE_IDS = {
  sources: { CO_GTC45_2010: '51000000-0000-4000-8000-000000000001' },
  sourceVersions: { CO_GTC45_2010: '52000000-0000-4000-8000-000000000001' },
  definitions: {
    DEMO_5X5: '53000000-0000-4000-8000-000000000001',
    GUIDED_5X5: '53000000-0000-4000-8000-000000000002',
    GTC45_2010: '53000000-0000-4000-8000-000000000003',
  },
  versions: {
    DEMO_5X5: '54000000-0000-4000-8000-000000000001',
    GUIDED_5X5: '54000000-0000-4000-8000-000000000002',
    GTC45_2010: '54000000-0000-4000-8000-000000000003',
  },
  sourceLinks: { GTC45_2010: '55000000-0000-4000-8000-000000000001' },
  guidance: { ANITA_GTC45: '56000000-0000-4000-8000-000000000001' },
  contexts: {
    GUIDED_5X5_EC: '57000000-0000-4000-8000-000000000001',
    GTC45_2010_EC: '57000000-0000-4000-8000-000000000002',
  },
} as const;

export const METHODOLOGY_SOURCE_MANIFESTS = [
  {
    sourceKey: 'CO_GTC45_2010',
    sourceVersion: '1.0.0',
    title: 'GTC 45 — guía para identificación de peligros y valoración de riesgos',
    issuer: 'Instituto Colombiano de Normas Técnicas y Certificación (ICONTEC)',
    originCountry: 'CO',
    documentType: 'TECHNICAL_GUIDE',
    edition: 'Primera actualización — 2010-12-15',
    publicationDate: '2010-12-15',
    sourceFingerprint: '99a387729fd3a73a93dbc06a44ac5be0a7eedd8999f26b709c0cbf794f823973',
    sourceStatus: 'USER_PROVIDED_REFERENCE',
    licenseReproductionNote:
      'Referencia técnica con restricciones de reproducción. Conservar solo metadatos, constantes numéricas, etiquetas breves y explicaciones parafraseadas.',
    officialUrl: null,
    reviewStatus: 'PENDING',
    publicationStatus: 'CANDIDATE',
  },
] as const;

export const RISK_METHOD_MANIFESTS = [
  {
    methodKey: 'DEMO_5X5',
    semanticVersion: '1.0.0',
    displayName: 'Matriz demostrativa 5×5 histórica',
    methodKind: 'INSPECTION_FINDING_RISK',
    calculationProviderKey: 'HISTORICAL_DEMO_5X5',
    calculationProviderVersion: '1.0.0',
    inputSchemaVersion: '1.0.0',
    resultSchemaVersion: '1.0.0',
    isDemo: true,
    regulatory: false,
    publicationStatus: 'PUBLISHED',
    technicalReviewStatus: 'PENDING',
    legalReviewStatus: 'NOT_APPLICABLE',
    sourceReferences: [],
    regulatoryContextReferences: [],
    disclaimer:
      'Método histórico demostrativo. No constituye metodología ecuatoriana validada y sus resultados existentes no se recalculan.',
    contentHash: '6fe9d271921d5cc8c9690afc2f55592079c1f4ca28c2a6a04e23e51486919ea2',
  },
  {
    methodKey: 'GUIDED_5X5',
    semanticVersion: '1.0.0',
    displayName: 'Matriz 5×5 guiada',
    methodKind: 'INSPECTION_FINDING_RISK',
    calculationProviderKey: 'GUIDED_5X5',
    calculationProviderVersion: '1.0.0',
    inputSchemaVersion: '1.0.0',
    resultSchemaVersion: '1.0.0',
    isDemo: true,
    regulatory: false,
    publicationStatus: 'CANDIDATE',
    technicalReviewStatus: 'PENDING',
    legalReviewStatus: 'PENDING',
    sourceReferences: [],
    regulatoryContextReferences: ['EC_GUIDED_5X5_CONTEXT'],
    disclaimer:
      'Candidato DEMO sujeto a revisión técnica y legal. Las guías ayudan a justificar una selección humana y no convierten el método en obligación legal.',
    contentHash: '71abca2aef98539e11f52e408fb79555625cf014b4c1e86329c9c0b3e27bdc38',
  },
  {
    methodKey: 'GTC45_2010',
    semanticVersion: '1.0.0',
    displayName: 'GTC 45 — edición 2010',
    methodKind: 'HAZARD_RISK_ASSESSMENT',
    calculationProviderKey: 'GTC45_2010_CANONICAL',
    calculationProviderVersion: '1.0.0',
    inputSchemaVersion: '1.0.0',
    resultSchemaVersion: '1.0.0',
    isDemo: true,
    regulatory: false,
    publicationStatus: 'CANDIDATE',
    technicalReviewStatus: 'PENDING',
    legalReviewStatus: 'PENDING',
    sourceReferences: [{ sourceKey: 'CO_GTC45_2010', sourceVersion: '1.0.0' }],
    regulatoryContextReferences: ['EC_GTC45_2010_CONTEXT'],
    canonicalSpecification: {
      specificationKey: 'GTC45_2010',
      deficiency: [
        { key: 'VERY_HIGH', numericValue: 10 },
        { key: 'HIGH', numericValue: 6 },
        { key: 'MEDIUM', numericValue: 2 },
        {
          key: 'LOW',
          numericValue: null,
          specialHandling: 'DIRECT_RISK_LEVEL_IV_WITHOUT_NUMERIC_ND_NP_NR',
        },
      ],
      exposure: [4, 3, 2, 1],
      consequence: [100, 60, 25, 10],
      probabilityFormula: 'ND_X_NE',
      probabilityBands: [
        { band: 'VERY_HIGH', minimum: 24, maximum: 40 },
        { band: 'HIGH', minimum: 10, maximum: 20 },
        { band: 'MEDIUM', minimum: 6, maximum: 8 },
        { band: 'LOW', minimum: 2, maximum: 4 },
      ],
      riskFormula: 'NP_X_NC',
      interventionLevels: [
        { level: 'I', minimum: 600, maximum: 4000 },
        { level: 'II', minimum: 150, maximum: 500 },
        { level: 'III', minimum: 40, maximum: 120 },
        { level: 'IV', minimum: 20, maximum: 20 },
      ],
      acceptabilityPolicy: 'ORGANIZATION_CRITERIA_REQUIRED',
    },
    disclaimer:
      'Metodología técnica colombiana candidata para revisión. No es ley ecuatoriana ni está aprobada para producción.',
    contentHash: 'e0c5260eccecccca334cfa0f49071eccae1f9f4599d59f4dc237c0e1184d8ffb',
  },
] as const;

export const ANITA_GTC45_GUIDANCE_MANIFEST = {
  guidanceKey: 'ANITA_GUIDANCE_GTC45_V1',
  guidanceVersion: '1.0.0',
  methodKey: 'GTC45_2010',
  methodVersion: '1.0.0',
  authorSource: 'Anita — observación experta proporcionada por el usuario',
  evidenceClassification: 'EXPERT_OBSERVATION',
  reviewStatus: 'PENDING',
  officialUiVerification: 'PENDING',
  helpDefinitions: [
    {
      key: 'SOURCE_CONDITIONS',
      prompt: '¿Qué condición en la fuente del peligro observaste?',
      purpose: 'Ayudar a describir el contexto sin afirmar causa raíz.',
      affectsCanonicalScore: false,
    },
    {
      key: 'MEDIUM_CONDITIONS',
      prompt: '¿Qué condición del ambiente o medio influye en la exposición?',
      purpose: 'Orientar la observación del entorno sin asignar automáticamente ND.',
      affectsCanonicalScore: false,
    },
    {
      key: 'INDIVIDUAL_CONDITIONS',
      prompt: '¿Qué condición individual o de la persona requiere considerar el profesional?',
      purpose: 'Registrar contexto profesional sin atribuir culpa ni diagnóstico.',
      affectsCanonicalScore: false,
    },
    {
      key: 'CONTROL_EFFECTIVENESS',
      prompt: '¿Qué evidencia observaste sobre cobertura y efectividad de controles?',
      purpose: 'Sustentar la selección humana sin reemplazar la valoración canónica.',
      affectsCanonicalScore: false,
    },
    {
      key: 'EVENT_HISTORY',
      prompt: '¿Qué antecedentes de eventos o exposición son relevantes?',
      purpose: 'Conservar hechos observados para la justificación profesional.',
      affectsCanonicalScore: false,
    },
    {
      key: 'RECURRING_FAILURES',
      prompt: '¿Se observaron fallas repetidas que ameritan revisión adicional?',
      purpose: 'Señalar una necesidad de análisis sin confirmar causalidad.',
      affectsCanonicalScore: false,
    },
  ],
  disclaimer: 'Guía candidata. No asigna ND, no prueba causa raíz y no modifica la fórmula GTC45.',
  contentHash: '05f7a52d54e233e3e469c722267a9104a773fcb970f7ad3f68bb6fe1f4c94b77',
} as const;

export const RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS = [
  {
    contextKey: 'EC_GUIDED_5X5_CONTEXT',
    contextVersion: '1.0.0',
    jurisdiction: 'EC',
    methodKey: 'GUIDED_5X5',
    methodVersion: '1.0.0',
    relationship: 'CONTEXT_NOT_LEGAL_ENDORSEMENT',
    regulatorySourceReferences: [
      {
        sourceKey: 'EC_EXECUTIVE_DECREE_255',
        locator: 'Artículo 47 — metodologías reconocidas para identificación y evaluación',
        officialUrl:
          'https://www.trabajo.gob.ec/wp-content/uploads/2024/01/DECRETO-EJECUTIVO-255-REGLAMENTO-DE-SEGURIDAD-Y-SALUD-DE-LOS-TRABAJADORES.pdf',
        reviewStatus: 'PENDING',
      },
      {
        sourceKey: 'EC_MDT_2024_196_ANNEX_1',
        locator: 'Lista de verificación SST — metodología reconocida/validada y riesgo residual',
        officialUrl:
          'https://www.trabajo.gob.ec/wp-content/uploads/2025/04/Anexo-1_Lista-de-Verificacion-SST-signed-signed_08042025.pdf',
        reviewStatus: 'PENDING',
      },
    ],
    statement:
      'Una matriz 5×5 organizacional requiere reconocimiento y validación aplicables. Este candidato genérico no es un método oficial ecuatoriano.',
    technicalReviewStatus: 'PENDING',
    legalReviewStatus: 'PENDING',
    officialSutMethodOptions: 'PENDING',
    contentHash: '10d3c058c8c7dac180a49f95af42f7933cbd3fb7ac525c54ccee92b15f6dbe8e',
  },
  {
    contextKey: 'EC_GTC45_2010_CONTEXT',
    contextVersion: '1.0.0',
    jurisdiction: 'EC',
    methodKey: 'GTC45_2010',
    methodVersion: '1.0.0',
    relationship: 'CONTEXT_NOT_LEGAL_ENDORSEMENT',
    regulatorySourceReferences: [
      {
        sourceKey: 'EC_EXECUTIVE_DECREE_255',
        locator: 'Artículo 47 — metodologías reconocidas para identificación y evaluación',
        officialUrl:
          'https://www.trabajo.gob.ec/wp-content/uploads/2024/01/DECRETO-EJECUTIVO-255-REGLAMENTO-DE-SEGURIDAD-Y-SALUD-DE-LOS-TRABAJADORES.pdf',
        reviewStatus: 'PENDING',
      },
      {
        sourceKey: 'EC_MDT_2024_196_ANNEX_1',
        locator: 'Lista de verificación SST — metodología reconocida/validada y riesgo residual',
        officialUrl:
          'https://www.trabajo.gob.ec/wp-content/uploads/2025/04/Anexo-1_Lista-de-Verificacion-SST-signed-signed_08042025.pdf',
        reviewStatus: 'PENDING',
      },
    ],
    statement:
      'Ecuador exige usar metodologías reconocidas para identificar y evaluar riesgos. Esta relación contextual no demuestra que Ecuador haya adoptado o exigido GTC45.',
    technicalReviewStatus: 'PENDING',
    legalReviewStatus: 'PENDING',
    officialSutMethodOptions: 'PENDING',
    contentHash: '30671198a28ed31289cebe64d533ece772abb962cd524b87f6ef93f75d354e0c',
  },
] as const;
