# Mapa de componentes, contratos y guardas

Este mapa se construyó leyendo los controllers, la navegación y los modelos Prisma del main SHA. Sirve para revisar una superficie completa: una ruta aislada no cuenta como capacidad operable.

## Superficies del piloto

| Superficie UI  | Contrato API                                                                                | Persistencia                                                            | Guarda y rol                                                                                                          | Entitlement / dependencia                              | Evidencia                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Inicio         | `GET /api/v1/organizations` y consultas de contexto                                         | `Organization`, `Membership`, `OrganizationModule`                      | token + organización activa                                                                                           | baseline FREE/CORE                                     | `apps/web/app/app/page.tsx`, `organizations.controller.ts`                                              |
| Evaluación SST | `/api/v1/sst-assessment/*`                                                                  | `SstAssessmentSession`, respuestas, resultado                           | sesión pública acotada; token + organización para continuidad                                                         | contratos SST, configuración adaptativa, motor `1.2.0` | `sst-assessment.controller.ts`, `guided-sst-assessment-flow.spec.ts`                                    |
| Plan operativo | `/api/v1/operational-plans/*`                                                               | `OperationalPlan`, versiones, items y ejecución                         | token + organización; escritura owner/admin/manager/technician/consultant; activar owner/admin/manager                | contexto de evaluación y cola                          | `operational-plans.controller.ts`, `assessment-operational-plan.spec.ts`                                |
| Inspecciones   | `/api/v1/inspections/*`, `inspection-bases`, `inspection-standards`, `inspection-resources` | inspección, criterios, hallazgos, alertas, bases, estándares y recursos | token + organización + entitlement; escritura owner/admin/manager/technician/consultant; revisión owner/admin/manager | `module.inspections`, estándares y metodología         | `inspections.controller.ts`, `inspection-standards.controller.ts`, `inspection-resources.controller.ts` |
| EPP            | `/api/v1/ppe/*` y `/api/v1/workers/*`                                                       | catálogo, requisito, entrega, inspección, reemplazo, worker, cargo      | token + organización + entitlement; escritura owner/admin/manager/technician/consultant; revisión owner/admin/manager | `module.ppe`, catálogo, cargos/personas                | `ppe.controller.ts`, `workers.controller.ts`, PR53 E2E                                                  |

## Superficies de apoyo

| Superficie        | Contrato / modelo                                                                                | Propósito                                               | Estado                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------- |
| Centros y claim   | `/api/v1/organizations/*`; `Organization`, `WorkCenter`, `Membership`                            | contexto de empresa, centros y continuidad de registro  | `SUPPORT_READY`; producción requiere cierre API/DB         |
| Cargos y personas | `/api/v1/workers/*`; `Worker`, `Position`, `PositionRiskContext`                                 | población asignada, cargos y candidatos deterministas   | `SUPPORT_READY`                                            |
| Riesgo técnico    | `/api/v1/technical-risk/*`; `TechnicalAssessment`, respuestas, resultado, evidencia y valoración | valoración trazable y revisión                          | `SUPPORT_READY`, módulo guardado                           |
| Acciones          | plan, inspecciones e incidentes                                                                  | pasar de resultado a responsable/fecha/estado/evidencia | `SUPPORT_READY`                                            |
| Evidencias        | `/api/v1/evidence-packages/*`; `EvidencePackage`, items y referencias                            | reunir referencias y cerrar paquetes                    | `SUPPORT_READY`                                            |
| Cola de trabajo   | `/api/v1/work-queue/*`; obligaciones y ejecuciones                                               | priorizar tareas derivadas                              | `SUPPORT_READY`; verificar generación EPP antes del piloto |
| Equipo y acceso   | organizaciones e invitaciones                                                                    | roles, miembros, claim y contexto                       | `SUPPORT_READY`                                            |

## Capacidades secundarias o de revisión

- **Incidentes:** `/api/v1/incidents/*`, entitlement `module.incidents`, roles de escritura de operación y revisión administrativa.
- **Capacitación:** `/api/v1/training/*`, entitlement `module.training`, sesiones y participantes.
- **Permisos:** `/api/v1/work-permits/*`, entitlement `module.work_permits`, aprobaciones y evidencias.
- **Biblioteca normativa:** `/api/v1/regulatory-sources/*`, `/api/v1/applicability/*` y `/api/v1/regulatory-content/*`; sirve para review-only. No implica reglas reales publicadas.
- **SISAT/Psicosocial:** no tienen controller ni ruta dedicada en el baseline; su estado correcto es `NEXT_SCOPE`.

## Invariantes comunes

1. El controller solo valida transporte y delega; Prisma permanece en servicios.
2. Toda consulta de dominio usa el `organizationId` validado por contexto/membership; el body no decide arbitrariamente la organización.
3. El entitlement es una guarda de API, no una condición visual. La navegación puede descubrir una capacidad bloqueada, pero no autoriza la mutación.
4. La evaluación y el plan conservan procedencia y versión de motor; ningún flujo agrega respuestas ficticias.
5. EPP conserva selección humana y no activa recomendaciones de módulo ni cambia entitlements por abrir una pantalla.
6. Evidencia clínica individual queda fuera de las superficies administrativas descritas aquí.

## Cómo usar el mapa

Para aceptar una superficie, verificar primero la ruta web, luego el controller y DTO/contrato, después servicio/modelos, guardas de rol/entitlement y finalmente una prueba o gate que cubra el recorrido. El archivo [module-readiness.csv](./module-readiness.csv) mantiene el mismo denominador para no contar una ruta de menú como una capacidad completa.
