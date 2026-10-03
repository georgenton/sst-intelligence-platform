# Actualización de revisión visual de Anita

Estado de entrega: **READY_TO_SEND_TO_ANITA**.

## Hechos finales

- PR: #60, rama `codex/anita-visual-review-environment-v1`.
- HEAD de revisión: consultar el HEAD actual de la PR y el último Quality Gate exitoso antes de copiar el dato en Notion.
- Frontend de revisión exacto: `https://sst-intelligence-staging-go10gcb5n-georgentons-projects.vercel.app`.
- Protección externa: `VERCEL_SHARE_REQUIRED`; Jorge entrega un enlace temporal privado para el despliegue exacto. El parámetro temporal no se guarda aquí.
- Backend de staging: `https://sst-api-staging-staging.up.railway.app/api/v1`.
- Organización: **SST Intelligence — Revisión Anita**; datos sintéticos; 453 total, 267 Quito, 85 Guayaquil y 101 sin centro.
- Smoke autenticado: `demo:anita:verify` → `FINAL=PASS`; las rutas principales se abrieron visualmente en el staging exacto y no presentaron 5xx, stack trace ni datos reales.
- Capturas: 30 en `design-handoff/anita-visual-review-v1/` (26 desktop, 4 mobile de 390 px), 30/30 HTTP 200 y assertions de contenido.
- Manifest: `design-handoff/anita-visual-review-v1/manifest.json`; cada captura incluye ruta, viewport, concepto, estado de revisión, PA cuando corresponde y organización sintética.

## Material para Anita

- Manual: `docs/product/anita-visual-review-v1/MANUAL-ANITA.md`.
- Guía rápida: `docs/product/anita-visual-review-v1/GUIA-RAPIDA-ANITA.md`.
- Acceso: `docs/product/anita-visual-review-v1/access-guide.md`.
- Hoja PA: `docs/product/anita-visual-review-v1/validation-checklist.md`.
- Mensaje listo para copiar: `docs/product/anita-visual-review-v1/MENSAJE-PARA-ANITA.md`.

## Estado profesional y normativo

- PA-01 y PA-02: evidencia visible; requieren confirmación de lenguaje y denominador.
- PA-03 y PA-04: método, profundidad y mappings requieren criterio profesional.
- PA-05 a PA-08: EPP, capacitación, incidentes y observaciones requieren criterio profesional.
- PA-09: Salud y Psicosocial siguen alcance preventivo/agregado y requieren validación humana.
- PA-10: resolver cinco decisiones por separado; `RuleDrafts=5`, `RuleVersions=0`.
- PA-11: `SISAT=BLOCKED_EXTERNAL_SOURCE`; la referencia oficial fue identificada, pero el artefacto exacto aún no está fijado y estructurado.

## Acceso y seguridad

- `ANITA_REAL_INVITATION=NO`: la invitación se genera cerca de la sesión con el correo exacto.
- Rol recomendado: `VIEWER` para lectura; `SST_MANAGER` para taller interactivo. No usar owner/admin por defecto.
- Vigencia de invitación: 7 días, un solo uso.
- Cuenta propia obligatoria; contraseña compartida: NO.
- No se guardan correo real, token de invitación, share secret, cookies, datos clínicos ni datos de clientes.

## Nota de entorno

La ficha de Organización puede mostrar el límite comercial de un centro mientras la
fixture mantiene dos centros activos para la revisión. Se documenta como nota de
interpretación del entorno sintético; no se cambió el producto en este bloque.

## Límites

No hubo cambios de aplicación en esta entrega, nuevas migraciones, despliegue
productivo ni escrituras sobre organizaciones reales. El paquete no publica reglas,
no cierra la aceptación de Anita y no constituye una campaña de cumplimiento.
