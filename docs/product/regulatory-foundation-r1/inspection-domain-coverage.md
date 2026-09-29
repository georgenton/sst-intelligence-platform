# Cobertura de dominios de inspección

El índice `regulatory/evidence/ecuador-official-units-v1/annex-3-domain-coverage.json`
amplía la navegación del Anexo 3 a los dominios que ya aparecen en el producto. Conserva
el hash del PDF oficial y diferencia un localizador confirmado de una unidad normativa
estructurada. No es un manifiesto de `RegulatoryUnit` y no crea mappings ejecutables.

| Dominio            | Cobertura del artefacto oficial                                             | Estado ejecutable R1         |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------- |
| `ELECTRICAL`       | Título III, Cap. III, Arts. 82–90; unidades estructuradas verificadas       | `OFFICIAL_ARTIFACT_VERIFIED` |
| `INFRASTRUCTURE`   | Título III, Cap. I, Arts. 30–64; localizador, sin extracción estructurada   | `NO_EXACT_SOURCE_MAPPING`    |
| `MACHINERY`        | Título III, Cap. II, Arts. 65–81; localizador, sin extracción estructurada  | `NO_EXACT_SOURCE_MAPPING`    |
| `FIRE_PROTECTION`  | Título III, Cap. IV, Arts. 91–109; localizador, sin extracción estructurada | `NO_EXACT_SOURCE_MAPPING`    |
| `EMERGENCY`        | Título III, Cap. IV, Arts. 91–109; localizador, sin extracción estructurada | `NO_EXACT_SOURCE_MAPPING`    |
| `CHEMICAL_STORAGE` | Título I, Cap. II, Arts. 11–14; localizador, sin extracción estructurada    | `NO_EXACT_SOURCE_MAPPING`    |

Los Títulos IV (trabajos especiales) y V (EPP) se mantienen como referencia de alcance para
trabajo posterior; no se presentan como criterios ejecutables de R1. El catálogo oficial no
crea mappings donde no existe correspondencia exacta, y el alcance DEMO histórico queda
preservado.
