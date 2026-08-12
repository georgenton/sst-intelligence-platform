# ADR 0008: Motor de métodos técnicos versionados

- Estado: aceptado
- Fecha: 2026-08-11

## Contexto

La plataforma necesita ejecutar varios métodos SST futuros sin crear un backend por método y sin
convertirse en un motor no-code con fórmulas o scripts arbitrarios. Los resultados cuantitativos
deben poder reproducirse y auditarse aun cuando el catálogo evolucione.

## Decisión

Separar definición, versión, evaluación, respuesta, resultado, evidencia y revisión. Una versión
`ACTIVE` es inmutable para el flujo de aplicación: V1 no expone operaciones de edición y cualquier
cambio futuro crea una versión nueva. La evaluación referencia la fila original y además conserva
un snapshot mínimo con clave y nombre del método, versión, schema controlado, calculation key,
carácter regulatorio, país y disclaimer.

El schema se valida con Zod y solo admite `BOOLEAN`, `SINGLE_CHOICE`, `INTEGER`, `DECIMAL`, `TEXT`,
`LIKELIHOOD` y `CONSEQUENCE`. No admite grafos condicionales, JavaScript, plugins ni fórmulas
arbitrarias.

`TechnicalCalculationRegistry` resuelve una `calculationKey` contra proveedores TypeScript
registrados explícitamente. Un key desconocido falla; JSON describe formulario y configuración,
pero nunca ejecuta lógica. El método DEMO usa la primitiva matemática 5×5 ya probada por
Inspections: score `likelihood × consequence` y los límites 1–4, 5–9, 10–16 y 17–25.

Technical Assessments e Inspection Findings permanecen separados. Comparten una función matemática
pura porque esa regla coincide; no comparten entidades, lifecycle ni persistencia, evitando que el
workflow de inspecciones determine el de una metodología técnica.

El resultado solo lo crea el backend en la misma transacción que marca `COMPLETED`. Completar por
segunda vez se rechaza con `ASSESSMENT_ALREADY_COMPLETED`. Una revisión `NEEDS_REVISION` queda
registrada pero no reabre automáticamente; `APPROVED` lleva a `REVIEWED` y significa únicamente que
revisó un usuario autorizado.

## Consecuencias

- Los resultados históricos son reproducibles con su snapshot y calculation key.
- Añadir un método requiere un proveedor probado y una versión persistida; no basta cambiar JSON.
- La abstracción admite métodos globales y, posteriormente, versiones empresariales tenant-scoped.
- Una validación normativa real exige un incremento separado, fuentes autorizadas y revisión legal.
- La arquitectura de IA existente no participa en decisiones técnicas.
