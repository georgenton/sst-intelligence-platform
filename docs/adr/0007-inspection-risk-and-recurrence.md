# ADR 0007: Riesgo y recurrencia en inspecciones

## Contexto

El primer módulo SST operacional necesita valorar hallazgos, verificar correcciones y detectar
patrones repetidos sin presentar inferencias como decisiones regulatorias ni causas confirmadas.

## Decisión

El score y el nivel de riesgo se calculan mediante una función pura versionada. La definición
`DEMO_5X5` versión `1.0.0` multiplica probabilidad y consecuencia de 1 a 5. Es expresamente
demostrativa, no regulatoria y no se presenta como metodología ecuatoriana validada.

Recurrence V1 cuenta hallazgos anteriores de la misma organización, centro y categoría durante una
ventana configurable de 90 días. Cero antecedentes significa `NONE`, uno `REPEATED` y dos o más
`SYSTEMIC_REVIEW_RECOMMENDED`. El umbral es política de producto V1, no regla legal. Una alerta de
recurrencia recomienda revisar factores sistémicos, pero no confirma causa raíz.

No se usan embeddings ni LLM para score, recurrencia, estados, cierre o escalamiento. El volumen y
la calidad de datos de V1 no justifican infraestructura vectorial, y la coincidencia estructurada es
explicable y comprobable.

## Consecuencias

Inspection y Finding almacenan clave y versión del método, por lo que nuevos métodos validados
podrán coexistir sin rediseñar el flujo. Las categorías siguen siendo un catálogo neutral, no un enum
legal en la base. La recurrencia puede producir falsos positivos semánticos, que la UI presenta como
señal de revisión y no como diagnóstico.

## Evolución

Una versión futura podrá añadir métodos validados por configuración y mejorar la recuperación de
antecedentes. Embeddings sólo se evaluarán con controles de privacidad, corpus representativo,
métricas y una capa determinística que conserve la autoridad de las decisiones.
