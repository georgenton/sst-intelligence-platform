# Vercel

Importa el repositorio y conserva la raíz del proyecto en la raíz del monorepo; `vercel.json` ejecuta
el build filtrado de `@sst/web`. Configura `API_ORIGIN` con el dominio HTTPS de Railway,
`NEXT_PUBLIC_APP_NAME` con la marca visible y `APP_NAME` como fallback de render del servidor. No
expongas secretos de API, base de datos, JWT u OpenAI al frontend. La rewrite de `next.config.ts`
mantiene el consumo del navegador en `/api/v1`.
