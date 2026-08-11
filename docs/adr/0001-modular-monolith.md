# ADR 0001: Monolito modular

## Contexto

El producto necesita entregar capacidades coordinadas sin coste operativo de sistemas distribuidos.

## Decisión

Usar monorepo con una API NestJS monolítica organizada por módulos y una web Next.js separada.

## Alternativas

Microservicios, funciones independientes o una aplicación Next.js única con handlers internos.

## Consecuencias

Transacciones y evolución local son simples; los límites se mantienen por módulos y servicios.

## Riesgos

Acoplamiento accidental entre módulos y crecimiento del proceso único.

## Criterio de revisión futura

Revisar solo con evidencia de escalado o propiedad independiente que el monolito no pueda resolver.
