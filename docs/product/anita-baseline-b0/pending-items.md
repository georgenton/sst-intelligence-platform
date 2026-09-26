# Pendientes B0

Los pendientes aquí son acciones de cierre, no cambios ejecutados por este paquete. Cada fila tiene dueño sugerido, evidencia que falta y efecto si queda abierta.

| ID    | Pendiente concreto                                                                                                                                                | Dueño sugerido            | Evidencia de cierre                                                       | Efecto si queda abierto                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| B0-01 | Obtener evidencia read-only de API/DB productiva para el main SHA: health, migración y reference sync en el runtime canónico.                                     | Plataforma                | log/URL de Railway o run de release con SHA exacto, sin datos de clientes | no se puede afirmar paridad de runtime ni piloto listo |
| B0-02 | Ejecutar el journey normal de usuario en producción o staging canónico: sesión pública → registro → organización → contexto, sin completar flujo de cliente real. | QA + Producto             | trace sintético acotado, IDs descartables y no escritura de cliente       | frontend verde no prueba conversión completa           |
| B0-03 | Confirmar que la referencia SISAT exacta del PDF suministrado tiene artefacto, hash, versión, derechos y relación oficial en el corpus.                           | Anita + Legal/Regulatorio | registro por unidad y huella verificable                                  | SISAT permanece solo como alcance de revisión          |
| B0-04 | Completar revisión profesional por unidad del corpus y decidir texto oficial, interpretación, criterio de inspección y cálculo de riesgo por separado.            | Anita + SST profesional   | decisiones explícitas en manifest/release                                 | 0 reglas reales publicadas; no hay publicación segura  |
| B0-05 | Confirmar la fuente técnica del programa psicosocial citado por MDT-2024-196 y sus dependencias.                                                                  | Anita + SST profesional   | fuente versionada, jurisdicción y revisión                                | Psicosocial permanece `NEXT_SCOPE`                     |
| B0-06 | Verificar que la cola de trabajo genere ítems de EPP para reemplazo vencido y revisión de condición con datos sintéticos.                                         | Producto + QA             | fixture, conteo esperado y enlace no vacío                                | no mostrar un contador que lleve a cola vacía          |
| B0-07 | Cerrar la aceptación A19 con centro/zona/actividad, limpieza química, asignación vs presencia, población móvil y denominadores explicables.                       | Producto + UX             | capturas o trace con fixture `267 + 85 vs 453`                            | riesgo de preguntas ambiguas y cifras que no cuadran   |
| B0-08 | Revisar el copy de mínima información para que sea único, contextual y no fatigue el flujo.                                                                       | Producto + UX             | una única superficie y medición de repetición                             | abandono y pérdida de comprensión                      |
| B0-09 | Validar la profundidad de ejecución de Inspecciones (base → ejecución → hallazgo → acción → evidencia) y no solo la pantalla de inicio.                           | QA + Producto             | E2E con entidad sintética y permisos                                      | se sobredeclara madurez del módulo                     |
| B0-10 | Conservar la frontera SISAT: coordinación/previsión visible; historial clínico y datos individuales fuera de administración.                                      | Seguridad + Producto      | revisión de respuestas y permisos                                         | riesgo de exposición de información confidencial       |

## Cierre de producción observado

Los deployments asociados al main SHA fueron registrados como `success` por GitHub: Vercel staging `6600993751`, Vercel demo `6600988079`, Vercel producción `6600983545` y Railway `6600962870`. Las tres URLs Vercel respondieron `302` a Vercel SSO en una comprobación sin sesión. Eso no acredita health público ni el estado de API/DB; esos hechos quedan en B0-01 y B0-02.

La Quality Gate `35785935020` sí ejecutó `pnpm test:reference-sync` sobre una base de CI, además de `db:deploy` y `db:seed`. El test de reference sync del repositorio cubre el release en base desechable sin seed de desarrollo, pero esa cobertura no sustituye la lectura del runtime productivo. No se ejecutó ningún write de cliente, deploy manual ni cambio de datos para este paquete.

## Fuera de B0

No se abre EPP V3, no se publican mappings profesionales, no se cambia riesgo, regulación, Prisma, entitlements, navegación de Cloud Design ni comportamiento de producción.
