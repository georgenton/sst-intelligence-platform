import { adaptiveContentHash, type InspectionDomainKey } from '@sst/contracts';

type CriterionManifest = {
  id: string;
  code: string;
  title: string;
  guidance: string;
  evidenceExpectation?: string;
  sourceLocator?: string;
  displayOrder: number;
  notApplicableAllowed: boolean;
  required: boolean;
};

type StandardManifest = {
  source: {
    id: string;
    code: string;
    name: string;
    publisher: string;
    originCountry?: string;
    referenceUrl?: string;
    rightsType?: 'DEMO_SYNTHETIC' | 'PUBLIC_OFFICIAL' | 'REFERENCE_ONLY';
  };
  version: {
    id: string;
    versionCode: string;
    editionLabel: string;
    domain: InspectionDomainKey;
    status?: 'DRAFT' | 'AVAILABLE';
    metadata?: Record<string, unknown>;
  };
  section: { id: string; code: string; title: string; displayOrder: number };
  criteria: CriterionManifest[];
};

const DEMO_INSPECTION_STANDARD_MANIFESTS: StandardManifest[] = [
  {
    source: {
      id: '57000000-0000-4000-8000-000000000001',
      code: 'DEMO_ELECTRICAL_STANDARD_A',
      name: 'Demo Electrical Standard A',
      publisher: 'SST Intelligence · contenido sintético',
    },
    version: {
      id: '57100000-0000-4000-8000-000000000001',
      versionCode: '1.0.0',
      editionLabel: 'Versión demo 1',
      domain: 'ELECTRICAL',
    },
    section: {
      id: '57200000-0000-4000-8000-000000000001',
      code: 'GENERAL',
      title: 'Condición general de instalaciones',
      displayOrder: 1,
    },
    criteria: [
      {
        id: '57300000-0000-4000-8000-000000000001',
        code: 'A-PANEL-CLOSURE',
        title: 'Los cerramientos de tableros permanecen completos y cerrados durante la operación.',
        guidance:
          'Observe integridad física, cierre y acceso controlado sin interpretar requisitos legales.',
        evidenceExpectation: 'Nota de campo o referencia fotográfica interna.',
        displayOrder: 1,
        notApplicableAllowed: false,
        required: true,
      },
      {
        id: '57300000-0000-4000-8000-000000000002',
        code: 'A-IDENTIFICATION',
        title:
          'Los circuitos y controles inspeccionados cuentan con identificación operativa legible.',
        guidance: 'Compare la identificación visible con el uso observado en el área.',
        displayOrder: 2,
        notApplicableAllowed: true,
        required: true,
      },
      {
        id: '57300000-0000-4000-8000-000000000003',
        code: 'A-VISIBLE-CONDITION',
        title: 'Los elementos visibles no presentan daño, calentamiento o conexiones expuestas.',
        guidance:
          'Registre únicamente condiciones observables y detenga el recorrido si existe peligro inmediato.',
        displayOrder: 3,
        notApplicableAllowed: false,
        required: true,
      },
      {
        id: '57300000-0000-4000-8000-000000000004',
        code: 'A-ACCESS',
        title: 'El acceso operativo al equipo inspeccionado permanece despejado.',
        guidance: 'Documente obstáculos observados sin convertir la conclusión en certificación.',
        displayOrder: 4,
        notApplicableAllowed: true,
        required: false,
      },
    ],
  },
  {
    source: {
      id: '57000000-0000-4000-8000-000000000002',
      code: 'DEMO_ELECTRICAL_STANDARD_B',
      name: 'Demo Electrical Standard B',
      publisher: 'SST Intelligence · contenido sintético',
    },
    version: {
      id: '57100000-0000-4000-8000-000000000002',
      versionCode: '1.0.0',
      editionLabel: 'Versión demo 1',
      domain: 'ELECTRICAL',
    },
    section: {
      id: '57200000-0000-4000-8000-000000000002',
      code: 'OPERATIONAL-READINESS',
      title: 'Preparación operacional',
      displayOrder: 1,
    },
    criteria: [
      {
        id: '57300000-0000-4000-8000-000000000011',
        code: 'B-ISOLATION-REFERENCE',
        title:
          'El equipo observado dispone de una referencia interna para su aislamiento operativo.',
        guidance:
          'Verifique que el equipo pueda relacionarse con el procedimiento interno aplicable.',
        displayOrder: 1,
        notApplicableAllowed: true,
        required: true,
      },
      {
        id: '57300000-0000-4000-8000-000000000012',
        code: 'B-ENVIRONMENT',
        title: 'El entorno inmediato no introduce humedad, acumulación o interferencias visibles.',
        guidance: 'Describa la condición ambiental puntual y su ubicación.',
        displayOrder: 2,
        notApplicableAllowed: false,
        required: true,
      },
      {
        id: '57300000-0000-4000-8000-000000000013',
        code: 'B-CHANGE-CONTROL',
        title: 'Las modificaciones visibles cuentan con una referencia interna de revisión.',
        guidance: 'Solicite el identificador interno; no infiera aprobación si no está disponible.',
        displayOrder: 3,
        notApplicableAllowed: true,
        required: true,
      },
    ],
  },
  {
    source: {
      id: '57000000-0000-4000-8000-000000000003',
      code: 'DEMO_FIRE_STANDARD_A',
      name: 'Demo Fire Standard A',
      publisher: 'SST Intelligence · contenido sintético',
    },
    version: {
      id: '57100000-0000-4000-8000-000000000003',
      versionCode: '1.0.0',
      editionLabel: 'Versión demo 1',
      domain: 'FIRE_PROTECTION',
    },
    section: {
      id: '57200000-0000-4000-8000-000000000003',
      code: 'VISIBLE-READINESS',
      title: 'Disponibilidad visible de controles',
      displayOrder: 1,
    },
    criteria: [
      {
        id: '57300000-0000-4000-8000-000000000021',
        code: 'F-ACCESS',
        title: 'Los controles de respuesta observados permanecen accesibles y sin obstrucciones.',
        guidance: 'Registre la ubicación y cualquier obstrucción puntual.',
        displayOrder: 1,
        notApplicableAllowed: false,
        required: true,
      },
      {
        id: '57300000-0000-4000-8000-000000000022',
        code: 'F-IDENTIFICATION',
        title: 'La identificación operativa de los controles observados es legible.',
        guidance: 'Describa la señal visible sin emitir una certificación.',
        displayOrder: 2,
        notApplicableAllowed: true,
        required: true,
      },
      {
        id: '57300000-0000-4000-8000-000000000023',
        code: 'F-INTERNAL-CHECK',
        title: 'Existe una referencia interna de la revisión periódica del control observado.',
        guidance: 'Capture el identificador o indique que no fue verificado.',
        displayOrder: 3,
        notApplicableAllowed: true,
        required: true,
      },
    ],
  },
];

const OFFICIAL_INSPECTION_SOURCE_PILOTS: StandardManifest[] = [
  {
    source: {
      id: '57400000-0000-4000-8000-000000000001',
      code: 'PILOT_RETIE_CO_2026',
      name: 'RETIE · piloto técnico · pendiente de revisión profesional',
      publisher: 'Ministerio de Minas y Energía de Colombia',
      originCountry: 'Colombia (CO)',
      referenceUrl:
        'https://minenergia.gov.co/es/misional/energia-electrica-2/reglamentos-tecnicos/reglamento-t%C3%A9cnico-de-instalaciones-el%C3%A9ctricas-retie/',
      rightsType: 'PUBLIC_OFFICIAL',
    },
    version: {
      id: '57500000-0000-4000-8000-000000000001',
      versionCode: 'RES-40284-2026-PILOT-1',
      editionLabel: 'Resolución 40284 de 2026 · piloto',
      domain: 'ELECTRICAL',
      metadata: {
        pilot: true,
        jurisdictionCode: 'CO',
        officialTitle: 'Reglamento Técnico de Instalaciones Eléctricas — RETIE',
        officialModification: 'Resolución 40284 del 23 de junio de 2026',
        officialModificationDate: '2026-06-23',
        sourceNature: 'FOREIGN_TECHNICAL_REGULATION_REFERENCE',
        officialStructure: 'FOUR_BOOKS',
        professionalReview: 'PENDING_ANITA',
        applicabilityBoundary: 'NOT_ECUADORIAN_LAW',
        reuseBoundary: 'PLATFORM_AUTHORED_CRITERIA_ONLY',
        criterionWording: 'PLATFORM_AUTHORED_NOT_OFFICIAL_QUOTATION',
      },
    },
    section: {
      id: '57600000-0000-4000-8000-000000000001',
      code: 'PILOT-VISUAL',
      title: 'Piloto visual acotado · requiere revisión profesional',
      displayOrder: 1,
    },
    criteria: [
      {
        id: '57700000-0000-4000-8000-000000000001',
        code: 'RETIE-PILOT-ENCLOSURE',
        title:
          'Los cerramientos eléctricos observados permanecen íntegros y sin partes energizadas expuestas.',
        guidance:
          'Registre únicamente la condición visible. Este criterio piloto no certifica RETIE ni aplicabilidad en Ecuador.',
        evidenceExpectation: 'Nota o evidencia visual interna de la condición observada.',
        sourceLocator:
          'Página oficial RETIE · Resolución 40284 del 23 de junio de 2026 · criterio original de la plataforma',
        displayOrder: 1,
        notApplicableAllowed: false,
        required: true,
      },
      {
        id: '57700000-0000-4000-8000-000000000002',
        code: 'RETIE-PILOT-IDENTIFICATION',
        title:
          'La identificación operativa visible permite relacionar el equipo con su función declarada.',
        guidance:
          'Compare únicamente la identificación y el uso observado; no emita una declaración de cumplimiento.',
        sourceLocator:
          'Página oficial RETIE · Resolución 40284 del 23 de junio de 2026 · Libro 3 como referencia general · criterio original de la plataforma',
        displayOrder: 2,
        notApplicableAllowed: true,
        required: true,
      },
    ],
  },
  {
    source: {
      id: '57400000-0000-4000-8000-000000000002',
      code: 'PILOT_REBT_ES_2002',
      name: 'REBT · Real Decreto 842/2002 · piloto técnico · pendiente de revisión profesional',
      publisher: 'Boletín Oficial del Estado · España',
      originCountry: 'España (ES)',
      referenceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-18099',
      rightsType: 'PUBLIC_OFFICIAL',
    },
    version: {
      id: '57500000-0000-4000-8000-000000000002',
      versionCode: 'BOE-A-2002-18099-CONSOLIDATED-PILOT-1',
      editionLabel: 'Texto consolidado informativo · piloto',
      domain: 'ELECTRICAL',
      metadata: {
        pilot: true,
        jurisdictionCode: 'ES',
        officialTitle:
          'Real Decreto 842/2002, de 2 de agosto, por el que se aprueba el Reglamento electrotécnico para baja tensión',
        officialIdentifier: 'BOE-A-2002-18099',
        officialPublication: 'BOE núm. 224, 18 de septiembre de 2002',
        sourceNature: 'FOREIGN_TECHNICAL_REGULATION_REFERENCE',
        consolidationNature: 'INFORMATIONAL',
        consolidatedRevisionPublished: '2025-09-03',
        professionalReview: 'PENDING_ANITA',
        applicabilityBoundary: 'NOT_ECUADORIAN_LAW',
        reuseBoundary: 'PLATFORM_AUTHORED_CRITERIA_ONLY',
        criterionWording: 'PLATFORM_AUTHORED_NOT_OFFICIAL_QUOTATION',
      },
    },
    section: {
      id: '57600000-0000-4000-8000-000000000002',
      code: 'PILOT-VISUAL',
      title: 'Piloto visual acotado · requiere revisión profesional',
      displayOrder: 1,
    },
    criteria: [
      {
        id: '57700000-0000-4000-8000-000000000011',
        code: 'REBT-PILOT-PROTECTION',
        title:
          'Los dispositivos de protección observados están identificados y accesibles para la operación autorizada.',
        guidance:
          'Documente identificación y accesibilidad sin declarar conformidad con la normativa española.',
        sourceLocator:
          'BOE-A-2002-18099 · texto consolidado informativo · criterio original de la plataforma',
        displayOrder: 1,
        notApplicableAllowed: true,
        required: true,
      },
      {
        id: '57700000-0000-4000-8000-000000000012',
        code: 'REBT-PILOT-VISIBLE-DAMAGE',
        title:
          'Los elementos eléctricos visibles no presentan daño material evidente durante el recorrido.',
        guidance:
          'Registre la observación y derive cualquier valoración al flujo profesional de hallazgos.',
        sourceLocator:
          'BOE-A-2002-18099 · texto consolidado informativo · criterio original de la plataforma',
        displayOrder: 2,
        notApplicableAllowed: false,
        required: true,
      },
    ],
  },
  {
    source: {
      id: '57400000-0000-4000-8000-000000000003',
      code: 'PILOT_RTQ_EC_UIO_2026',
      name: 'Reglas Técnicas Metropolitanas de Quito · piloto técnico · pendiente de revisión profesional',
      publisher: 'Cuerpo de Bomberos del Distrito Metropolitano de Quito',
      originCountry: 'Distrito Metropolitano de Quito (EC-UIO)',
      referenceUrl:
        'https://www.bomberosquito.gob.ec/prevencion-y-seguridad-contra-incendios/normativa-tecnica/',
      rightsType: 'PUBLIC_OFFICIAL',
    },
    version: {
      id: '57500000-0000-4000-8000-000000000003',
      versionCode: 'RTQ1-2026-PILOT-1',
      editionLabel: 'RTQ 1 · piloto metropolitano',
      domain: 'FIRE_PROTECTION',
      metadata: {
        pilot: true,
        jurisdictionCode: 'EC-UIO',
        officialAuthority: 'Cuerpo de Bomberos del Distrito Metropolitano de Quito',
        officialResolution: 'Resolución ADMQ 017-2026 del 09 de julio de 2026',
        sourceNature: 'LOCAL_OFFICIAL_REGULATION_REFERENCE',
        professionalReview: 'PENDING_ANITA',
        applicabilityBoundary: 'USER_CONFIGURED_QUITO_CONTEXT_ONLY',
        reuseBoundary: 'PLATFORM_AUTHORED_CRITERIA_ONLY',
        criterionWording: 'PLATFORM_AUTHORED_NOT_OFFICIAL_QUOTATION',
      },
    },
    section: {
      id: '57600000-0000-4000-8000-000000000003',
      code: 'PILOT-FIRE',
      title: 'Piloto de prevención visible · requiere revisión profesional',
      displayOrder: 1,
    },
    criteria: [
      {
        id: '57700000-0000-4000-8000-000000000021',
        code: 'RTQ1-PILOT-ACCESS',
        title:
          'Los controles de respuesta observados mantienen acceso visible y sin obstrucciones.',
        guidance:
          'Registre el estado puntual. La fuente se configura solo como contexto del Distrito Metropolitano de Quito.',
        sourceLocator:
          'Cuerpo de Bomberos del Distrito Metropolitano de Quito · Normativa Técnica · RTQ 1 · criterio original de la plataforma',
        displayOrder: 1,
        notApplicableAllowed: false,
        required: true,
      },
    ],
  },
  {
    source: {
      id: '57400000-0000-4000-8000-000000000003',
      code: 'PILOT_RTQ_EC_UIO_2026',
      name: 'Reglas Técnicas Metropolitanas de Quito · piloto técnico · pendiente de revisión profesional',
      publisher: 'Cuerpo de Bomberos del Distrito Metropolitano de Quito',
      originCountry: 'Distrito Metropolitano de Quito (EC-UIO)',
      referenceUrl:
        'https://www.bomberosquito.gob.ec/prevencion-y-seguridad-contra-incendios/normativa-tecnica/',
      rightsType: 'PUBLIC_OFFICIAL',
    },
    version: {
      id: '57500000-0000-4000-8000-000000000004',
      versionCode: 'RTQ4-2026-PILOT-1',
      editionLabel: 'RTQ 4 · materiales peligrosos · piloto',
      domain: 'CHEMICAL_STORAGE',
      metadata: {
        pilot: true,
        jurisdictionCode: 'EC-UIO',
        officialAuthority: 'Cuerpo de Bomberos del Distrito Metropolitano de Quito',
        officialResolution: 'Resolución ADMQ 017-2026 del 09 de julio de 2026',
        sourceNature: 'LOCAL_OFFICIAL_REGULATION_REFERENCE',
        professionalReview: 'PENDING_ANITA',
        applicabilityBoundary: 'USER_CONFIGURED_QUITO_CONTEXT_ONLY',
        reuseBoundary: 'PLATFORM_AUTHORED_CRITERIA_ONLY',
        criterionWording: 'PLATFORM_AUTHORED_NOT_OFFICIAL_QUOTATION',
      },
    },
    section: {
      id: '57600000-0000-4000-8000-000000000004',
      code: 'PILOT-HAZMAT',
      title: 'Piloto de almacenamiento visible · requiere revisión profesional',
      displayOrder: 1,
    },
    criteria: [
      {
        id: '57700000-0000-4000-8000-000000000031',
        code: 'RTQ4-PILOT-IDENTIFICATION',
        title:
          'Las áreas observadas para materiales peligrosos cuentan con identificación operativa visible.',
        guidance:
          'Documente la señalización observada sin generalizar la regla metropolitana fuera de Quito.',
        sourceLocator:
          'Cuerpo de Bomberos del Distrito Metropolitano de Quito · Normativa Técnica · RTQ 4 · criterio original de la plataforma',
        displayOrder: 1,
        notApplicableAllowed: true,
        required: true,
      },
    ],
  },
  {
    source: {
      id: '57400000-0000-4000-8000-000000000004',
      code: 'PILOT_CLP_EU_1272_2008',
      name: 'CLP · Regulation (EC) 1272/2008 · metadata',
      publisher: 'European Union · EUR-Lex',
      originCountry: 'European Union (EU)',
      referenceUrl: 'https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32008R1272',
      rightsType: 'PUBLIC_OFFICIAL',
    },
    version: {
      id: '57500000-0000-4000-8000-000000000005',
      versionCode: 'CELEX-32008R1272-METADATA-1',
      editionLabel: 'Referencia consolidada · metadata only',
      domain: 'CHEMICAL_STORAGE',
      status: 'DRAFT',
      metadata: {
        pilot: true,
        jurisdictionCode: 'EU',
        officialTitle:
          'Regulation (EC) No 1272/2008 on classification, labelling and packaging of substances and mixtures',
        officialIdentifier: 'CELEX 32008R1272',
        sourceNature: 'FOREIGN_REGULATION_REFERENCE',
        pilotScope: 'METADATA_ONLY',
        professionalReview: 'PENDING_ANITA',
        applicabilityBoundary: 'NOT_ECUADORIAN_LAW',
        reuseBoundary: 'NO_FULL_TEXT_STORED',
      },
    },
    section: {
      id: '57600000-0000-4000-8000-000000000005',
      code: 'METADATA-ONLY',
      title: 'Referencia sin criterios ejecutables',
      displayOrder: 1,
    },
    criteria: [],
  },
  {
    source: {
      id: '57400000-0000-4000-8000-000000000005',
      code: 'REFERENCE_NFPA_70E_2024',
      name: 'NFPA 70E · referencia bibliográfica',
      publisher: 'National Fire Protection Association',
      originCountry: 'United States (US)',
      referenceUrl: 'https://link.nfpa.org/all-publications/70E/2024',
      rightsType: 'REFERENCE_ONLY',
    },
    version: {
      id: '57500000-0000-4000-8000-000000000006',
      versionCode: 'NFPA-70E-2024-REFERENCE-ONLY',
      editionLabel: 'NFPA 70E · edición 2024 · referencia sin contenido',
      domain: 'ELECTRICAL',
      status: 'DRAFT',
      metadata: {
        pilot: false,
        jurisdictionCode: 'US',
        sourceNature: 'PROPRIETARY_STANDARD_REFERENCE',
        pilotScope: 'METADATA_ONLY',
        professionalReview: 'NOT_REQUESTED',
        applicabilityBoundary: 'NOT_ECUADORIAN_LAW',
        reuseBoundary: 'NO_COPYRIGHTED_TEXT_STORED',
      },
    },
    section: {
      id: '57600000-0000-4000-8000-000000000006',
      code: 'METADATA-ONLY',
      title: 'Referencia sin criterios ni texto normativo',
      displayOrder: 1,
    },
    criteria: [],
  },
];

export const INSPECTION_STANDARD_MANIFESTS: StandardManifest[] = [
  ...DEMO_INSPECTION_STANDARD_MANIFESTS,
  ...OFFICIAL_INSPECTION_SOURCE_PILOTS,
];

export function inspectionStandardManifestDigest(manifest: StandardManifest) {
  return adaptiveContentHash({
    sourceCode: manifest.source.code,
    version: manifest.version,
    section: manifest.section,
    criteria: manifest.criteria.map(({ id: _id, ...criterion }) => criterion),
  });
}
