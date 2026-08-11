# Railway

## Servicios

Crea un servicio PostgreSQL administrado y un servicio API desde el mismo repositorio. La API usa el
contexto raíz del monorepo y `apps/api/Dockerfile`; no uses `docker-compose.yml` en Railway.

## Variables

Define `DATABASE_URL` desde el servicio PostgreSQL, `PORT` (Railway puede asignarlo),
`JWT_ACCESS_SECRET`, `WEB_ORIGIN` con el dominio Vercel, `APP_NAME`, `COOKIE_SECURE=true`, tiempos de
token y configuración AI opcional. No definas OpenAI si `AI_ENABLED=false`.

## Operación

`railway.toml` ejecuta `pnpm --filter @sst/api prisma:deploy` antes de publicar y verifica
`/api/v1/health`. Asigna un
dominio HTTPS y úsalo como `API_ORIGIN` en Vercel. Para rollback, vuelve a una imagen de aplicación
anterior compatible con la migración ya aplicada; las migraciones destructivas requieren estrategia
expand/contract y respaldo. Nunca reviertas una migración eliminando datos en caliente.

Local usa Compose y puerto 5448; demo/producción usan PostgreSQL administrado, TLS, secretos del
entorno, cookies Secure y orígenes explícitos.
