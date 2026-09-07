import { inspectionResourceManifestDigest, type InspectionResourceManifest } from '@sst/contracts';

const resourceNames = {
  MINOR: [
    ['OUTLET', 'Tomacorriente'],
    ['PLUG', 'Enchufe'],
    ['EXTENSION', 'Extensión'],
    ['POWER_STRIP', 'Regleta'],
    ['VISIBLE_CABLE', 'Cable visible'],
    ['LUMINAIRE', 'Luminaria'],
    ['SMALL_EQUIPMENT', 'Equipo menor'],
  ],
  MAJOR: [
    ['PANEL', 'Tablero'],
    ['BREAKERS', 'Interruptores y protecciones'],
    ['WIRING', 'Cableado'],
    ['CONDUITS', 'Canalizaciones'],
    ['GROUNDING', 'Puesta a tierra'],
    ['TRANSFORMER', 'Transformador'],
    ['ELECTRICAL_ROOM', 'Cuarto eléctrico'],
  ],
  INDUSTRIAL_SERVICE: [
    ['GENERATOR', 'Generador'],
    ['UPS', 'UPS'],
    ['TRANSFER', 'Transferencia'],
    ['MCC', 'Centro de control de motores'],
    ['MOTOR', 'Motor'],
    ['SUBSTATION', 'Subestación'],
    ['BATTERY_BANK', 'Banco de baterías'],
  ],
} as const;

const resourceLevels = ['MINOR', 'MAJOR', 'INDUSTRIAL_SERVICE'] as const;

const resources = resourceLevels.flatMap((level) =>
  resourceNames[level].map(([code, name], index) => ({ level, code, name, index })),
);

export const ELECTRICAL_RESOURCE_MANIFEST: InspectionResourceManifest = {
  taxonomy: {
    id: '71000000-0000-4000-8000-000000000001',
    versionId: '71100000-0000-4000-8000-000000000001',
    code: 'DEMO_ELECTRICAL_RESOURCE_SCOPE_V1',
    version: 1,
    inspectionDomain: 'ELECTRICAL',
    name: 'Alcance de recursos eléctricos · demo sintética',
  },
  resources: resources.map(({ level, code, name }, index) => ({
    id: `71200000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    code,
    name,
    level,
    parentId: null,
    displayOrder: index + 1,
  })),
};

export const ELECTRICAL_RESOURCE_MAPPINGS = [
  {
    id: '71300000-0000-4000-8000-000000000001',
    standardVersionId: '57100000-0000-4000-8000-000000000001',
  },
  {
    id: '71300000-0000-4000-8000-000000000002',
    standardVersionId: '57100000-0000-4000-8000-000000000002',
  },
  {
    id: '71300000-0000-4000-8000-000000000003',
    standardVersionId: '57500000-0000-4000-8000-000000000001',
  },
  {
    id: '71300000-0000-4000-8000-000000000004',
    standardVersionId: '57500000-0000-4000-8000-000000000002',
  },
].map((mapping) => ({ ...mapping, version: 1, status: 'ACTIVE' as const }));

export function electricalResourceDigest() {
  return inspectionResourceManifestDigest(ELECTRICAL_RESOURCE_MANIFEST);
}
