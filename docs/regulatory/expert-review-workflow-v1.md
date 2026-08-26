# Expert Review Workflow V1

El workspace presenta cada `AdaptiveRuleDraft` regulatorio pendiente como **Interpretación
propuesta** junto con pregunta, decisión candidata, hechos, predicados, requisito, artículo oficial,
versión y hash. Owner, Admin y Responsable SST pueden registrar `APPROVED`,
`CHANGES_REQUESTED`, `LEGAL_REVIEW_REQUIRED` o `REJECTED`. Consultant y Viewer no aprueban.

La revisión persiste revisor, fecha, comentario, hash de salida, versión de fuente, requisito y
snapshot de regla. No contiene hechos privados de la organización. La acción no transforma el draft
en regla publicada y no activa un pack; publicación sigue siendo otro gate explícito.

Si aparece una nueva versión oficial, la revisión histórica continúa ligada al artículo anterior.
No se reasigna a “latest”. Una nueva interpretación necesita otro draft/revisión. Los cinco drafts
MDT-2024-196 permanecen pendientes: este trabajo no inventa aprobación de Anita ni revisión legal.
