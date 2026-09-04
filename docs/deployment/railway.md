# Railway

## Servicios

Crea un servicio PostgreSQL administrado y un servicio API desde el mismo repositorio. La API usa el
contexto raíz del monorepo y `apps/api/Dockerfile`; no uses `docker-compose.yml` en Railway.

## Variables

Define `DATABASE_URL` desde el servicio PostgreSQL, `PORT` (Railway puede asignarlo),
`JWT_ACCESS_SECRET`, `WEB_ORIGIN` con el dominio Vercel, `APP_NAME`, `COOKIE_SECURE=true` y tiempos de
token. Producción debe declarar `SST_DEPLOYMENT_ENVIRONMENT=production`,
`CONVERSATIONAL_AI_PROVIDER=DETERMINISTIC_LOCAL_V1`,
`CONVERSATIONAL_AI_EXTERNAL_ENABLED=false` y `AI_ENABLED=false`; no configures una clave OpenAI en
producción. La cohorte OpenAI se configura únicamente en un servicio staging separado según
[OpenAI Controlled Staging Integration V1](../architecture/openai-controlled-staging-v1.md).

## Operación

`railway.toml` ejecuta `pnpm --filter @sst/api production:release` antes de publicar. El comando
aplica `prisma migrate deploy` y después `reference:sync`; cualquier migración, manifiesto inválido
o drift de referencia aborta el release antes de iniciar Nest. El contenedor conserva
`node apps/api/dist/main.js` como comando de inicio y Railway verifica `/api/v1/health`. Asigna un
dominio HTTPS y úsalo como `API_ORIGIN` en Vercel. Para rollback, vuelve a una imagen de aplicación
anterior compatible con la migración ya aplicada; las migraciones destructivas requieren estrategia
expand/contract y respaldo. Nunca reviertas una migración eliminando datos en caliente.

`reference:sync` no ejecuta el seed general: sincroniza exclusivamente datos globales,
determinísticos y versionados de Risk Methodology. No crea usuarios, organizaciones, membresías,
centros, inspecciones, hallazgos ni sesiones demo. Los datos globales históricos de Technical Risk,
Applicability y Regulatory Source continúan aprovisionados por sus migraciones; el sincronizador no
los duplica ni los modifica.

Local usa Compose y puerto 5448; demo/producción usan PostgreSQL administrado, TLS, secretos del
entorno, cookies Secure y orígenes explícitos.
