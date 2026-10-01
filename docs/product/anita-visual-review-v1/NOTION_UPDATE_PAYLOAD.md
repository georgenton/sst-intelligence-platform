# Actualización de revisión visual de Anita

Estado técnico: **READY FOR VISUAL REVIEW**.

La revisión se ejecuta contra el preview Vercel del SHA final de PR60 y el
backend Railway de staging del mismo SHA. La cuenta y la organización son
sintéticas; no se escribieron organizaciones reales ni producción.

- Preview exacto: `sst-intelligence-staging-r9wi9e4k1-georgentons-projects.vercel.app`
- Frontend SHA: `5a69f6c0ef982a0cca2f0affd040ca112716a9ba`
- Backend staging: `sst-api-staging-staging.up.railway.app/api/v1`
- Backend deployment: `bf799c22-fd25-487c-afe5-b053e92310a1` (`SUCCESS`)
- Release: 37 migraciones encontradas, 0 pendientes, `reference:sync` ejecutado
- Verificador: `demo:anita:verify` → `FINAL=PASS`, solo lectura
- Capturas: 26 desktop + 4 mobile, 30/30 HTTP 200 y assertions de contenido

Correcciones focales:

1. El contador del centro de comando cuenta únicamente centros activos; los
   históricos siguen almacenados y recuperables.
2. El lock advisory de creación de salud ocupacional conserva la idempotencia
   sin construir SQL inválido. La prueba de reintento devuelve el mismo ID.
3. El módulo psicosocial B3A se puede seleccionar mediante el endpoint demo
   canónico existente; `EntitlementGuard` sigue siendo la autoridad.

La entrada pública `solution-finder` y `complete` respondieron 201 después de
alinear staging. La causa se clasifica como `STALE_STAGING_RUNTIME`; no hubo
cambio en la lógica de solution-finder.

Aceptaciones humanas pendientes: PA-09 (instrumento, alcance e interpretación
aggregate-only), junto con las decisiones profesionales indicadas en la
checklist. `RuleDrafts=5`, `RuleVersions=0` y SISAT permanecen sin publicación.

