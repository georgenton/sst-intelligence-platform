# ADR 0006: Autenticación propia

## Contexto

El incremento necesita email/contraseña y contrato futuro móvil sin proveedor de identidad.

## Decisión

Argon2id, JWT corto en memoria, refresh aleatorio rotatorio en cookie HttpOnly, hash persistido,
revocación por familia y detección de reutilización.

## Alternativas

Sesiones opacas, token persistido en localStorage o identidad externa.

## Consecuencias

La API controla revocación y web renueva al cargar; la rotación reclama atómicamente cada token y
una reutilización revoca su familia. Móvil podrá usar almacenamiento seguro.

## Riesgos

Cross-site futuro requerirá estrategia CSRF explícita; secretos y cookies exigen configuración firme.
La configuración de producción falla al iniciar si conserva el secreto JWT de desarrollo.

## Criterio de revisión futura

Revisar al incorporar SSO, MFA, recuperación real o aplicación móvil.
