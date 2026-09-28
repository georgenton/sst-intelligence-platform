# Requisitos comunicados para Anita y observaciones A19

**Corte documental:** 2026-09-24
**Fuente de trabajo:** programa maestro y reunión `Meeting @Last Saturday` en Notion, más el estado real del repositorio en `d20d2ff7f10871271587571b1825f409b7b534e0`.

## Cómo se registra la aprobación

Jorge comunicó el 2026-09-24 que Anita aprobó las leyes y pidió usarlas. Este paquete lo registra como **ratificación comunicada**, no como firma de Anita, acta firmada ni autorización automática para publicar reglas. La decisión sigue siendo por unidad: fuente, artículo/provisión, requisito, criterio de inspección y regla calculada deben conservar estado, jurisdicción, derechos y revisión profesional.

## Piloto inmediato

La navegación de primera entrega debe concentrar la prueba humana en:

1. **Inicio:** contexto de organización, centros, estado y accesos.
2. **Evaluación SST:** hechos de evaluación, resultado determinista y procedencia.
3. **Plan operativo:** convertir hechos/resultados en acciones trazables.
4. **Inspecciones:** bases, ejecución, hallazgos, acciones y evidencia.
5. **EPP:** posición → candidato determinista → selección humana → requisito, entrega, inspección de condición y reemplazo.

Los centros, cargos, personas, riesgo técnico, acciones, evidencia, cola de trabajo, equipo y acceso permanecen accesibles porque soportan el piloto. El menú no es evidencia suficiente de operación: cada fila de la matriz enlaza la superficie con contrato, guardas, entitlements, modelos y prueba.

SISAT y Psicosocial quedan en siguiente alcance hasta que exista una superficie operable, contrato dedicado, fuente fijada y revisión profesional. Un módulo listado en `ModuleKey` o una copia de diseño no convierte una capacidad en disponible.

## Observaciones A19 y decisiones de producto

| Hallazgo observado                                                                                    | Decisión de baseline                                                                                                                   | Clasificación B0                                              | Estado que debe conservarse                                                     |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Un centro puede tener oficina, zonas y actividades distintas.                                         | Preguntar por centro/zona/actividad y no inferir “oficina sin riesgos”.                                                                | reproducido; pendiente de semántica                           | Pendiente de comprobar en journey real y datos de muestra.                      |
| Productos químicos sí pueden existir por limpieza aunque no haya proceso industrial de alta energía.  | Separar limpieza, proceso y energía; permitir riesgo en oficina.                                                                       | ya corregido en el contrato; validar                          | Regla de captura corregida en el contrato existente; no publicar norma nueva.   |
| El sector principal puede tener actividades complementarias que cambian el contexto.                  | Capturar sector y actividades complementarias antes de deducir riesgo.                                                                 | pendiente de semántica                                        | Requiere prueba por centro y actividad.                                         |
| Parte de la población es móvil o compartida.                                                          | Preguntar si la persona está asignada al centro, no solo si estuvo físicamente presente.                                               | reproducido; pendiente de semántica                           | Requiere datos de centro y estado de asignación.                                |
| La conversación tenía 267 personas del centro 1, 85 del centro 2 y un total 453.                      | Usar el fixture sintético `267 + 85 vs 453` para probar discrepancia y explicar el denominador.                                        | reproducido como fixture; no reproducir distribución faltante | No se inventa la distribución de las 101 restantes.                             |
| Se repetía el aviso de “mínima información” y había fatiga de mensajes.                               | Una sola explicación contextual y corta, con vínculo a detalle cuando haga falta.                                                      | reproducido; pendiente de copy                                | Pendiente de validación de copy y analytics de repetición.                      |
| Un fundamento podía repetir un artículo sin explicar cómo se relaciona con el requisito.              | Mostrar la relación fuente → requisito → criterio → acción, con la unidad y versión.                                                   | pendiente de semántica                                        | Requiere revisión de asociaciones y trazabilidad.                               |
| La base de inspecciones era el flujo más desarrollado, pero faltaba profundidad visible de ejecución. | Mantener creación, ejecución, hallazgos, acciones y evidencia como un solo recorrido revisable.                                        | reproducido; prueba pendiente                                 | La prueba de ejecución real queda en el cierre de piloto.                       |
| EPP necesita entrega, condición, reemplazo e inventario agregado.                                     | La pantalla de EPP debe mostrar agregados, próximos reemplazos y faltantes; no crear candidatos para `ERGONOMIC` u `OTHER` sin reglas. | reproducido; prueba de cola pendiente                         | Debe probarse con workers/positions sintéticos y sin autoactivación de módulos. |
| SISAT/CISAT es siguiente paso.                                                                        | No presentar una tarjeta vacía como capacidad operativa ni afirmar cumplimiento clínico.                                               | ya decidido como siguiente alcance                            | `NEXT_SCOPE`.                                                                   |

## Fixture sintético mínimo

El fixture de revisión usa dos centros con 267 y 85 personas asignadas y un total organizacional de 453 para comprobar que el sistema distingue **asignación**, **presencia** y **denominador global**. No representa clientes, no completa datos faltantes y no permite deducir las 101 personas restantes. El caso debe cubrir una oficina con al menos una actividad de limpieza química y una zona con riesgo documentable.

La asociación que debe poder seguirse en una revisión es `plan → inspección → hallazgo → acción → persona/rol → EPP`. Cada salto debe conservar identificador, organización, estado y evidencia; una cita de artículo aislada no satisface esa trazabilidad. La vista agregada de EPP debe contar necesidades y reposiciones por producto/posición, sin convertir el agregado en una recomendación automática.

## Criterios de aceptación de la superficie

- El usuario puede abrir Inicio, Evaluación SST, Plan operativo, Inspecciones y EPP con una organización autenticada y contexto activo.
- La evaluación conserva hechos y procedencia; el resultado muestra la versión del motor `1.2.0` y no inventa respuestas.
- El plan operativo conserva vínculo con la evaluación, acciones y estado de ejecución.
- Una inspección puede seleccionar una base válida, registrar resultado, hallar una desviación, asociar evidencia y dejar acción trazable.
- EPP conserva posición, trabajador, requisito, entrega, confirmación/inspección de condición y reemplazo; la selección de protección queda en manos humanas.
- El equipo puede distinguir lo que está implementado, verificado, desplegado y pendiente de cierre de producción.
- No aparece token en una URL; no se mutan entitlements fuera del baseline; la sesión pública se limpia solo después de un claim exitoso.

## Criterios que no deben inferirse

- El estado `PILOT_READY` de una fila no prueba que la operación esté cerrada en producción.
- Un estándar extranjero o sintético no se convierte en ley ecuatoriana; la matriz conserva jurisdicción y límite de aplicabilidad.
- Un requisito candidato del MDT-2024-196 no es una obligación publicada: los cinco borradores siguen `TECHNICAL_REVIEW_PENDING`.
- Un registro de trabajador no contiene historial clínico; la información médica individual queda fuera de las superficies de administración.

## Evidencia y próximos datos

El inventario de fuentes y sus huellas está en [regulatory-publication-manifest.json](./regulatory-publication-manifest.json). Las comprobaciones de API/DB de producción, el journey normal y la confirmación de que la cola genera obligaciones de EPP deben cerrarse antes de marcar el piloto como aceptado. [pending-items.md](./pending-items.md) asigna esas comprobaciones.
