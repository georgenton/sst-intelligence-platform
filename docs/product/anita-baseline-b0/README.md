# B0 — Baseline real y paquete para el piloto Anita

**Corte:** 2026-09-24
**Repositorio:** `georgenton/sst-intelligence-platform`
**Main canónico:** `d20d2ff7f10871271587571b1825f409b7b534e0` (squash merge de PR54)
**Quality Gate de main:** run `35785935020`, `push`, intento `1`, `SUCCESS`.

**Programa canónico:** [Programa maestro piloto Anita](https://app.notion.com/p/3e5cbb1031a08119b454ea0ebc215f49)
**Reunión fuente:** [Meeting @Last Saturday](https://app.notion.com/p/3e0cbb1031a080e68017fd5e9e237ff3)

Este paquete convierte el estado real del producto en una hoja operable para el piloto. Es documentación de evidencia: no cambia rutas, contratos, datos, reglas regulatorias, entitlements ni despliegues. El branch de trabajo es `codex/anita-b0-baseline`.

## Decisión de una página

- **Piloto inmediato:** Inicio, Evaluación SST, Plan operativo, Inspecciones y EPP.
- **Capacidades de apoyo que deben permanecer accesibles:** centros, cargos, personas, riesgo técnico, acciones, evidencias, cola de trabajo, equipo y acceso.
- **SISAT y Psicosocial:** siguiente alcance. El diseño y el corpus no prueban una operación clínica o normativa publicada.
- **Motor:** `SST_CAPABILITY_ENGINE_VERSION=1.2.0`, comprobado en contratos y E2E.
- **Reglas reales publicadas:** `0`. La ratificación de corpus se registra como comunicación de Jorge del 2026-09-24, no como firma o aprobación electrónica de Anita.
- **Producción:** los cuatro deployments asociados a main SHA terminaron `success`; el dominio Vercel requiere SSO y por eso no se etiqueta como health público. Falta evidencia de API/DB de producción, sincronización canónica en ese runtime y journey de usuario normal. El paquete no declara “piloto listo” por un deployment verde.

## Índice y orden de lectura

1. [INDEX.md](./INDEX.md) — índice por decisión y evidencia.
2. [module-readiness.csv](./module-readiness.csv) — matriz de rutas, contratos, modelos, permisos, entitlements y madurez.
3. [regulatory-publication-manifest.json](./regulatory-publication-manifest.json) — inventario real de 15 fuentes, estados, huellas y denominadores.
4. [anita-2026-09-19-requirements.md](./anita-2026-09-19-requirements.md) — requisitos de Anita, observaciones A19 y criterios de aceptación.
5. [sisat-psychosocial-scope.md](./sisat-psychosocial-scope.md) — SISAT, límites no clínicos y alcance psicosocial.
6. [component-contract-map.md](./component-contract-map.md) — puente UI → API → modelo → guardas.
7. [pending-items.md](./pending-items.md) — pendientes con dueño y efecto.
8. `surface-captures/*.svg` — capturas sintéticas para revisar la superficie, no screenshots de producción.
9. [convergencia-anita-baseline.md](../convergencia-anita-baseline.md) — resumen canónico enlazable.

## Evidencia usada

- PR54 merged: `d20d2ff7f10871271587571b1825f409b7b534e0`.
- Main Quality Gate: `35785935020`; sus pasos incluyen lint, typecheck, contratos/tests, integración, build, reference sync, runtime image y E2E.
- Corpus: `regulatory/corpus/ecuador-sst-review-v1/corpus.json`, 15 source files, estado `REVIEW_ONLY`, hash `sha256:83e976f3762469b68ac5594d7df1aba746ca1d7e3427b4da3941ed98c9989c41`.
- Unidades extraídas: `regulatory/evidence/ecuador-official-units-v1/index.json`, 1.112 unidades y 893 unidades de artículo.
- Piloto MDT-2024-196: 2 disposiciones, 5 requisitos y 5 borradores de regla; todos `TECHNICAL_REVIEW_PENDING`.
- Referencias globales: 8 fuentes/9 versiones/9 secciones/16 criterios de inspección; 1 taxonomía/21 recursos/231 mappings; metodología 1/3/3/1/1/2; bases de inspección son organización-específicas y no tienen filas globales.
- SISAT: PDF local suministrado, inspección visual de las tablas 1 y 2 completada. El repositorio conserva solo una referencia oficial, sin huella del artefacto exacto.

## Guardas de uso

La documentación no convierte una fuente en regla publicada, no inventa distribución de trabajadores, no copia texto protegido y no sustituye revisión profesional. Cualquier publicación posterior debe decidir por unidad, conservar jurisdicción y derechos, y separar texto oficial, interpretación profesional, criterio de inspección y cálculo de riesgo.
