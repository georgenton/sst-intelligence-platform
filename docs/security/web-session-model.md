# Modelo de sesión web

## Flujo y almacenamiento

El navegador llama exclusivamente rutas relativas `/api/v1/*` en el mismo origen de la web. En
producción, Vercel recibe esas solicitudes y Next.js las reescribe hacia `API_ORIGIN`, que apunta al
servicio NestJS en Railway. La URL de Railway y las credenciales de infraestructura nunca forman
parte del bundle cliente.

El access token JWT tiene vida corta, se conserva únicamente en memoria dentro de `AuthProvider` y
se envía como `Authorization: Bearer`. No se escribe en cookies, localStorage ni sessionStorage. El
identificador de organización activo sí puede guardarse en localStorage porque no es una credencial;
la API vuelve a validarlo contra una membresía activa en cada solicitud.

El refresh token es aleatorio, rotatorio y se entrega como cookie `sst_refresh` con:

- `HttpOnly`: JavaScript no puede leerlo;
- `Secure=true` en producción;
- `SameSite=Lax`;
- `Path=/api/v1/auth`;
- sin `Domain`, por lo que queda vinculado al host visible de la web;
- expiración alineada con `REFRESH_TOKEN_DAYS`.

La base conserva Argon2id del secreto, no el token reutilizable. Cada renovación revoca de forma
atómica la sesión anterior, crea la siguiente dentro de la misma familia y una reutilización revoca
la familia completa. Logout revoca la sesión refresh presentada, elimina la cookie y borra access
token/usuario de la memoria del cliente. Los access tokens ya emitidos expiran naturalmente.

## Trust boundaries

```text
Browser ── HTTPS/same-origin ──> Vercel /api/v1/*
                                  │
                                  └── rewrite server-side ──> Railway NestJS ──> PostgreSQL
```

- El navegador confía en el origen Vercel y no necesita conocer Railway.
- Vercel y Railway deben comunicarse por HTTPS.
- Railway solo acepta orígenes explícitos en `WEB_ORIGIN` para accesos directos desde navegador.
- PostgreSQL no se expone al navegador y recibe únicamente consultas de la API.
- `x-organization-id` no es una credencial: `OrganizationGuard` exige JWT y membresía activa.

## CORS y CSRF

La ruta recomendada es same-origin mediante rewrite. CORS con credenciales permanece restringido a
`WEB_ORIGIN` para desarrollo o accesos controlados, pero no reemplaza autorización. Con la cookie
`SameSite=Lax`, path acotado y operaciones de sesión por POST, un sitio externo no puede enviar la
cookie en una solicitud cross-site normal ni leer la respuesta. Por ello no se añade un token CSRF
en este incremento.

El modelo debe revisarse antes de permitir cookies `SameSite=None`, dominios compartidos amplios,
iframes cross-site o llamadas directas del navegador a Railway. Cualquiera de esos cambios puede
requerir token CSRF o comprobación estricta de `Origin`.

## XSS, errores y logs

HttpOnly protege el refresh token frente a lectura directa, pero un XSS en el origen web todavía
podría operar como el usuario y obtener un access token mediante refresh. La mitigación depende de
React sin HTML no confiable, validación de entradas, dependencias actualizadas, CSP/headers de la
plataforma y evitar secretos en el bundle. La API usa Helmet, validación con whitelist, throttling y
errores genéricos para autenticación.

Los logs HTTP contienen método, ruta, estado, duración y request ID; no incluyen bodies, cookies ni
headers de autorización. Auditoría e interacciones IA guardan metadata segura y hashes, no prompts
completos, contraseñas ni tokens.

## Expiración y fallos

- JWT vencido: la API responde 401; el cliente puede renovar una vez mediante refresh.
- Refresh vencido, revocado o reutilizado: la renovación responde 401 y exige login.
- Membresía suspendida u organización suspendida: el contexto organizacional responde 403.
- Demo o trial vencido: el entitlement deja de autorizar aunque persista el registro histórico.
- Logout no promete invalidación instantánea de JWT ya emitidos; su ventana máxima es
  `ACCESS_TOKEN_TTL`.
