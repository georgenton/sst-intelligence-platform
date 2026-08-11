# ADR 0003: Entitlements y módulos

## Contexto

Planes, módulos y límites cambian comercialmente y no deben vivir en componentes.

## Decisión

Persistir planes, features, valores, suscripción y activaciones; `EntitlementService` calcula el valor
efectivo y `EntitlementGuard` lo aplica en API.

## Alternativas

Constantes frontend, flags por organización o lógica duplicada por endpoint.

## Consecuencias

El seed configura el catálogo y web refleja la decisión de la API.

## Riesgos

Conflictos entre plan, demo y activaciones manuales; la precedencia debe probarse.

## Criterio de revisión futura

Revisar al incorporar facturación real o contratos Enterprise con overrides.
