# Inspecciones Inteligentes V1

## Problema y usuario

El técnico SST necesita convertir un recorrido en trabajo verificable: registrar hallazgos, valorar
riesgo, asignar acciones, controlar fechas, verificar correcciones, calcular riesgo residual y
detectar recurrencias entre inspecciones. SST managers y administradores necesitan alertas e
indicadores agregados sin perder trazabilidad por organización, centro y área.

## Flujo

1. Una inspección se crea en `DRAFT`, pasa a `IN_PROGRESS` y termina en `COMPLETED`.
2. Un hallazgo registra ubicación, categoría neutral, observación y valores 1–5.
3. El backend calcula el riesgo inicial y ejecuta el motor de recurrencia.
4. Una o más acciones pasan de `OPEN`/`IN_PROGRESS` a `PENDING_VERIFICATION`.
5. Un rol verificador recalcula el riesgo residual. El hallazgo se cierra automáticamente sólo si
   existe al menos una acción, todas las no canceladas están verificadas y existe riesgo residual.
6. Riesgo residual alto/crítico y recurrencia sistémica generan alertas in-app.

## Matriz demostrativa

`DEMO_5X5` versión `1.0.0`: score = probabilidad × consecuencia. 1–4 Bajo, 5–9 Moderado,
10–16 Alto y 17–25 Crítico.

> Metodología demostrativa 5×5. No constituye una metodología regulatoria validada.

El cliente no envía score ni nivel como autoridad.

## Recurrence Engine

Busca antecedentes en la misma organización, centro y categoría dentro de
`INSPECTION_RECURRENCE_WINDOW_DAYS` (90 por defecto). Cero antecedentes: sin recurrencia; uno:
repetido; dos o más: revisión sistémica recomendada. El aviso indica recurrencia y nunca confirma
una causa raíz.

## Privacidad, IA y seguridad

Todas las entidades operacionales incluyen `organizationId`; la API valida membresía, rol y
`module.inspections`. Los audit logs guardan estados e identificadores, no descripciones extensas.
V1 no llama IA para ninguna decisión. Una explicación generativa futura sólo podrá consumir datos
estructurados minimizados y degradar a plantilla sin bloquear la operación.

## No incluido

No incluye metodología ecuatoriana real, fotografías/uploads, OCR, video, embeddings, búsqueda
semántica, causa raíz automática, scheduler, email/push, aplicación móvil, offline-first, firmas,
checklists regulatorios ni integraciones con mantenimiento o ERP. La evidencia V1 se limita a notas
y enlaces HTTPS; object storage queda como extensión posterior.
