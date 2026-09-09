# Adaptive Organization Profile V2 y Gap Analysis V1

Estado: **DONE** para el modelo y recorrido implementados; **PENDING ANITA** para criterios profesionales nuevos.

## Propósito

El perfil SST sigue siendo un snapshot inmutable de contexto organizacional, no un ERP, HRIS ni una declaración jurídica. La versión `2.0.0` conserva los campos consumidos por Applicability V1 y añade hechos de contexto finitos. Cada hecho representa `KNOWN_TRUE`, `KNOWN_FALSE` o `UNKNOWN`: una respuesta ausente nunca equivale a falso.

La procedencia distingue `DECLARED_BY_ORGANIZATION`, `DERIVED_DETERMINISTICALLY`, `EVIDENCE_BACKED`, `IMPORTED_REFERENCE` y `PROFESSIONAL_CONFIRMED`. Los hechos por centro exigen un Work Center de la organización activa. `EVIDENCE_BACKED` conserva un descriptor estructurado de tipo, id y etiqueta resuelto contra Evidence canónico del tenant; no acepta texto libre, referencias inexistentes o cross-tenant. `DERIVED_DETERMINISTICALLY` es exclusivamente server-owned. `PROFESSIONAL_CONFIRMED` exige el rol vigente de la ruta y registra actor y fecha desde el servidor. Las derivaciones actuales se limitan a datos canónicos existentes —ciudad de centros, presencia de áreas y cargos— y no crean datos durante la migración ni afirman completitud.

Una identidad semántica (`scope + workCenterId + key`) no puede contener valores contradictorios. Duplicados equivalentes se canonicalizan y los hechos derivados por el servidor no pueden sobrescribirse desde el payload.

`managementPriority` expresa atención gerencial (`ROUTINE`, `FOCUSED`, `URGENT`). No participa en el evaluador de aplicabilidad, en GTC45/5×5, ni suprime Requirements.

## Gap Analysis V1

`OrganizationGapAnalysis` conserva versión, origen, hashes de entrada/salida, perfil relacionado y la lista ordenada de gaps. Sus estados son descriptivos: información o evidencia requerida, actividad todavía no planificada, capacidad ausente, revisión profesional pendiente, diferencia de implementación, implementación parcial o implementación declarada con evidencia disponible.

No existe `COMPLIANT` ni `NON_COMPLIANT`. El origen debe ser una propuesta Adaptive Configuration o una Unified SST Evaluation de la organización activa. Los candidates y sus conjuntos lógicos se ordenan antes de calcular `inputHash`, de modo que el hash no depende del orden de lectura de Prisma. El resultado es reproducible desde su snapshot y nunca recalcula históricos.

Gap no es Plan Item. La conversión requiere seleccionar explícitamente entre 1 y 50 gaps accionables y crea un borrador de Plan Operativo con procedencia `GAP_ANALYSIS`; conserva análisis, versión, gap, estados y evidencia. `IMPLEMENTED_EVIDENCE_AVAILABLE` es informativo y se rechaza para conversión tanto en API como en UI. No activa el plan ni crea ítems masivos.

## Datos y límites

Los facts son tenant operational MEDIUM; las referencias Evidence conservan su clasificación original. Las declaraciones profesionales son professional decisions. Ningún campo nuevo se envía al proveedor externo de IA. Un hecho empresarial no se presenta como verdad legal.

## PENDING ANITA

- qué facts adicionales cambian realmente una recomendación;
- cuáles requieren evidencia o confirmación profesional;
- cuándo una diferencia operativa debe convertirse en actividad de Plan;
- vocabulario final para procesos, equipos y contexto físico.

## Cierre de producción

El recorrido implementado quedó production closed por PR #44, HEAD auditado
`894b12791f65f7ad42f57dc2ccb3183dc8889f62`, merge
`38a704dd757364bfed498b8c130eb6ded745e80c` y Quality Gate 34295675414 en intento 1. La migración
33 es aditiva: los facts desconocidos permanecen `UNKNOWN`, las inspecciones históricas no reciben
profundidad inferida y ningún análisis histórico se recalcula. El material remitido por Anita sigue
pendiente de verificación de fuente y mapping profesional; este cierre técnico no atribuye su
aprobación.
