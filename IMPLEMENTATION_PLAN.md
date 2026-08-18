# Implementation plan

## Estado inicial

- Repositorio completamente vacío al 11 de agosto de 2026: 0 archivos y 0 directorios internos.
- No existe todavía un repositorio Git en el directorio de trabajo.
- No hay código, migraciones, configuración ni historial que preservar.
- El incremento se inicializará como un monorepo pnpm/Turborepo con un monolito modular.

## Decisiones

- `apps/web`: Next.js App Router; la interfaz permanece en español y consume `/api/v1` mediante rewrite.
- `apps/api`: NestJS REST con módulos por capacidad, controladores delgados y Prisma solo desde servicios.
- `packages/contracts`: esquemas Zod, tipos y motor determinístico sin dependencias de infraestructura.
- PostgreSQL y Prisma son la fuente de verdad; los identificadores son UUID y toda entidad operacional se aísla por organización.
- La organización activa se obtiene de una cabecera `x-organization-id` y siempre se valida contra la membresía autenticada.
- Los access tokens se mantienen en memoria en web; el refresh token rotatorio se envía en cookie HttpOnly.
- La explicación siempre funciona con plantillas; OpenAI es un adaptador opcional y nunca decide módulos ni puntuaciones.
- Los planes y límites se resuelven mediante features persistidas, no desde componentes.
- La demo se activa en una transacción idempotente y solo crea información sintética claramente identificada.
- Se priorizan verticales ejecutables y probadas. Inspecciones Inteligentes V1 es el primer módulo
  SST operacional; los demás módulos profundos permanecen como contratos y páginas de presentación.

## Fases

1. Inicializar monorepo, reglas del repositorio y quality gates.
2. Crear contratos, motor de recomendaciones, Prisma, migración inicial y seed idempotente.
3. Implementar autenticación, organizaciones, membresías y contexto multitenant.
4. Implementar catálogo, planes, entitlements y límites.
5. Implementar Solution Finder anónimo/reanudable, recomendación y explicación.
6. Implementar activación de demo, dashboard, auditoría y solicitud de mejora.
7. Implementar el recorrido web crítico, estados de UI y selector de organización.
8. Añadir pruebas unitarias, integración, E2E, CI y configuración de despliegue.
9. Instalar, migrar, sembrar y verificar lint, tipos, pruebas y builds.
10. Implementar Inspecciones Inteligentes V1: matriz demo determinística, hallazgos, acciones,
    verificación, recurrencia, alertas, analítica y experiencia web móvil.
11. Implementar Technical Risk Engine + Experience con métodos versionados, trazabilidad y revisión.
12. Implementar Applicability Engine + Experience con perfiles, snapshots y seis estados.
13. Validar Applicability V1 con el laboratorio multiempresa sintético antes de ampliar el dominio.

## Adaptive SST roadmap

- Completado: plataforma, Inspections, Technical Risk, Applicability y Multi-Company Validation Lab.
- Track paralelo actual: Regulatory Source Foundation V1.
- Pendiente de validación experta: decisiones de Profile V2 y Current State & Evidence Baseline.
- Después: Gap Assessment, Depth Resolver + Configuration Proposal y Configuration Activation + MOC.

Current State no fue cancelado; espera evidencia experta. El contenido regulatorio ecuatoriano
avanza en un stream controlado: fuente, versión, extracción, definición de requerimiento, revisión
técnica, revisión legal, redacción de reglas, pruebas y aprobación son gates distintos.

## Riesgos

- La instalación depende de acceso al registro de paquetes; si la red está restringida se documentará con exactitud.
- Las pruebas de integración requieren un PostgreSQL disponible; Docker puede no estar ejecutándose en el entorno.
- Vercel, Railway y OpenAI solo pueden prepararse y documentarse sin credenciales ni autorización de despliegue.
- La protección CSRF se apoya en SameSite, CORS restringido y refresh cookie con ruta acotada; una estrategia de despliegue cross-site requeriría un token CSRF adicional.
- La invitación de miembros es conceptual mediante proveedor de consola; no se envían correos reales.

## Checklist

- [x] Monorepo y configuración raíz.
- [x] Aplicaciones web y API.
- [x] Contratos compartidos y motor determinístico cubierto por pruebas.
- [x] Prisma, migración y seed idempotente.
- [x] Auth con Argon2id, JWT corto y refresh rotatorio.
- [x] Multitenancy, roles, guards y prueba de aislamiento.
- [x] Planes, módulos y entitlements en API y web.
- [x] Solution Finder público, versionado, reanudable y reclamable.
- [x] Activación idempotente de demo y dashboard.
- [x] Auditoría append-only y logs estructurados con request ID.
- [x] AI provider desacoplado con fallback de plantilla.
- [x] Swagger y healthcheck.
- [x] UI responsive, accesible y en español.
- [x] Docker local, Vercel, Railway y GitHub Actions.
- [x] README, ADR y documentación de producto/despliegue.
- [x] `pnpm check`, integración y E2E verificados.
- [x] Commits Conventional Commits creados después de verificaciones exitosas.
- [x] Inspecciones Inteligentes V1 con aislamiento, entitlement y reglas determinísticas.
- [x] Technical Risk Engine + Experience.
- [x] Applicability Engine + Experience.
- [x] Multi-Company Applicability Validation Lab V1.
- [ ] Regulatory Source Foundation V1 (track paralelo actual).
- [ ] Current State & Evidence Baseline V1 (pendiente de validación experta).
- [ ] Gap Assessment Engine V1.
- [ ] Depth Resolver y propuesta de configuración.
- [ ] Activación de configuración y MOC.

## Definición de terminado

Se considera terminado cuando una instalación limpia puede generar el cliente Prisma, aplicar migraciones y seed, iniciar web/API, completar el recorrido diagnóstico → registro → organización → demo → dashboard, demostrar aislamiento multitenant y entitlements con pruebas, y finalizar `pnpm check` sin errores. Cualquier comprobación imposible por limitaciones externas quedará explícitamente registrada y no se presentará como aprobada.

## Gate 1 Audit

Estado final después de inspección, correcciones imprescindibles y verificación dinámica:

| Componente                  | Estado       | Evidencia final                                                                                       |
| --------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Estado real del repositorio | PASS         | Node 24.19.0 se activó con `.nvmrc`; pnpm 10.33.2 y Docker 29.5.3/Compose 5.1.4.                      |
| Git                         | PASS         | Repositorio inicializado en `main`; exclusiones y contenido versionable verificados antes de staging. |
| Arquitectura                | PASS         | Monolito modular, controladores sin Prisma, servicios de aplicación y contratos puros.                |
| Multitenancy                | PASS         | Lectura, edición, recurso nested, usuario externo, membership suspendida y rol VIEWER cubiertos.      |
| Autenticación               | PASS         | Argon2id, JWT corto, rotación atómica, revocación familiar, logout, cookies y throttling probados.    |
| Entitlements                | PASS         | Backend autoritativo; demo/trial/suscripción vencidos dejan de conceder acceso.                       |
| Migraciones y seed          | PASS         | Dos migraciones aplicadas desde base nueva y seed ejecutado dos veces con conteos estables.           |
| Docker API                  | PASS         | Imagen Node 24 construida y ejecutada; health/Swagger, no-root, production y SIGTERM verificados.     |
| Proxy frontend/backend      | PASS         | Cliente relativo `/api/v1`, rewrite server-side configurable y E2E sobre proxy.                       |
| Cookies y seguridad web     | PASS         | Modelo same-origin documentado; HttpOnly, SameSite, Path y renovación comprobados.                    |
| Pruebas                     | PASS         | Unitarias, integración y E2E ejecutadas; cero fallos y cero skipped.                                  |
| CI                          | NOT VERIFIED | Workflow auditado y corregido estáticamente; no existe remoto donde ejecutar GitHub Actions.          |
| Railway/Vercel              | WARNING      | Configuración y builds locales coherentes; despliegue remoto no ejecutado por falta de proyectos.     |
| Ausencia de secretos        | PASS         | Escaneo por patrones y exclusiones Git: solo placeholders locales documentados.                       |
| Calidad del código          | PASS         | Lint, typecheck y build sin caché; sin `any`, supresiones, TODO, FIXME o HACK en código.              |

Hallazgos corregidos durante el gate: throttling global inactivo, Prisma en health controller,
rotación refresh no atómica, expiración incompleta de accesos temporales, carreras de claim/demo,
runtime Docker sin enlaces pnpm/OpenSSL, advertencias Jest/Turbo y discrepancia documental Railway.
