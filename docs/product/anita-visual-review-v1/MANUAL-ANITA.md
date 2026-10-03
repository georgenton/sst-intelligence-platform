# SST Intelligence
## Guía visual para revisión profesional

SST Intelligence es un espacio para entender cómo una organización gestiona la Seguridad y Salud en el Trabajo. Reúne el contexto de la empresa, lo que se decide hacer, las revisiones en campo y la evidencia que permite dar seguimiento. La pantalla no pretende reemplazar el criterio de una profesional SST.

Esta guía acompaña una sesión con la organización sintética **SST Intelligence — Revisión Anita**. Todos los nombres, personas, cantidades, hallazgos y programas que aparecen aquí son datos de revisión. No son datos de clientes ni expedientes clínicos.

La revisión busca comprobar si el lenguaje, el orden de trabajo y las conexiones entre pantallas representan una práctica SST comprensible. Algunas piezas ya están implementadas técnicamente; otras necesitan criterio profesional; y las que aún no tienen una fuente externa exacta permanecen identificadas como pendientes.

## 1. Qué se revisa

Anita revisará si puede responder preguntas como estas:

- ¿Entiendo qué hecho está mostrando la plataforma y de dónde proviene?
- ¿La evaluación se convierte en un plan de trabajo que una persona puede revisar?
- ¿Una inspección lleva con claridad desde el criterio hasta la acción y la evidencia?
- ¿La selección de EPP, capacitación, incidentes y observaciones mantiene la diferencia entre una sugerencia y una decisión profesional?
- ¿La información normativa se presenta como consulta documental, sin convertir una fuente en una aprobación automática?

La sesión no solicita una aprobación legal general. La diferencia entre tres estados se mantiene durante toda la guía:

1. **Técnicamente implementado:** la pantalla y su conexión de datos existen y se pueden observar en staging.
2. **Profesionalmente validado:** Anita confirma que la interpretación y el lenguaje representan su práctica.
3. **Regulatoriamente publicado:** una regla tiene una fuente exacta, una unidad trazable y una publicación aprobada. Hoy no hay `RuleVersions` publicadas.

## 2. Cómo entrar

Jorge te enviará un enlace personal de acceso. Usa el mismo correo al que se generó la invitación y crea tu propia contraseña. Si aún no tienes cuenta, elige **Crear cuenta**; después acepta el acceso a **SST Intelligence — Revisión Anita**.

La revisión ocurre en un entorno de staging separado de producción. Si el enlace te pide una autorización temporal, usa el enlace que Jorge te envió. No necesitas conocer identificadores técnicos ni copiar una contraseña compartida.

### La organización de revisión

La organización contiene dos centros activos:

- **Centro Quito — Oficina y coordinación** (Quito).
- **Centro Guayaquil — Zona técnica** (Guayaquil).

La evaluación conserva **453 personas en total**. De ellas, 267 están asignadas a Quito, 85 a Guayaquil y **101 permanecen sin asignación de centro**. La plataforma no inventa la ubicación de esas 101 personas.

![Centro de comando](../../../design-handoff/anita-visual-review-v1/01-home.png)

## 3. Cómo está organizado el producto

El hilo principal es:

```mermaid
flowchart LR
  O[Organización] --> E[Evaluación SST]
  E --> P[Plan operativo]
  P --> W[Cola de trabajo]
  W --> I[Inspección]
  I --> F[Hallazgo]
  F --> R[Riesgo]
  R --> A[Acción]
  A --> V[Evidencia]
  V --> U[Seguimiento]
  O --- X[Trabajadores · EPP · Capacitación]
  O --- Y[Incidentes · Observaciones]
  O --- Z[Salud · Psicosocial · Regulación · Inteligencia]
```

La **Evaluación** recoge hechos confirmados. El **Plan** programa lo que una persona decide hacer. La **Cola de trabajo** proyecta lo que requiere atención ahora. Una **Inspección** conserva su criterio, resultado, hallazgo, riesgo, acción y evidencia; el enlace vuelve siempre a su fuente.

## 4. Centro de comando

### Qué es

Es la primera lectura del espacio: muestra prioridades y accesos a la actividad.

### Para qué existe

Ayuda a decidir por dónde empezar una revisión sin convertir la pantalla en una calificación de cumplimiento.

### Qué hace la persona usuaria

Confirma la organización activa, revisa la prioridad y abre la Cola de trabajo o una actividad concreta.

### Qué hace el sistema

Resume señales y tareas de los registros canónicos y conserva sus enlaces.

### Qué revisar

Comprueba que el nombre de la organización, los dos centros activos y el texto “datos sintéticos” sean visibles. Mira si la prioridad resulta comprensible.

### Qué no significa

No es un puntaje de cumplimiento, un score de trabajadores ni una conclusión legal.

### Estado actual

✅ **Listo para revisar**

![Centro de comando](../../../design-handoff/anita-visual-review-v1/01-home.png)

## 5. Evaluación SST y denominador

### Qué es

Es la lectura inicial del contexto de la empresa: actividades, centros, hechos confirmados y puntos que necesitan una revisión profesional.

### Para qué existe

Permite que las recomendaciones y el plan se entiendan a partir de hechos, no de suposiciones.

### Qué hace la persona usuaria

Lee el contexto, abre el fundamento de una recomendación y decide qué quiere llevar al plan.

### Qué hace el sistema

Conserva el diagnóstico finalizado y separa `UNKNOWN` de `NO`: un dato desconocido no equivale a que la respuesta sea negativa.

### Qué revisar

Busca la explicación de 453, 267, 85 y 101. ¿La diferencia entre población total, asignación a centros y personas sin centro es profesionalmente entendible? Revisa también que el texto diga que el diagnóstico es orientativo y no acredita cumplimiento legal.

### Qué no significa

No es una distribución inventada ni una decisión de cumplimiento. La actividad complementaria cambia el contexto de preguntas, pero no crea una obligación legal por sí sola.

### Estado actual

🟡 **Necesita criterio profesional**

![Evaluación SST](../../../design-handoff/anita-visual-review-v1/02-evaluation.png)

![Evaluación SST en móvil](../../../design-handoff/anita-visual-review-v1/25-mobile-evaluation.png)

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## 6. Plan operativo y Cola de trabajo

### Plan operativo

El Plan programa las actividades que la organización decide realizar. En la fixture hay un plan sintético activo con seis actividades y sus fuentes.

![Plan operativo](../../../design-handoff/anita-visual-review-v1/03-plans.png)

### Cola de trabajo

La Cola es la proyección de lo que requiere atención ahora. No es un segundo plan ni una copia editable de una inspección. Cada tarjeta muestra fuente, prioridad, estado, centro, fecha y acceso al registro original.

![Cola de trabajo](../../../design-handoff/anita-visual-review-v1/04-work-queue.png)

### Qué revisar

¿Se entiende qué fue programado y qué está pendiente hoy? Abre una tarjeta y confirma que el deep link conserva el contexto de su fuente.

### Estado actual

✅ **Listo para revisar**

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## 7. Trabajo en campo y Búsqueda

**Trabajo en campo** permite registrar una observación o tarea con responsable y evidencia. La pantalla actual no es una aplicación nativa, no promete sincronización offline y no incluye un QR público anónimo.

![Trabajo en campo](../../../design-handoff/anita-visual-review-v1/05-field.png)

**Búsqueda** ayuda a encontrar un plan, trabajador, inspección o hallazgo y volver a su fuente. No crea un modelo de datos paralelo.

![Búsqueda operativa](../../../design-handoff/anita-visual-review-v1/06-search.png)

✅ **Listo para revisar**

## 8. Trabajadores, EPP y Capacitación

### Trabajadores

Un **trabajador** es una persona que la organización gestiona. Una **cuenta de usuario** es quien inicia sesión y una **membresía** es el acceso de esa cuenta a la organización. Son conceptos distintos. La pantalla no muestra score ni perfil médico individual.

![Trabajadores](../../../design-handoff/anita-visual-review-v1/07-workers.png)

### EPP

#### Qué es

Un recorrido de protección personal: **cargo → riesgo → candidato → selección humana → requisito → entrega → acuse → condición → reemplazo**.

#### Qué hace la persona usuaria

Confirma o ajusta una selección profesional, registra la entrega, el acuse, la condición y el reemplazo.

#### Qué hace el sistema

Conecta el requisito con el cargo y la persona, conserva históricos y proyecta seguimiento. Las categorías `ERGONOMIC` y `OTHER` no producen un candidato automático cuando no hay base suficiente.

#### Qué revisar

¿El lenguaje deja claro que una sugerencia del sistema no sustituye la selección profesional? ¿La secuencia de entrega, condición y reemplazo es útil?

#### Qué no significa

No es una certificación automática ni un inventario certificado.

#### Estado actual

🟡 **Necesita criterio profesional**

![Protección personal](../../../design-handoff/anita-visual-review-v1/10-ppe.png)

![Protección personal en móvil](../../../design-handoff/anita-visual-review-v1/26-mobile-ppe.png)

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

### Capacitación

La pantalla une necesidad, origen, audiencia, sesión, asistencia, completitud y renovación. No es un LMS ni una autoridad de certificación.

![Capacitación](../../../design-handoff/anita-visual-review-v1/11-training.png)

🟡 **Necesita criterio profesional**

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## 9. Incidentes y Observaciones de seguridad

### Incidentes

La fixture contiene un casi incidente de mantenimiento eléctrico con ubicación, persona involucrada, investigación, factores, acción y evidencia. Un **factor** no es una causa raíz automática; un diagrama de Ishikawa tampoco es una conclusión por sí solo.

![Incidentes](../../../design-handoff/anita-visual-review-v1/08-incidents.png)

### Observaciones

Una Observación de seguridad es un registro diferente de un Incidente y de un Hallazgo de inspección. Puede mostrar una buena práctica, prioridad, evidencia y siguiente paso.

![Observaciones de seguridad](../../../design-handoff/anita-visual-review-v1/09-safety-observations.png)

🟡 **Necesita criterio profesional**

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## 10. Inspecciones, riesgo, acción y evidencia

### Qué es

La superficie de Inspecciones conserva el flujo **dominio → recurso → base de inspección → criterio → resultado → hallazgo → riesgo → acción → evidencia → verificación**. La fixture contiene inspecciones eléctricas demostrativas.

### Qué hace la persona usuaria

Revisa el criterio y el resultado, confirma el hallazgo, propone o ajusta la acción y añade la evidencia disponible.

### Qué hace el sistema

Conserva versiones, historial y recurrencias. Las alertas son señales determinísticas; no son predicción, causa raíz ni una declaración de incumplimiento.

### Qué revisar

Separa una referencia técnica de una ley ecuatoriana. Confirma que la cadena sea legible y que una acción se pueda seguir hasta su evidencia y verificación.

### Qué no significa

Una matriz técnica, incluso si se muestra como “5×5”, no equivale a una evaluación regulatoria validada. Un estándar extranjero no se convierte en legislación ecuatoriana.

### Estado actual

🟡 **Necesita criterio profesional**

![Inspecciones](../../../design-handoff/anita-visual-review-v1/12-inspections.png)

![Alertas de inspección](../../../design-handoff/anita-visual-review-v1/13-inspection-alerts.png)

![Riesgo técnico](../../../design-handoff/anita-visual-review-v1/14-technical-risk.png)

![Métodos de riesgo](../../../design-handoff/anita-visual-review-v1/15-risk-methods.png)

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

### Configuración de inspección

En las pantallas de configuración, **recurso** es lo que se inspecciona, **estándar** es una referencia técnica y **base de inspección** es la configuración versionada que se aplicó. El contexto regulatorio, cuando existe, se muestra por separado. La revisión profesional debe decidir los mappings antes de publicarlos.

## 11. Inteligencia y lectura gerencial

**Inteligencia de gestión** resume actividad, acciones y señales para una lectura gerencial. **Señales operativas** muestran patrones determinísticos derivados de registros. **Analítica de inspecciones** muestra recurrencia y tendencia.

Ninguna de estas vistas fabrica un KPI, puntúa trabajadores o predice eventos.

![Inteligencia de gestión](../../../design-handoff/anita-visual-review-v1/16-management-intelligence.png)

![Señales operativas](../../../design-handoff/anita-visual-review-v1/17-operational-signals.png)

![Analítica de inspecciones](../../../design-handoff/anita-visual-review-v1/18-inspection-analytics.png)

✅ **Listo para revisar**

## 12. Organización y Equipo

La pantalla de Organización muestra país, sector, perfil y centros activos e históricos. En la revisión se ven dos centros activos; los auxiliares históricos permanecen identificados como inactivos.

![Organización y centros](../../../design-handoff/anita-visual-review-v1/19-organization.png)

El Equipo muestra la persona propietaria sintética y el formulario para una futura invitación. No se ha creado una invitación real para Anita. Durante la sesión, Jorge preparará un acceso personal y temporal.

![Equipo y miembros](../../../design-handoff/anita-visual-review-v1/20-members.png)

🟡 **Necesita criterio profesional**

### Nota de entorno sintético

La ficha del plan puede mostrar un límite comercial de un centro mientras la fixture mantiene dos centros activos para hacer visible el recorrido de revisión. La diferencia pertenece al entorno sintético y debe comentarse antes de interpretar un límite de plan como regla de operación.

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## 13. Paquetes de evidencia y Módulos

Un paquete de evidencia conserva un snapshot y su manifiesto de referencias. No certifica cumplimiento ni contiene documentos reales. La vista de Módulos separa lo disponible, demo, activo y bloqueado; la visibilidad de una tarjeta no sustituye la autorización del espacio.

![Paquetes de evidencia](../../../design-handoff/anita-visual-review-v1/21-evidence-packages.png)

![Módulos](../../../design-handoff/anita-visual-review-v1/22-modules.png)

✅ **Listo para revisar**

## 14. Salud en el trabajo y Psicosocial

### Salud en el trabajo

Organiza periodos, responsables, actividades preventivas, centros, evidencia y un vínculo al Plan. No guarda historias clínicas ni resultados médicos individuales. No debe presentarse como SISAT.

![Salud en el trabajo](../../../design-handoff/anita-visual-review-v1/28-health-at-work.png)

🟡 **Necesita criterio profesional**

### Psicosocial

Registra un programa, instrumento, ciclo de evaluación agregada, participación, informe de referencia y seguimiento al Plan. No guarda respuestas individuales, puntajes individuales, resultados vinculados a un trabajador ni diagnósticos.

![Prevención de riesgos psicosociales](../../../design-handoff/anita-visual-review-v1/29-psychosocial.png)

🟡 **Necesita criterio profesional**

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## 15. Biblioteca normativa

La Biblioteca muestra fuente, versión, unidad o artículo, estado y provenance. Una **fuente** no es una **regla**; un **artículo** no genera automáticamente una decisión; un borrador de regla no es una versión publicada.

Actualmente hay **cinco RuleDrafts y cero RuleVersions publicadas**. La pantalla puede consultarse, pero no debe llamarse “cumplimiento”.

![Biblioteca normativa](../../../design-handoff/anita-visual-review-v1/30-regulatory-library.png)

⛔ **Bloqueado por fuente**

## 16. SISAT: estado honesto

SST Intelligence ha identificado la referencia de publicación oficial de SISAT, pero el artefacto oficial exacto todavía no ha sido fijado y estructurado dentro del corpus normativo. Por eso la plataforma no presenta categorías, horas de personal ni obligaciones de SISAT como verdad legal ejecutable.

La pregunta para Anita es si esta explicación es clara y suficiente para evitar una interpretación normativa prematura. No se inventan categorías ni se presenta una captura de una pantalla que aún no existe.

⛔ **Bloqueado por fuente**

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## 17. Las demás secciones de navegación

Estas superficies existen y se pueden abrir desde el menú. Se incluyen para que la conversación tenga el mismo mapa que el producto, aunque no todas necesitan una captura propia:

| Sección | Para qué sirve | Estado |
|---|---|---|
| Portafolio | Comparar organizaciones a las que una persona tiene acceso. | 🟡 Necesita criterio profesional |
| Preguntar / Operar | Consultar el contexto y preparar acciones confirmables. | 🟡 Necesita criterio profesional |
| Gobernanza | Registrar responsabilidades, decisiones y seguimiento. | 🟡 Necesita criterio profesional |
| Permisos de trabajo | Organizar permisos sintéticos cuando el acceso esté habilitado. | 🟡 Necesita criterio profesional |
| Bases de inspección | Versionar la configuración de una inspección. | 🟡 Necesita criterio profesional |
| Estándares | Mantener referencias técnicas y su provenance. | 🟡 Necesita criterio profesional |
| Alcance de recursos | Definir qué recurso se inspecciona y cómo se mapea. | 🟡 Necesita criterio profesional |
| Facturación | Mostrar el plan y sus límites comerciales. | ⚪ Fuera de esta revisión |

## 18. Lo que está listo y lo que falta

| Superficie | Qué se observa | Estado | Pregunta para Anita |
|---|---|---|---|
| Inicio, evaluación, plan y cola | Historia conectada desde el contexto hasta el trabajo. | ✅ Listo para revisar | ¿El orden ayuda a trabajar? |
| Inspecciones y riesgo | Criterio, resultado, hallazgo, acción y evidencia. | 🟡 Necesita criterio profesional | ¿El método y la profundidad son adecuados? |
| EPP, capacitación, incidentes y observaciones | Registros operativos con históricos y fuentes. | 🟡 Necesita criterio profesional | ¿El vocabulario y las transiciones son correctos? |
| Salud y Psicosocial | Coordinación preventiva y datos agregados. | 🟡 Necesita criterio profesional | ¿El alcance y el lenguaje son seguros? |
| Biblioteca normativa | Fuentes y cinco borradores sin publicación. | ⛔ Bloqueado por fuente | ¿Qué evidencia falta por unidad? |
| SISAT | Referencia identificada, artefacto exacto pendiente. | ⛔ Bloqueado por fuente | ¿La explicación del límite es suficiente? |

Los temas profesionales pendientes son PA-01 a PA-10. El bloqueo externo es PA-11/SISAT. El detalle de preguntas está en la hoja de revisión.

## 19. Cómo registrar comentarios

En cada sección, anota una observación concreta: qué viste, qué palabra cambiarías y qué ejemplo profesional ayudaría. Marca **Accept**, **Adjust** o **Need more evidence**. No hace falta escribir una especificación técnica ni aprobar una regla.

## 20. Lo que Anita no necesita revisar

No necesitas validar la arquitectura de despliegue, la base de datos, los detalles de autenticación, CI/CD, precios, facturación, Prisma, Vercel, Railway o UUIDs. Tampoco se te pide aprobar una regla legal ni publicar una versión normativa.

## 21. Sesión recomendada de 45–60 minutos

1. **5 min — Idea y Centro de comando.** Organización sintética, prioridades y límite de la revisión.
2. **10 min — Evaluación, Plan y Cola.** 453, 267, 85, 101; hechos y decisiones.
3. **15 min — Inspección, Riesgo, Acción y Evidencia.** Seguir una inspección eléctrica completa.
4. **10 min — Trabajador, EPP, Capacitación, Incidente y Observación.** Confirmar vocabulario y diferencias.
5. **10 min — Salud, Psicosocial y Biblioteca.** Revisar datos agregados, RuleDrafts y SISAT.
6. **5–10 min — Decisiones abiertas.** Registrar PA-01…PA-11 sin convertirlas en aprobaciones automáticas.

### Cómo explicarle SST Intelligence a Anita en 5 minutos

“SST Intelligence no es una colección de formularios desconectados. Intenta mantener una cadena comprensible: qué es la empresa, qué aplica, qué debe revisarse, qué se encontró, qué acción se requiere y qué evidencia muestra el seguimiento. Ingeniería implementa la estructura. Tú validas si la lógica profesional representa una práctica SST real. Cuando falta una fuente exacta, el sistema lo dice y deja la decisión abierta.”

## 22. Revisión móvil

Las capturas de 390 px muestran Inicio, Evaluación, EPP y Cola. Durante la sesión comprueba que no haya desplazamiento horizontal, que el menú sea utilizable, que el texto siga siendo legible y que el CTA principal sea accesible.

![Inicio móvil](../../../design-handoff/anita-visual-review-v1/24-mobile-home.png)

![Cola móvil](../../../design-handoff/anita-visual-review-v1/27-mobile-work-queue.png)

## 23. Nota de seguridad

Los 30 archivos visuales son capturas de staging con información sintética. No contienen correo real de Anita, invitación, contraseña, token ni datos clínicos. La invitación real se creará cerca de la sesión y expirará a los siete días.

La guía queda **✅ Lista para revisar**. La aceptación profesional y la publicación normativa permanecen abiertas hasta que Anita y las fuentes correspondientes den su criterio.
