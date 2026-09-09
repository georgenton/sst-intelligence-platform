# Runtime E2E de producción y aislamiento del limitador

## Ejecución

Ejecutar `pnpm build` antes de `pnpm test:e2e`, con PostgreSQL aislado, migraciones y seed
aplicados. Web ejecuta `.next/standalone/apps/web/server.js` con `.next/static` y `public`
(si existe). API ejecuta `dist/main.js`, sin compiladores/watchers. `NODE_ENV=test` permite
cookies HTTP locales; no cambia reglas de throttling, guardias, roles ni autenticación.

`run-e2e-batches.mjs` obtiene el inventario real mediante `playwright test --list` y ejecuta
un archivo por lote, ordenado por nombre. Cada invocación arranca/cierra los servidores;
`reuseExistingServer=false` impide reutilizar presupuestos o procesos ajenos. Se conservan los
servidores de registro 3102–3104 existentes, ahora también frescos por lote. La aplicación
navegada usa la API 3101, con los límites originales. No hay headers IP falsificados.

Inventario actual: 15 lotes / 18 pruebas:

1. `adaptive-configuration-flow.spec.ts` (1)
2. `app-shell-command-center.spec.ts` (1)
3. `appearance-foundations.spec.ts` (1)
4. `applicability-flow.spec.ts` (1)
5. `consultant-portfolio-flow.spec.ts` (1)
6. `conversational-operations-flow.spec.ts` (1)
7. `evidence-package-flow.spec.ts` (1)
8. `governance-flow.spec.ts` (1)
9. `inspection-standards-flow.spec.ts` (1)
10. `inspections-flow.spec.ts` (1)
11. `operational-execution-flow.spec.ts` (1)
12. `operational-intelligence-flow.spec.ts` (1)
13. `risk-methodology-flow.spec.ts` (1)
14. `technical-risk-flow.spec.ts` (1)
15. `workforce-safety-flow.spec.ts` (4)

Cada prueba descubierta debe aparecer exactamente una vez en los reportes JSON, sin skips,
fallos esperados, repeticiones ni retries. Workers=1; retries=0; se detiene al primer fallo.
No hay warmup por ruta, mocks de API ni Next dev. Los reportes quedan ignorados en
`apps/web/test-results/batches/`. Para diagnóstico focal: `pnpm test:e2e consultant-portfolio-flow.spec.ts`.

## Identidad y límites reales

Fuentes: `apps/api/src/app.module.ts`, `apps/api/src/auth/auth.controller.ts` y
`@nestjs/throttler` 6.5.0 (`throttler.guard.js`, `throttler.service.js`). No hay tracker,
generador de clave, storage ni trust-proxy personalizados.

- Tracker: `req.ip`, no usuario ni tenant.
- Clave: SHA256 de `${controllerClass}-${handlerName}-${throttlerName}-${req.ip}`.
- Throttler: `default`.
- Límite general: 120 por handler/IP; register=5, login=5, refresh=30.
- TTL: 60.000 ms. Cada hit tiene expiración en memoria; exceder el límite bloquea por
  60.000 ms (blockDuration usa TTL por defecto). `Retry-After` se expresa en segundos.
- Storage: `ThrottlerStorageService`, un Map por instancia de aplicación/proceso. Reiniciar
  legítimamente el proceso crea estado nuevo, sin tocar la política de producción.

Los navegadores E2E llegan al mismo servidor BFF/API local: cambiar de usuario no cambia IP.
La suite sin particionar acumulaba refreshes de tests independientes en el bucket de
`AuthController.refresh`. El aislamiento por archivo elimina esa dependencia entre pruebas,
no elimina el límite dentro de cada flujo.

La integración de plataforma prueba con AppModule real: cinco logins válidos permitidos,
sexto=429 con Retry-After, cierre de la instancia, segunda instancia con las mismas
credenciales/IP y política, cinco permitidos y sexto=429 otra vez. No override de providers,
reloj, storage ni guardias. Se conserva la regresión anterior de login inválido/429.

## Portfolio: contrato de navegación y evidencia forense

Clasificación primaria de la carrera reproducida: `TEST_EXPECTATION_ORDER`.

El test anterior hacía `goto('/app/portfolio')`, comprobaba geometría y operaba por API antes
de `reload()`. El evento load/URL no prueba sesión, memberships, contexto o query listos.
En reproducciones locales normales y con CPU/red limitadas pasó. Una barrera forense en la
entrega de la respuesta **real** del refresh previo reprodujo el mismo timeout de
«Organizaciones»: refresh previo=201, documento reload=200, siguiente refresh=401,
Portfolio/organizations no iniciados y pantalla final de login. No hubo 429 ni fallo estático.
Interrumpir la entrega de una cookie rotada puede dejar la cookie anterior; la API rechaza
su reutilización según la política existente. La barrera temporal no forma parte del código final.

El run histórico de GitHub 33711005207 no publicó su trace como artifact: esta reproducción
demuestra la carrera en el orden del test, no acredita retrospectivamente sus respuestas HTTP.

La reparación establece primero el Portfolio autenticado completo. En cada navegación/reload
se esperan respuestas **originadas después del documento nuevo**, no consultas pendientes del
documento anterior: refresh=201 con usuario correcto, organizations=200 con set exacto,
Portfolio=200 con set exacto y entitlements=200 del contexto esperado. Después se exige contexto
exacto, `aria-busy=false`, título y botón «Organizaciones» visibles. No cambia timeout ni selector
semántico. Se imprime diagnóstico seguro de estados, URL sin query/fragment, errores y requests
fallidos; nunca bodies, tokens ni cookies.

Se comprueba B seleccionada → reload → B exacta; y A seleccionada → suspensión → reload →
solo B en memberships/Portfolio/contexto, A ausente, acceso directo y confirmación de escritura
denegados. Se preservan rol vigente por organización, entitlements, citas y navegación canónica.

## Gate

`pnpm check`, integración completa (27 suites; 65 pruebas tras agregar el límite real), reference
sync repetido, imagen Docker y las 18 E2E contra standalone deben pasar. No se añaden migraciones,
políticas comerciales ni cambios productivos salvo eliminar el bypass del candidato anterior.
`next-env.d.ts` debe quedar idéntico a main. No rerun de CI: un fallo del nuevo HEAD detiene el gate.

## Cierre productivo PR36/37/38 — 2026-09-03

PR38 integró el HEAD auditado `bdf70b815a897cb40d9a6a58507009add256b3cd` mediante merge commit
`c5bc3a2cc38db10e39e4e66117f7d18e296dd509`. El Quality Gate de main
[33779146371](https://github.com/georgenton/sst-intelligence-platform/actions/runs/33779146371)
pasó en el intento 1, sin rerun: 27 suites / 65 pruebas de integración y 18/18 E2E,
15 lotes, workers=1, retries=0, retried=0. También pasaron build, reference sync e imagen Docker.
El HEAD del PR había pasado el run 33775422634, igualmente en el primer intento.

La evidencia utiliza el artefacto Next standalone de producción, no Next dev. No existe una lista
de calentamiento por ruta ni bypass de autenticación o throttling. La regresión 429 usa el
AppModule y el limitador reales. Los buckets actuales permanecen en memoria por proceso, adecuados
a la topología actual de una réplica; el almacenamiento distribuido se difiere hasta que el
escalado horizontal lo requiera. No se introdujo Redis ni se cambiaron límites productivos.

Railway y Vercel desplegaron automáticamente ese merge SHA. Railway ejecutó `prisma migrate deploy`
→ `reference:sync` → Nest, con 29 migraciones, cero pendientes y health HTTP 200/status=ok; no se
ejecutó el seed general. Vercel quedó READY, source=git, target=production, ref=main y sin aliasError.

El smoke sintético productivo verificó roles vigentes por organización, entitlements distintos
(A demo / B FREE), Portfolio y citas, Work Queue/señales/evidencia, navegación a Inspections/Work/
Technical Risk, Portfolio → Assistant y Worker workspace. La misma sesión perdió acceso a A tras
suspensión: el siguiente Portfolio excluyó A, el acceso directo y una confirmación preparada
devolvieron 403; el hard reload restauró sesión con solo B visible y activa. No hubo errores JS,
5xx ni fallos inesperados de red. Las primeras comprobaciones del smoke temporal necesitaron
activar la demo por el flujo normal y distinguir dos citas válidas; no se reparó código productivo
ni se relanzó CI. Solo se crearon fixtures etiquetados como sintéticos, sin datos de clientes.

Este cierre documental no cambia el runtime. El commit documental posterior debe conservar un
nuevo Quality Gate exitoso en intento 1 y despliegues automáticos alineados con su SHA antes de
entregar main limpio y sincronizado. No habilita selección ni integración de un proveedor externo.

## Cierre productivo PR42 — 2026-09-07

PR42 integró el HEAD auditado `a788e219bf5dcc06d80e181bd0d06d9048528d71` mediante merge commit
`1bfb08132789b305bdac7013deaed1d43914699f` a las `2026-09-07T21:55:33Z`. El Quality Gate de main
[34164860832](https://github.com/georgenton/sst-intelligence-platform/actions/runs/34164860832)
pasó en el intento 1, sin rerun: 29 suites / 68 pruebas de integración y 18/18 E2E,
15 lotes, workers=1, retries=0, retried=0. También pasaron migraciones, seed/reference sync, lint,
typecheck, unitarias, validadores regulatorios, build e imagen de runtime.

Railway desplegó automáticamente el servicio API de producción con estado `SUCCESS`, branch
`main` y commit SHA exacto del merge; health respondió HTTP 200. Vercel desplegó automáticamente
el proyecto demo con estado `READY`, target `production`, ref `main` y el mismo SHA. El proyecto
staging mantuvo su deployment productivo aislado en `codex/isolated-staging-environment-v1` y no se
promovió ni copió su base de datos.

El smoke productivo fue de solo lectura y no creó datos: frontend y rutas de Plan Operativo,
Work Queue, Inspections, Resource Scope, Risk Methods/GTC45 e Inspection Basis respondieron 200;
health API respondió 200 y los endpoints protegidos sin credenciales respondieron 401, nunca 5xx.
La funcionalidad autenticada y los caminos legacy se validaron en el gate aislado 18/18 del SHA
exacto. No se usó información de clientes.

La base productiva conserva 15 RegulatorySources, 25 SourceVersions, 1112 RegulatoryUnits, 893
ARTICLE, 5 candidate Requirements, 5 candidate RuleDrafts y 0 real published RuleVersions. No hubo
recalculation/backfill histórico, cambio de fórmula GTC45, cambio de RiskMethodVersion, publicación
de runtime mapping desde propuestas, pricing ni nuevas asignaciones PlanFeature. Plan Operativo y
Work Queue siguen siendo conceptos separados; el camino legacy multi-source sin scope permanece.

La taxonomía y sus mappings eléctricos son sintéticos y siguen pendientes de Anita; el mapping
scoped multi-source continúa diferido. El flujo editorial con IA sigue limitado a staging.
Producción conserva `DETERMINISTIC_LOCAL_V1`, `OPENAI_API_KEY` ausente y cero solicitudes externas.
Este cierre no atribuye aprobación a Anita ni inicia Workforce Safety Product Refinement V2.

## Cierre productivo PR43 — 2026-09-08

PR43 integró el HEAD auditado `7f8f222e3da030fd0b0bea8cf7bad583d953a071` mediante merge commit
`f834920664c7bcb3ade8ff07933e870e7809c13d` a las `2026-09-08T17:54:53Z`. El Quality Gate de main
[34259930387](https://github.com/georgenton/sst-intelligence-platform/actions/runs/34259930387)
pasó en el intento 1, sin rerun: 23 archivos / 318 pruebas de contracts, 13 suites / 48 pruebas API,
103 pruebas web, 30 suites / 69 pruebas de integración y 19/19 E2E, 15 lotes, workers=1, retries=0
y retried=0. También pasaron migraciones, seed, lint, typecheck, validadores SST/regulatorios,
build, reference sync repetido e imagen runtime.

Railway desplegó automáticamente `d62d7682-9626-4e4d-9c4e-edbbfef4189a` desde `main` y el merge
SHA exacto. El release aplicó la migración 32
`20260907232300_workforce_safety_refinement_v2`, completó reference sync, inició Nest y respondió
health HTTP 200 sin crash loop. Vercel Demo desplegó automáticamente
`dpl_4qAd4cMXZRMzu4yokeUyba4y9AFN`, READY/production, con el SHA exacto y aliases canónicos.
Staging production no fue promovido: conserva el track PR41
`5ed765d7387f51f53821296fbec8944b16e87a8b` y sus bases y variables permanecen aisladas.

El smoke productivo fue de solo lectura y no usó datos de clientes. La página de inicio de sesión y
las páginas de Workers, EPP, Incident, Safety Observation, Training y Work Queue respondieron HTTP 200; health
API respondió 200 y los endpoints de dominio protegidos, sin credenciales, respondieron 401 en vez
de 5xx. La funcionalidad autenticada, detalles, historia y convergencia están cubiertos por el gate
aislado 19/19 del mismo runtime.

La base productiva conserva 15 RegulatorySources, 25 RegulatorySourceVersions, 1112
RegulatoryUnits, 893 ARTICLE, 5 candidate Requirements, 5 candidate RuleDrafts y 0 real published
RuleVersions. La migración no contiene backfills, updates, deletes ni drops; Worker/User/Membership,
Plan Operativo/Work Queue y los agregados de seguridad mantienen sus límites. GTC45 e históricos
de Workforce, inspecciones, riesgos, Resource Scope y planes no fueron recalculados.

Producción usa `CONVERSATIONAL_AI_PROVIDER=DETERMINISTIC_LOCAL_V1`, `AI_ENABLED=false`, no tiene
`OPENAI_API_KEY` y registra cero solicitudes externas, incluidas las relacionadas con Workforce.
Terminología, mappings Position/risk/EPP, guidance de estándares/certificaciones, categorías de
ubicación, refinamiento Ishikawa, guidance de capacitación y captura de Safety Observation quedan
PENDING ANITA. QR/anonymous intake, PWA/offline, notificaciones, Psychosocial, clinical, ERP, full
LMS, e-sign y Workforce external AI continúan diferidos; no se atribuye aprobación a Anita.

## Cierre productivo PR44 — 2026-09-08

PR44 integró el HEAD auditado `894b12791f65f7ad42f57dc2ccb3183dc8889f62` mediante merge commit
`38a704dd757364bfed498b8c130eb6ded745e80c` a las `2026-09-09T00:35:39Z`. El Quality Gate de main
[34295675414](https://github.com/georgenton/sst-intelligence-platform/actions/runs/34295675414)
pasó en intento 1, sin rerun: 24 archivos/324 pruebas de contracts, 13 suites/48 pruebas API, 108
pruebas web, 31 suites/73 pruebas de integración y 19/19 E2E en 15 lotes, workers=1, retries=0 y
retried=0. También pasaron lint, typecheck, validadores SST/adaptativo/regulatorios, build,
reference sync e imagen runtime.

Railway desplegó automáticamente `45afbe4d-3090-4b5a-99ef-9af924ca83d6` desde `main` y el merge
SHA exacto. El release aplicó la migración 33
`20260908120000_adaptive_field_intelligence_v2`; luego confirmó 33 migraciones y cero pendientes,
inició Nest una vez y respondió health HTTP 200 sin errores runtime ni 5xx observados. Vercel Demo
desplegó `dpl_AJZKyz5tHKET8RMVExqLGZa4ovzd`, source=git, target=production, READY y con alias
canónico. Staging production conservó `dpl_V1gVcJhNx4JCLEFdg2uTvFeZ67qd` sobre
`codex/isolated-staging-environment-v1@5ed765d7387f51f53821296fbec8944b16e87a8b`.

El smoke productivo fue de solo lectura. La portada y las rutas de perfil/brechas, Field,
Inspections, Safety Observations, Plan, Incidents, Search y Management Intelligence respondieron
sin 5xx; las rutas protegidas sin sesión terminaron en login y los endpoints protegidos devolvieron 401. En 390 px no hubo overflow horizontal ni errores de consola. No se mutaron datos de clientes.
La funcionalidad autenticada y sus invariantes se validaron en el gate aislado 19/19 del SHA exacto.

Producción conserva `CONVERSATIONAL_AI_PROVIDER=DETERMINISTIC_LOCAL_V1`, `AI_ENABLED=false` y
`OPENAI_API_KEY` ausente. La paridad productiva medida es 15 fuentes, 25 versiones, 1112 unidades,
893 artículos, 5 Requirements candidatos, 5 RuleDrafts candidatos y 0 RuleVersions regulatorias
publicadas. No hubo backfill, recalculación histórica, cambio GTC45, Worker score, Protocol Engine,
vector DB, full offline sync, anonymous intake ni proveedor de notificaciones.

## Cierre productivo PR45 — 2026-09-09

PR45 integró el HEAD auditado `f610cfa1dcf221cff0ec1a75b36f4dfb3c7ac808` mediante merge commit
`37cfded6c6524abb089acab0c0b0e34bb6d9f071`. Su Quality Gate 34382574463 pasó en intento 3 sobre el
mismo SHA; los intentos 1 y 2 fallaron durante la instalación externa de Chromium y no ejecutaron
E2E, aunque todos los pasos técnicos anteriores llegaron a PASS. El Quality Gate de `main`
34396835833 pasó en intento 1, sin rerun: 24 archivos/324 pruebas contracts, 14 suites/49 pruebas
API, 108 pruebas web, 31 suites/75 pruebas de integración y 19/19 E2E en 15 lotes, workers=1,
retries=0 y retried=0. También pasaron migraciones, validadores, build, reference sync e imagen
runtime.

Railway desplegó automáticamente `4910d399-0867-4a4a-96d7-27cb2bc8f3dc` desde el merge exacto,
confirmó 33 migraciones y cero pendientes, inició Nest y respondió health HTTP 200. Vercel Demo
desplegó automáticamente `dpl_t51LR6TczXgW7poApPkAsZ3dkGEd`, source=git, target=production,
READY y con alias canónico. Staging production conservó
`dpl_V1gVcJhNx4JCLEFdg2uTvFeZ67qd` sobre
`codex/isolated-staging-environment-v1@5ed765d7387f51f53821296fbec8944b16e87a8b`.

El smoke productivo fue de solo lectura: portada y ruta Evidence Packages respondieron, las rutas
de aplicación sin sesión redirigieron a login y los endpoints protegidos devolvieron 401, no 5xx.
La cobertura 19/19 del mismo runtime prueba el recorrido autenticado, catálogo paginado, roles,
entitlements, aislamiento de organización e historia de paquetes sin requerir UUID en UI. No se
crearon datos productivos para el smoke.

Producción mantiene `CONVERSATIONAL_AI_PROVIDER=DETERMINISTIC_LOCAL_V1`, IA externa deshabilitada,
clave OpenAI ausente y cero solicitudes externas. La revisión profesional conserva 10 puntos
PENDING_ANITA; este cierre no atribuye su aprobación.
