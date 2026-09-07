# Guía de demostración para Anita

Entorno: `https://sst-intelligence-staging.vercel.app`

Organización: **Laboratorio SST Sintético — Staging**

Usuario: `pilot.owner@synthetic.invalid` (solicitar la contraseña al responsable; no compartirla ni guardarla en este documento).

Usar exclusivamente la organización sintética. No ingresar nombres, relatos, evidencias ni datos de una empresa o persona real. La demostración funciona con procesamiento conversacional local; OpenAI no es necesario.

## A. Recorrido de 45 minutos

**0–5 min · Contexto.** Iniciar sesión y confirmar el rótulo **Entorno de prueba**. Explicar que los datos, estándares y decisiones visibles son de demostración y no certifican cumplimiento legal.

**5–10 min · Prioridad operativa.** En **Inicio**, mostrar **Necesita atención** y abrir **Ver cola completa**. En la Cola de trabajo buscar **Demo Anita — Corregir condición eléctrica** y pulsar **Abrir**. Destacar que la cola conserva el origen, prioridad, estado, centro y metodología del trabajo.

**10–15 min · Plan Operativo.** Abrir **Plan operativo**. Mostrar los dos caminos **Ya tengo un
plan** y **Ayúdame a crear uno**. Generar un borrador desde señales sintéticas, revisar la
procedencia de cada actividad, activarlo y comprobar que solo la actividad prioritaria/próxima se
proyecta a la Cola con enlace de regreso al plan.

**15–28 min · Inspección, recurso, criterio y hallazgo.** Crear una inspección eléctrica:

1. Elegir dominio **Eléctrico** y el recurso MINOR **Tomacorriente**.
2. Revisar Resource Scope, Base técnica, versión exacta, mapping y criterios resueltos. Ninguna de
   estas capas equivale a ley.
3. Iniciar la inspección y registrar un criterio sintético como **No conforme**.
4. Pulsar **Crear hallazgo**: la observación no crea un hallazgo implícitamente.
5. Valorar con GTC45 y mostrar ND, NE, NP, NC, NR, nivel de intervención, interpretación y versión
   exacta. La lectura está pendiente de revisión profesional y el cálculo sigue siendo determinista.

**28–38 min · Control, acción, evidencia y residual.** En el hallazgo:

1. Crear una acción correctiva concreta, asignarla y elegir prioridad.
2. Pulsar **Iniciar acción** y luego **Enviar a verificación**.
3. Pulsar **Añadir evidencia** y registrar una nota claramente sintética; V1 admite notas y enlaces HTTPS, no carga de archivos.
4. Abrir **Verificar riesgo residual**, registrar los controles posteriores, probabilidad, severidad, justificación y base de verificación.
5. Confirmar que el riesgo residual queda ligado a la persona y a la evidencia, y que el cierre depende de los prerrequisitos visibles.
6. Volver al **Plan operativo** y a **Cola**; comprobar que cada superficie conserva su función y
   que el trabajo terminal ya no permanece pendiente.

**38–42 min · Propuestas para revisar.** En **Alcance de recursos**, mostrar el catálogo sintético y
la superficie editorial. Explicar que crear/revisar una propuesta de IA no crea mappings, Standards
ni Rules. No realizar llamadas externas salvo staging expresamente autorizado.

**42–45 min · Persona trabajadora 360 y cierre.** Ir a **Personas / Trabajadores**, abrir **Persona trabajadora sintética 001** y recorrer:

- **Resumen:** centro, cargo e historia; la persona no consume una cuenta de acceso.
- **EPP:** guantes sintéticos, asignación e inspección de condición.
- **Capacitación:** requisito de bloqueo y etiquetado, fecha y estado.
- **Incidentes:** casi incidente sintético vinculado y acceso a su historia.

Si queda tiempo, ir a **Preguntar / Operar** (`/app/assistant`) y demostrar estas intenciones con el mensaje o control equivalente disponible:

- “¿Qué necesita atención?” → **¿Qué tengo pendiente?**
- “¿Por qué esta inspección aparece pendiente?” → abrir el elemento y usar **¿Por qué está pendiente?**
- “Muéstrame la base de este criterio.” → en Inspección guiada usar **¿Por qué este criterio?**
- “Prepara una acción para este hallazgo.” → preparar la acción y mostrar la tarjeta de confirmación.

Detenerse en la confirmación para evidenciar que el asistente no modifica el dominio de forma autónoma. Solo confirmar si se desea registrar el cambio sintético durante la sesión.

## B. Ruta exacta de navegación

1. `/auth/login` → iniciar sesión.
2. `/app` → **Necesita atención** → **Ver cola completa**.
3. `/app/plans` → generar/activar borrador → abrir actividad prioritaria.
4. `/app/inspections/new` → ELECTRICAL → Tomacorriente → crear.
5. `/app/inspections/{id}` → scope, base, estándar, criterios y hallazgos.
6. `/app/inspections/{id}/findings/{id}` → GTC45, acción, evidencia y residual.
7. `/app/plans/{id}` y `/app/work` → verificar proyección y enlaces canónicos.
8. `/app/settings/inspection-resources` → catálogo y propuestas editoriales separadas.
9. `/app/workers` → **Persona trabajadora sintética 001** → Worker 360.
10. `/app/assistant` → consultas y operación guiada con confirmación.

## C. Qué demuestra cada pantalla

- **Centro de comando:** priorización diaria, no un certificado de cumplimiento.
- **Cola de trabajo:** una proyección trazable de trabajo pendiente de varios módulos.
- **Inspección:** separación entre estándar técnico, criterio observado, fundamento y método de riesgo.
- **Hallazgo:** valoración inicial, control/acción, evidencia, residual y reglas de cierre.
- **Worker 360:** historia operativa unificada de EPP, capacitación e incidentes sin convertir al trabajador en usuario del SaaS.
- **Preguntar / Operar:** explicación y preparación asistida con alcance autorizado, citas cuando existen y confirmación humana antes de escribir.

## D. Cinco preguntas para Anita

1. Si fueras responsable de SST en una empresa, ¿este flujo inspección → hallazgo → riesgo → control → acción coincide con tu forma real de trabajar?
2. Al configurar una inspección, ¿qué esperarías elegir primero: dominio, estándar técnico, procedimiento de empresa, requisito legal u otra cosa?
3. ¿Las explicaciones del método de riesgo y los criterios guiados son comprensibles para una profesional SST competente sin simplificarlos en exceso?
4. ¿Qué información esperarías ver inmediatamente en el tablero cada mañana?
5. Si el sistema estuviera disponible mañana, ¿cuál sería el primer flujo de un cliente o empresa que intentarías gestionar?

## E. Afirmaciones que no deben hacerse

- No afirmar que Anita aprobó contenido, reglas, estándares o metodologías.
- No presentar el contenido piloto como requisito obligatorio de Ecuador.
- No equiparar un estándar técnico con una ley ni una observación no conforme con incumplimiento legal.
- No afirmar que la plataforma certifica cumplimiento, determina riesgo final o establece causa raíz sin revisión profesional.
- No usar datos reales ni presentar OpenAI como requisito del producto; esta sesión usa procesamiento local controlado.
