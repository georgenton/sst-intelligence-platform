# Source Verification and Vigencia V1

## Clasificaciones independientes

La verificación del artefacto y la vigencia son ejes separados. Un PDF oficial localizado no prueba
por sí mismo que todas sus disposiciones continúen vigentes.

Artefacto: `OFFICIAL_ARTIFACT_VERIFIED`, `OFFICIAL_REFERENCE_ONLY`, `ARTIFACT_PENDING` o
`REJECTED_UNVERIFIED`. Extracción: `COMPLETE`, `PARTIAL`, `PENDING` o `NOT_APPLICABLE`. Vigencia:
`CURRENT_VERIFIED`, `AMENDED`, `PARTIALLY_AMENDED`, `REPEALED`, `SUPERSEDED`, `PENDING_REVIEW` o
`UNKNOWN`.

Cada versión registra URL oficial, emisor y número, publicación/Registro Oficial cuando existe,
fecha de recuperación, SHA-256, MIME, páginas y notas. Una URL que entrega bytes distintos produce
revisión por hash; no se asume la misma versión.

## Resultado del corpus V1

- 15 fuentes globales revisadas.
- 13 artefactos oficiales verificados.
- 1 referencia oficial sin artefacto (`EC_MSP_00004_2026_SISAT`).
- 0 artefactos pendientes de clasificación.
- 1 referencia rechazada/no verificada (`EC_IESS_CD_527_INTERVIEW_REFERENCE`).
- Ocho versiones de fuente tienen extracción estructural completa y unidades sincronizadas.
- Decreto Ejecutivo 255 y Anexo 2 están verificados como artefactos, pero sus PDFs escaneados
  permanecen pendientes de extracción completa; no se inventó OCR ni texto.
- C.D. 513, C.D. 517 y Anexo 3 también conservan artefactos verificados sin unidades estructuradas
  en este runtime. En total, cinco de los trece artefactos verificados siguen sin estructuración.
- La referencia de entrevista C.D. 527 permanece rechazada/no verificada.
- SISAT conserva referencia oficial; no se presenta un artefacto inexistente como verificado.

Una relación de reforma, derogación o sustitución solo se registra con evidencia documental. La
mera cronología no produce inferencias de vigencia. La relación C.D. 517 → C.D. 677 está confirmada
por la Disposición Derogatoria Única de C.D. 677 y C.D. 517 se conserva con estado `REPEALED`. La
relación C.D. 692 → C.D. 513 está confirmada por el artículo 1 de C.D. 692. La relación normativa
entre Decisión CAN 584 y Resolución CAN 957 también está confirmada; su vigencia corriente permanece
`PENDING_REVIEW` mientras no se complete una revisión integral de actualidad.
