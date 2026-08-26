# Regulatory Risk Link V1

`InspectionFindingRegulatoryLink` y `TechnicalAssessmentRegulatoryLink` conectan un riesgo
tenant-private con un `RegulatoryUnit` y/o `RegulatoryRequirement` global. La procedencia es finita:
`SYSTEM_RULE_MATCH`, `EXPERT_LINK` o `USER_REFERENCE`; siempre exige una justificación.

La API resuelve el hallazgo/evaluación dentro de la organización activa y comprueba los objetivos
globales. Technical Risk solo acepta vínculos sobre evaluaciones V2 con valoración versionada. Las
lecturas devuelven artículo, versión y fuente exactos.

Un vínculo expresa relevancia documentada, no incumplimiento. La UI presenta “Fundamento normativo”
separado de “Metodología de valoración”. GTC45 pertenece a la segunda sección; una norma ecuatoriana
pertenece a la primera.
