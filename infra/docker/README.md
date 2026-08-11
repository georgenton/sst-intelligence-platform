# Docker local

El `docker-compose.yml` raíz inicia únicamente PostgreSQL 16 en el puerto host 5448. Web y API se
ejecutan nativamente para hot reload. El Dockerfile de API está en `apps/api/Dockerfile` y usa contexto
de build en la raíz: `docker build -f apps/api/Dockerfile .`.
