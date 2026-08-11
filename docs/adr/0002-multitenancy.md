# ADR 0002: Multitenancy por organización

## Contexto

Usuarios y consultores pueden pertenecer a empresas distintas con roles diferentes.

## Decisión

`Organization` es el límite principal. La API valida `x-organization-id` contra `Membership` y crea
un contexto; toda consulta de dominio usa ese ID validado.

## Alternativas

Base por tenant, esquema PostgreSQL por tenant o aceptar el ID desde cada body.

## Consecuencias

La infraestructura es simple y las consultas requieren filtros explícitos e índices.

## Riesgos

Una consulta sin filtro puede filtrar datos; integración cubre denegación A→B.

PostgreSQL RLS se mantiene como defensa en profundidad futura. No sustituye el contexto y los
filtros de aplicación, y no se incorpora sin una estrategia probada para migraciones, seed y tareas
administrativas.

## Criterio de revisión futura

Revisar aislamiento físico por requisitos regulatorios o volumen demostrados.
