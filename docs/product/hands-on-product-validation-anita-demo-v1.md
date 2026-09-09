# Hands-on Product Validation + Anita Demo V1

## Estado y límites

Validación realizada sobre `main@6f2f04275715ce1ae55efcede80ca28cb857cff9` y la rama `feat/product-validation-demo-hardening-v1`. La prueba usa exclusivamente organizaciones sintéticas en base local/test o Preview. No publica reglas reales, no cambia fórmulas GTC45/5x5, no habilita IA externa y no usa datos de clientes.

El producto conserva estas separaciones: Perfil describe hechos conocidos; Aplicabilidad propone configuración; Brecha describe una diferencia; Plan programa trabajo; Work Queue proyecta trabajo vigente; la API de dominio mantiene la autoridad. El asistente explica o propone, pero no decide ni escribe sin confirmación.

## Matriz de validación

| Recorrido                    | Pregunta que responde / agregado canónico                                      | Próximo paso esperado                 | Estado | Hallazgos           |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------- | ------ | ------------------- |
| Inicio / Necesita atención   | ¿Qué requiere atención hoy? Proyección de señales                              | Abrir fuente o Cola de trabajo        | PASS   | —                   |
| Cola de trabajo              | ¿Qué trabajo está vigente y por qué? Proyección, no workflow                   | Abrir registro fuente                 | PASS   | —                   |
| Organización y centros       | ¿Dónde opera la empresa? Organización/WorkCenter/Area/Position                 | Completar Perfil SST                  | PASS   | —                   |
| Perfil y brechas             | ¿Qué se conoce, desconoce o descarta? Perfil tri-state + evidencia             | Confirmar hechos o analizar brechas   | PASS   | PENDING_ANITA-01/02 |
| Aplicabilidad                | ¿Qué configuración candidata deriva de los hechos? Evaluación determinista     | Revisión profesional                  | PASS   | PENDING_ANITA-03    |
| Gap Analysis                 | ¿Qué diferencia existe respecto del estado esperado? Gap hash/candidato        | Selección explícita para borrador     | PASS   | PENDING_ANITA-04    |
| Plan operativo               | ¿Qué se programó, cuándo y por qué? Plan/version/items                         | Ejecutar o abrir fuente               | PASS   | P2-01               |
| Configuración de inspección  | ¿Con qué base, recurso y profundidad inspeccionar? Basis/Resource/Depth        | Crear inspección                      | PASS   | PENDING_ANITA-05/06 |
| Inspección                   | ¿Qué se observó en campo? Inspection/criteria/responses                        | Registrar hallazgo                    | PASS   | —                   |
| Hallazgo y riesgo            | ¿Qué desviación existe y cómo se evaluó? Finding/TechnicalAssessment           | Acción y revisión autorizada          | PASS   | PENDING_ANITA-07    |
| Acción, evidencia y residual | ¿Qué se corrigió y con qué prueba? CorrectiveAction/Evidence/Residual          | Verificar o volver a cola             | PASS   | —                   |
| Búsqueda operativa           | ¿Dónde está el registro? Índice/proyección entitlement-aware                   | Abrir agregado canónico               | PASS   | P2-02               |
| Inteligencia gerencial       | ¿Qué patrones operativos requieren gestión? Métricas metodológicamente seguras | Abrir fuente, no inferir cumplimiento | PASS   | P3-01               |
| Revisión profesional         | ¿Qué decisión profesional autorizada queda registrada? Review transition       | Aprobar o pedir revisión              | PASS   | PENDING_ANITA-08    |
| Worker 360                   | ¿Qué contexto laboral tiene la persona? Worker/Position/history                | EPP, capacitación u operación         | PASS   | —                   |
| EPP                          | ¿Qué requiere/recibió la persona? Requirement/Issue                            | Seguimiento o reemplazo               | PASS   | —                   |
| Capacitación                 | ¿Qué necesidad, sesión y resultado existe? Need/Definition/Session/Completion  | Seguimiento                           | PASS   | P2-03               |
| Observación e incidente      | ¿Qué ocurrió y qué evidencia existe? Observation/Incident                      | Acción, evidencia y seguimiento       | PASS   | PENDING_ANITA-09    |
| Asistente                    | ¿Cómo entender o proponer el siguiente paso? Conversation/ActionCard           | Confirmación explícita/API canónica   | PASS   | PENDING_ANITA-10    |
| Paquetes de evidencia        | ¿Qué referencias forman una instantánea trazable? EvidencePackage/Manifest     | Finalizar y consultar fuentes         | PASS   | P1-01 corregido     |

### Hallazgo P1 corregido

`P1-01`: Paquetes de evidencia exigía escribir un UUID y mostraba identificadores internos. Se reemplazó por un selector humano buscable y paginado, con consultas acotadas en servidor y etiquetas que distinguen persona, fuente y fecha cuando corresponde. El catálogo, la incorporación y la finalización comparten una política finita por tipo: respetan organización activa, rol de autoría y el entitlement canónico del módulo antes de consultar la fuente. Las unidades regulatorias conservan la misma elegibilidad del resolvedor canónico; fuentes de otra organización no aparecen ni son aceptadas.

### P2/P3 documentados, no expandidos

- `P2-01`: la demostración completa del Plan necesita datos previos coherentes; se usa el recorrido determinista, sin un segundo seed permanente.
- `P2-02`: resultados secundarios de búsqueda pueden ser densos para un usuario nuevo; los enlaces y la procedencia son funcionales.
- `P2-03`: la amplitud de procedencias de capacitación requiere validación del orden mental con Anita.
- `P3-01`: tarjetas analíticas secundarias pueden beneficiarse de simplificación visual posterior.

## Antes de la demo

- Abrir el Preview exacto del PR y confirmar que la cabecera no indica producción.
- Usar una organización sintética rotulada “Demostración”; nunca una empresa real.
- Rol principal: ORG_OWNER. Repetir lectura con VIEWER si hay tiempo.
- Confirmar que existen centro, área, cargo, perfil, un plan/inspección y un trabajador sintéticos.
- No ingresar historias reales, datos médicos, evidencia binaria ni información psicosocial individual.

## Demo central de 20 minutos

1. **Necesita atención (1 min):** mostrar por qué aparece una señal. No es una decisión legal.
2. **Cola de trabajo (1 min):** abrir el registro fuente. No es una base de workflow paralela.
3. **Perfil de organización (2 min):** distinguir verdadero, falso y desconocido. Desconocido no significa falso.
4. **Análisis de brechas (1 min):** explicar que una brecha aún no es un PlanItem.
5. **Plan operativo (1 min):** mostrar periodo, procedencia, centro, fecha y prioridad. No es la Cola.
6. **Inspección (2 min):** abrir una inspección real del producto.
7. **Base / recurso / profundidad (2 min):** mostrar las tres decisiones separadas. No implican certificación.
8. **Hallazgo (1 min):** registrar o abrir una desviación sintética.
9. **Riesgo (2 min):** mostrar método, respuestas y resultado determinista. La IA no calcula ni cambia el resultado.
10. **Acción (1 min):** mostrar responsable/fecha/estado.
11. **Evidencia (1 min):** relacionar evidencia con la acción y conservar procedencia.
12. **Volver a Cola (1 min):** comprobar continuidad y deep link.
13. **Buscar / Inteligencia gerencial (2 min):** encontrar el registro y ver tendencia sin prometer cumplimiento.
14. **Worker 360 (1 min):** enlazar cargo, EPP, capacitación, observación e incidente.
15. **Asistente (1 min, opcional):** lectura/propuesta y límite de confirmación; proveedor local determinista.

## Checklist manual para Jorge

| Página                        | Acción                               | Resultado esperado                                          | Concepto validado      | Registrar si confunde                 |
| ----------------------------- | ------------------------------------ | ----------------------------------------------------------- | ---------------------- | ------------------------------------- |
| Inicio                        | Abrir una tarjeta de atención        | Llega a una fuente reconocible                              | Proyección → dominio   | Etiqueta, motivo o destino            |
| Cola de trabajo               | Filtrar y abrir un elemento          | Se ve prioridad, estado, centro y vencimiento cuando aplica | Trabajo vigente        | Filtro o dato ausente                 |
| Perfil y brechas              | Alternar alcance organización/centro | TRUE/FALSE/UNKNOWN no se mezclan                            | Tri-state/procedencia  | Hecho ambiguo                         |
| Configuración SST             | Abrir una recomendación              | Se presenta como candidata y revisable                      | Aplicabilidad          | Frase que suene legalmente definitiva |
| Plan operativo                | Abrir un ítem                        | Procedencia y ejecución son distinguibles                   | Programación           | Confusión con Cola                    |
| Inspecciones                  | Crear/abrir recorrido                | Base, alcance y profundidad son visibles                    | Inspección canónica    | Decisión no explicada                 |
| Riesgo técnico                | Abrir evaluación                     | Método/versión/respuestas/resultado visibles                | Resultado determinista | Guidance faltante                     |
| Paquetes de evidencia         | Buscar y agregar una referencia      | Se elige por contexto humano, sin conocer IDs               | Procedencia humana     | Fuente difícil de localizar           |
| Personas / EPP / Capacitación | Recorrer el mismo trabajador         | Relaciones coherentes, sin crear cuenta de acceso           | Worker ≠ User          | Dato inesperado                       |
| Observaciones / Incidentes    | Abrir evidencia y seguimiento        | Estado y siguiente acción comprensibles                     | Evento operacional     | Recuperación de error                 |
| Buscar                        | Buscar título conocido               | Resultado abre la fuente y respeta módulos                  | Índice/proyección      | Resultado irrelevante                 |
| Asistente                     | Pedir explicación y proponer acción  | No escribe antes de confirmar                               | Interface ≠ autoridad  | Lenguaje que sobreprometa             |

Para cada confusión usar la plantilla `docs/product/product-validation-finding-template.md`; no usar IDs de base de datos ni DevTools.

## Controles de acceso, dispositivo y accesibilidad

- Roles: CTAs de escritura se muestran solo a roles que la API autoriza; OWNER no se degrada/suspende desde V1; VIEWER conserva lectura permitida.
- Entitlements: módulos no incluidos no aparecen como acciones utilizables; URL directa sigue siendo protegida por API.
- Multi-tenant: query keys, sesión, selector de referencias y APIs usan la organización validada.
- Viewports verificados por cobertura existente y recorrido: 360, 390, tablet y escritorio; navegación móvil conserva acceso al contenido principal.
- Accesibilidad: encabezados, navegación con nombre, labels, foco, `role=status`/`role=alert` y botones semánticos se preservan. No constituye certificación WCAG.

## Resultado

P0 abiertos: 0. P1 abiertos: 0. P2 documentados: 3. P3 documentados: 1. PENDING_ANITA: 10. La historia central es demostrable con producto real y datos sintéticos.
