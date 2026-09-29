# Preparación de release R1

R1 queda acotado a una base normativa ecuatoriana trazable y a la separación
estricta entre PILOT y DEMO. El schema existente soporta source, version, unit,
requirement, review y links; no se crea migration nueva. Los históricos conservan
sus snapshots DEMO.

Las organizaciones `navigationProfile = PILOT` no reciben ni pueden usar
`DEMO_SYNTHETIC` en catálogo, acceso directo a source, política, guardado,
resolución de inspecciones o provisioning. Un `demoExpiresAt` futuro no cambia
esa regla. El provisioning sintético queda reservado al flujo DEMO explícito de
una organización FULL; el onboarding normal no lo activa implícitamente.

La evidencia del Anexo 3 mantiene `textExtractionStatus = PARTIAL`. El índice
de dominios amplía los localizadores oficiales, pero solo `ELECTRICAL` tiene
unidades estructuradas y mapping ejecutable verificado para Arts. 82–90. Los
demás dominios permanecen `NO_EXACT_SOURCE_MAPPING` y no generan obligaciones
ejecutables. Los cinco RuleDrafts siguen siendo candidatos individuales; no
existen RuleVersions regulatorias publicadas sin provenance verdadera.

El release/reference sync canónico se verificó en una base fresca y repetida,
con protección contra drift y sin depender de seed comercial para el corpus.
La imagen runtime, validadores, suites focales, `pnpm check`, E2E completo y el
Quality Gate remoto fueron verificados. Los tres previews Vercel del HEAD exacto
quedaron `READY` (Demo, Platform y Staging). La inspección HTML autenticada de
staging no se completó porque el deployment está protegido por Vercel SSO; ese
estado no se presenta como PASS.

Producción no ha sido desplegada ni escrita. R1 no implementa B3, SISAT ni
Psicosocial.
