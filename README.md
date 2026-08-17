# SST Intelligence Platform

Primer incremento funcional de una plataforma SaaS B2B multiempresa para Seguridad y Salud en el
Trabajo. La marca se configura con `APP_NAME`/`NEXT_PUBLIC_APP_NAME`; el valor de desarrollo es
**SST Inteligente**.

La solución ofrece autenticación propia, múltiples organizaciones por usuario, diagnóstico guiado,
recomendaciones determinísticas, explicación por plantilla u OpenAI opcional, planes y entitlements,
demo conceptual activable, dashboard, auditoría y aislamiento por organización. No promete
cumplimiento legal ni contiene evaluaciones SST profundas, información médica o pagos.

## Requisitos

- Node.js 24 LTS (`.nvmrc` y `.node-version`).
- Corepack y pnpm 10.33.2.
- Docker Desktop con Compose.

## Inicio local

```bash
nvm use
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: `http://localhost:3000`. API: `http://localhost:3001/api/v1`. Swagger:
`http://localhost:3001/api/v1/docs`. Healthcheck: `http://localhost:3001/api/v1/health`.
PostgreSQL usa el puerto host `5448` para no colisionar con instalaciones habituales en `5432`.

El navegador consume siempre `/api/v1`; Next.js reescribe hacia `API_ORIGIN`. El access token vive
en memoria y el refresh token rotatorio en una cookie HttpOnly.
El modelo de amenazas y sesión está documentado en `docs/security/web-session-model.md`.

## Comandos

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm validate:sst-scenarios
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm check
pnpm db:deploy
pnpm db:seed
```

`pnpm validate:sst-scenarios` valida las ocho empresas sintéticas contra el pack demo exacto y genera
reportes ignorados por Git en `.artifacts/applicability-scenarios/`. Puede seleccionar un escenario con
`pnpm validate:sst-scenarios --scenario EC_DEMO_CHEMICAL_PHARMA` o recibir JSON local estricto con
`--input`. Casos expertos pseudonimizados permanecen fuera del repositorio.

`pnpm check` ejecuta lint, tipos, unitarias, el laboratorio de escenarios y build. Integración necesita PostgreSQL y E2E necesita
además Chromium (`pnpm --filter @sst/web exec playwright install chromium`).

## Organización

```text
apps/
  api/       NestJS, Prisma, REST y Swagger
  web/       Next.js App Router y Playwright
packages/
  contracts/ reglas y esquemas Zod compartidos
  api-client/cliente fetch tipado
  ui/        primitivas accesibles
  eslint-config/
  typescript-config/
  testing/
docs/
  README.md  índice canónico
  adr/ architecture/ domain/ product/ regulatory/ validation/ deployment/
tools/
  applicability-scenarios/ laboratorio determinístico sin red
infra/
  docker/
```

## Variables

Consulta `.env.example`. Son obligatorias en producción: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`WEB_ORIGIN`, `API_ORIGIN`, `APP_NAME` y `NEXT_PUBLIC_APP_NAME`. La IA permanece desactivada salvo
que `AI_ENABLED=true`, `AI_PROVIDER=openai`, `OPENAI_API_KEY` y `OPENAI_MODEL` estén definidos. El
modelo nunca se fija en la lógica de dominio.

## Seguridad multitenant

La API recibe la organización activa en `x-organization-id`, valida una membresía activa y construye
`OrganizationContext`. Los bodies de dominio no aceptan `organizationId`. Roles y entitlements se
aplican en guards; la UI solo refleja sus decisiones. AuditLog es append-only desde la API.

## Despliegue

Vercel compila `apps/web` desde el monorepo y necesita `API_ORIGIN` apuntando a Railway. Railway usa
`apps/api/Dockerfile`, un PostgreSQL separado, `pnpm db:deploy` como pre-deploy y
`/api/v1/health` como healthcheck. Detalles en `docs/deployment/`.
