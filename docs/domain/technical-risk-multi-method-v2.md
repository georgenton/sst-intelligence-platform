# Technical Risk Multi-Method V2

Una nueva `TechnicalAssessment` puede añadir una `TechnicalAssessmentRiskValuation` con
`GUIDED_5X5` o `GTC45_2010`. El agregado Technical Assessment conserva su ciclo borrador→ejecución→
completado→revisión→corrección; Risk Method Engine solo valida y calcula la valoración.

Se persisten `riskMethodVersionId`, snapshot del método, entrada validada, salida y fecha de cálculo.
La API usa el mismo provider registry que Inspections. Guided mantiene P y severidad humana 1–5,
P×S canónico, cues y justificación. GTC45 mantiene ND, NE, NP, NC, NR y el tratamiento LOW directo a
nivel IV. El servidor es autoritativo.

Una corrección copia la valoración histórica y conserva exactamente la misma versión; puede cambiar
hechos/inputs mediante recálculo del mismo provider. Cambiar de método requiere una evaluación
independiente. Los assessments legacy sin valoración V2 siguen legibles y no se recalculan.

La política versionada de organización define métodos permitidos y preferido para nuevas
evaluaciones. Owner/Admin/Responsable SST escriben; el profesional puede elegir otro método
permitido. El perfil Guided versiona etiquetas, ayudas y cues, pero nunca JavaScript, fórmulas o
bandas personalizadas.
