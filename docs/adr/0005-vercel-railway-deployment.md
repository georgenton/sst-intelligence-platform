# ADR 0005: Vercel y Railway

## Contexto

La web requiere CDN/Next y la API requiere proceso persistente y PostgreSQL.

## Decisión

Desplegar Next.js en Vercel con rewrite `/api/v1`; API Docker en Railway y PostgreSQL separado.

## Alternativas

Todo en Vercel, todo en Railway o Kubernetes.

## Consecuencias

Cada plataforma aloja la carga apropiada; CORS, cookies y dominios deben configurarse juntos.

## Riesgos

Errores cross-origin o incompatibilidad de migración durante rollback.

## Criterio de revisión futura

Revisar por latencia, coste o límites operativos medidos, no por anticipación.
