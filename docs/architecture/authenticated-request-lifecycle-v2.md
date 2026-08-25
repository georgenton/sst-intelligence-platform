# Authenticated request lifecycle V2

`createAuthenticatedRequestCoordinator` is the single browser coordinator for private product
requests. It reads the current in-memory session, attaches the active organization context through
the existing API client and forwards the caller's `AbortSignal`.

Before a request, the coordinator decodes only the JWT `exp` field for scheduling. A token inside a
45-second skew joins the document-wide rotating-refresh promise. Authorization never uses decoded
claims. A protected 401 triggers one shared refresh and exactly one replay for repeatable JSON or
bodyless requests. A second 401 invalidates the session. Other HTTP statuses never refresh.

Login, register, refresh and logout are excluded. Streaming and non-repeatable bodies are rejected
for replay. An abort while refresh is pending prevents the feature request and does not invalidate
the session. Every refresh captures the session generation; logout or a newer login makes its late
completion stale, so it cannot restore or replace a session.

Genuine refresh failure cancels private work, clears organization-private cache and active context,
preserves public/global cache, and redirects through a safe local return path with the human message
“Tu sesión terminó. Inicia sesión nuevamente para continuar.”
