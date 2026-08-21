# Regulatory pilot editorial manifest

The canonical directory is `regulatory/pilots/ec-mdt-2024-196-v1/`. `manifest.json` fixes
`pilotVersion=1.0.0`, the material file list and a canonical SHA-256 over source, provisions,
requirements, drafts and shadow-pack metadata.

Strict Zod contracts reject unknown fields, duplicate identifiers or keys, unknown article and
requirement references, unsupported facts/operators, invalid states and unbounded text. Every
candidate resolves through source key, catalog version, official URL, official document hash,
Registro Oficial reference, article locator, requirement identifier and draft identifier.

A material change must increment the pilot version or use an explicitly controlled draft revision.
The same version with different canonical content produces `MANIFEST_VERSION_DRIFT`. Candidate
dependencies name the additional source required and never synthesize a rule from an unreviewed
source.

The importer command is `pnpm regulatory:import-pilot`. It requires both
`REGULATORY_EDITORIAL_MODE=true` and `REGULATORY_EDITORIAL_DATABASE=ephemeral`, refuses any
production marker and rejects every CLI argument, including `--force`.
