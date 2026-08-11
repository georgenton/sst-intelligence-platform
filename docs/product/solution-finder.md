# Solution Finder 1.0.0

El flujo público tiene seis pasos versionados: empresa, operación, gestión actual, personas y
organización, objetivos e implementación. Una sesión usa UUID y token aleatorio de 256 bits cuyo hash
se persiste; es reanudable por 30 días. Al completar, Zod valida todas las respuestas y el motor puro
genera módulos, scores, razones, plan y rollout. El presupuesto solo cambia el plan y las fases.

Después del registro, `claim` vincula la sesión al usuario y a un `OrganizationContext` validado.
`activate-demo` es idempotente, transaccional, usa el entitlement `demo.enabled`, activa módulos
recomendados como DEMO y crea solo un centro sintético identificado.
