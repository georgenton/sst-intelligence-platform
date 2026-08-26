# Article Coverage V1

La cobertura mide extracción estructural, no completitud jurídica ni cumplimiento. El generador
compara identificadores esperados y descubiertos, secuencia, duplicados, texto vacío, páginas,
padres, hashes y binding de versión.

| Fuente                    |  Unidades | Artículos | Páginas | Cobertura estructural |
| ------------------------- | --------: | --------: | ------: | --------------------: |
| Decisión CAN 584          |        51 |        35 |      15 |                  100% |
| Resolución CAN 957        |        29 |        23 |       8 |                  100% |
| IESS C.D. 677             |        55 |        20 |      22 |                  100% |
| IESS C.D. 692             |         7 |         1 |       5 |                  100% |
| Código del Trabajo        |       706 |       637 |     199 |                  100% |
| MDT-2024-196              |        62 |        30 |      23 |                  100% |
| MDT-2024-196 Anexo 1      |         1 |         0 |       8 |                  100% |
| MDT-2025-122 Construcción |       201 |       147 |      70 |                  100% |
| **Total**                 | **1.112** |   **893** |     350 |              **100%** |

Los JSON canónicos viven en `regulatory/evidence/ecuador-official-units-v1`. El validador reproduce
el reporte y falla ante identificadores duplicados/faltantes, textos vacíos, páginas irresueltas,
padres inválidos o hashes inconsistentes. Un artefacto parcial/pending no entra en este porcentaje.
