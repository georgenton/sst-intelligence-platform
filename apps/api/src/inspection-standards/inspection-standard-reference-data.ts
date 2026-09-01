import { adaptiveContentHash, type InspectionDomainKey } from '@sst/contracts';

type CriterionManifest = {
  id: string;
  code: string;
  title: string;
  guidance: string;
  evidenceExpectation?: string;
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
  };
  version: {
    id: string;
    versionCode: string;
    editionLabel: string;
    domain: InspectionDomainKey;
  };
  section: { id: string; code: string; title: string; displayOrder: number };
  criteria: CriterionManifest[];
};

export const INSPECTION_STANDARD_MANIFESTS: StandardManifest[] = [
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

export function inspectionStandardManifestDigest(manifest: StandardManifest) {
  return adaptiveContentHash({
    sourceCode: manifest.source.code,
    version: manifest.version,
    section: manifest.section,
    criteria: manifest.criteria.map(({ id: _id, ...criterion }) => criterion),
  });
}
