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

## Registro de release PR44

El despliegue automático de producción `45afbe4d-3090-4b5a-99ef-9af924ca83d6` corresponde al merge
`38a704dd757364bfed498b8c130eb6ded745e80c` de PR #44. El pre-deploy encontró 33 migraciones,
aplicó `20260908120000_adaptive_field_intelligence_v2` y una comprobación posterior confirmó cero
pendientes. Nest inició correctamente y `/api/v1/health` respondió HTTP 200. No se ejecutó seed de
datos de clientes ni despliegue manual.

## Registro de release PR45

El despliegue automático `4910d399-0867-4a4a-96d7-27cb2bc8f3dc` corresponde al merge
`37cfded6c6524abb089acab0c0b0e34bb6d9f071` del HEAD auditado
`f610cfa1dcf221cff0ec1a75b36f4dfb3c7ac808`. El release encontró 33 migraciones y cero pendientes,
completó `reference:sync`, inició Nest y `/api/v1/health` respondió HTTP 200. No se ejecutó seed de
clientes, despliegue manual ni cambio de configuración.

La comprobación productiva de solo lectura confirmó 15 fuentes regulatorias, 25 versiones, 1112
unidades, 893 artículos, 5 Requirements candidatos, 5 RuleDrafts candidatos, 0 RuleVersions reales
publicadas y 0 solicitudes externas de IA. Producción conserva
`CONVERSATIONAL_AI_PROVIDER=DETERMINISTIC_LOCAL_V1`, IA externa deshabilitada y clave OpenAI
ausente. El cierre técnico no recalculó GTC45 ni históricos y conserva 10 decisiones
`PENDING_ANITA` sin atribuir aprobación profesional.
