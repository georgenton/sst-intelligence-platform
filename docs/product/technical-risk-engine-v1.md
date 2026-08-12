# Technical Risk Method Engine V1

## Alcance

Technical Risk V1 ejecuta evaluaciones técnicas determinísticas a partir de métodos versionados. El
primer catálogo contiene únicamente `DEMO_TECHNICAL_RISK` `1.0.0`, calculado por
`DEMO_TECHNICAL_RISK_5X5`.

> Metodología demostrativa. No constituye una evaluación regulatoria validada.

No implementa una metodología ecuatoriana, NFPA, INSST ni una declaración de cumplimiento. Los
datos de demostración son sintéticos y se identifican con `isDemo=true`.

## Experiencia

El recorrido guía por versión exacta del método, ubicación, contexto, preguntas y resumen. El
formulario recorre las secciones del schema y renderiza cada tipo controlado; no depende de las
claves del método demo. El cliente envía únicamente respuestas; el API selecciona el proveedor
registrado, calcula y persiste el resultado. El detalle
muestra método, versión, score, nivel, instante de cálculo y estado de revisión. Los niveles también
se expresan como Bajo, Moderado, Alto o Crítico para no depender solo del color.

El dashboard resume total, borradores, completadas, revisadas y altas/críticas, además de agrupaciones
por método, centro y nivel. No contiene predicción.

## Ciclo de vida

```text
DRAFT -> IN_PROGRESS -> COMPLETED -> REVIEWED
   \          \            \
    +----------+-----------> CANCELED
```

Solo `DRAFT` puede iniciarse. `complete` acepta únicamente `IN_PROGRESS`, valida todas las respuestas
obligatorias, calcula, crea el resultado y cambia el estado dentro de una transacción. Una segunda
llamada se rechaza de forma controlada con `ASSESSMENT_ALREADY_COMPLETED`.

La selección de catálogo solo incluye versiones activas y vigentes. `POST assessments` requiere
`methodVersionId`; el snapshot corresponde siempre a esa fila exacta, aunque exista una versión
posterior. `regulatory=false` no implica demo: el aviso solo aparece para `isDemo=true`.

La revisión solo acepta evaluaciones `COMPLETED`:

- `APPROVED` registra la revisión y cambia el assessment a `REVIEWED`.
- `NEEDS_REVISION` registra la decisión y mantiene el assessment en `COMPLETED`; V1 no lo reabre.

`APPROVED` significa “revisado por usuario autorizado”. No significa cumplimiento legal,
certificación ni aprobación de una autoridad.

## Acceso

El feature autoritativo es `module.technical_risk`, asociado al módulo `TECHNICAL_RISK`. Owner,
admin, responsable SST, técnico SST y consultor pueden crear y completar. Solo owner, admin y
responsable SST pueden revisar. Viewer es de solo lectura. Los guards del API son autoritativos.

Toda evaluación, respuesta, resultado, evidencia y revisión se consulta con `organizationId`
validado desde la membresía. Los IDs de organización del body no se aceptan. Los métodos globales
tienen `organizationId=null`; un método empresarial futuro podrá pertenecer a una organización y
solo será visible para ella.

## API

- `GET /api/v1/technical-risk/methods`
- `GET /api/v1/technical-risk/methods/:methodKey`
- `GET /api/v1/technical-risk/assessments`
- `POST /api/v1/technical-risk/assessments`
- `GET /api/v1/technical-risk/assessments/:id`
- `PATCH /api/v1/technical-risk/assessments/:id`
- `POST /api/v1/technical-risk/assessments/:id/start`
- `PUT /api/v1/technical-risk/assessments/:id/responses/:questionKey`
- `POST /api/v1/technical-risk/assessments/:id/evidence`
- `POST /api/v1/technical-risk/assessments/:id/complete`
- `POST /api/v1/technical-risk/assessments/:id/review`

## Auditoría y privacidad

Se registran creación, inicio, guardado de respuesta, evidencia, finalización y revisión. Los eventos
de respuesta guardan la clave y el tipo del valor, nunca el texto completo. No se aceptan uploads;
la evidencia V1 es `NOTE` o `EXTERNAL_LINK` HTTPS.

## Límite de IA

V1 no agrega IA. Ningún proveedor de IA recibe o modifica respuestas, score, clasificación,
thresholds, revisión o resultado. Una explicación futura deberá leer un resultado determinístico ya
cerrado sin alterarlo.
