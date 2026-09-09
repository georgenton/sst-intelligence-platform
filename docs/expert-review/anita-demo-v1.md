# Anita Demo V1 — guion de revisión profesional

## Propósito y límites

Esta sesión valida si el modelo de trabajo representa la práctica SST. No busca aprobación comercial, legal ni metodológica automática. Se usarán datos sintéticos; ingeniería no convertirá comentarios profesionales en reglas sin una decisión documentada y un incremento explícito.

| Sección               | Qué mostrar                             | Modelo actual en una frase                                         | Pregunta para Anita                                              | Ingeniería no debe asumir                                    |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Inicio y Cola         | Necesita atención, motivo y deep link   | La Cola proyecta trabajo actual desde agregados canónicos          | ¿Qué información debería abrir cada mañana un responsable SST?   | Que prioridad operativa equivale a riesgo o incumplimiento   |
| Flujo general         | Perfil → brecha → plan → ejecución      | Cada etapa conserva identidad y procedencia                        | ¿Este flujo representa cómo realmente gestionas SST?             | Que toda brecha debe convertirse en trabajo                  |
| Perfil SST            | TRUE/FALSE/UNKNOWN, alcance y evidencia | El Perfil registra hechos conocidos y su procedencia               | ¿Qué hechos de empresa realmente cambian recomendaciones?        | Que falta de información significa “no”                      |
| Evidencia de perfil   | Fuente, fecha y confirmación            | Un hecho puede requerir evidencia o confirmación profesional       | ¿Qué hechos deben tener Evidence?                                | Que todos requieren la misma carga probatoria                |
| Confirmación          | transición y roles autorizados          | La API permite confirmar únicamente a roles profesionales vigentes | ¿Cuáles necesitan confirmación profesional?                      | Que ocultar un botón constituye seguridad                    |
| Aplicabilidad         | candidato y revisión                    | El motor produce configuración candidata determinista              | ¿Qué decisión debe quedar siempre en revisión humana?            | Que el corpus cubre toda la normativa ecuatoriana            |
| Brechas y Plan        | selección explícita                     | Gap no es PlanItem; el usuario decide qué programar                | ¿Cuándo una brecha debe convertirse en Plan?                     | Conversión masiva o automática                               |
| Inspección            | base, recurso y profundidad             | La inspección separa fundamento, alcance y nivel de revisión       | ¿Cómo decides qué inspeccionar y a qué profundidad?              | Que un catálogo sustituye criterio profesional               |
| Resource Scope        | fuente y criterios vinculados           | El alcance limita qué contenido técnico puede apoyar el recorrido  | ¿Cómo decides Resource Scope y fuentes técnicas?                 | Usar estándares no revisados o material protegido            |
| Riesgo técnico        | método, versión, respuestas y resultado | El resultado procede del método determinista seleccionado          | ¿Qué guidance necesita GTC45/5x5?                                | Cambiar fórmulas o emitir diagnóstico automático             |
| Worker 360            | cargo, EPP, capacitación y eventos      | Worker es registro laboral, no necesariamente usuario              | ¿Qué vista usarías para seguimiento cotidiano?                   | Crear cuentas o perfiles médicos por inferencia              |
| Observación/Incidente | evidencia, participantes y acciones     | El evento conserva hechos y seguimiento; no decide causa raíz      | ¿Qué evidencia mínima hace accionable un evento?                 | Causa raíz automática                                        |
| Inteligencia          | tendencias con enlace a fuente          | Resume operación sin declarar cumplimiento o puntuar trabajadores  | ¿Qué indicador orienta gestión sin inducir una conclusión falsa? | Crear un safety score personal                               |
| Asistente             | explicación, propuesta y confirmación   | El asistente es interfaz; dominio y API son autoridad              | ¿Qué parte del sistema usarías primero con una empresa real?     | Que la respuesta de IA sea decisión legal, de riesgo o causa |

## Registro de resultados

Clasificar cada observación como `PENDING_ANITA` hasta que exista decisión profesional. Registrar la frase exacta, pantalla, alternativa sugerida y evidencia en `docs/product/product-validation-finding-template.md`. Separar siempre bug reproducible de preferencia profesional.
