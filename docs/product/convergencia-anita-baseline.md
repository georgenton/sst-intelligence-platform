# Convergencia Anita — baseline B0

Este documento es el punto de entrada para revisar el baseline real antes del piloto. El paquete completo está en [docs/product/anita-baseline-b0](./anita-baseline-b0/).

## Corte y evidencia

El baseline es `d20d2ff7f10871271587571b1825f409b7b534e0`, squash merge de PR54. La Quality Gate de `main` es el run `35785935020` (push, intento 1, éxito, SHA exacto); ejecutó lint, typecheck, tests de contratos/API/web, integración, build, sincronización de referencias, imagen runtime y E2E. B0 es documental y no añade cambios de comportamiento. El árbol tiene 35 migraciones; B0 no crea la 36 ni modifica Prisma.

Los deployments asociados al SHA exacto fueron registrados como exitosos: Vercel staging `6600993751`, Vercel demo `6600988079`, Vercel producción `6600983545` y Railway `6600962870`. Las URLs Vercel responden con SSO, así que esa evidencia demuestra el estado del deployment, no un health público anónimo. La evidencia de API/DB de producción, reference sync en ese runtime y journey con usuario normal sigue pendiente y está enumerada en [pending-items.md](./anita-baseline-b0/pending-items.md).

## Decisión del piloto

El piloto inmediato usa **Inicio**, **Evaluación SST**, **Plan operativo**, **Inspecciones** y **EPP**. Centros, cargos, personas, riesgo técnico, acciones, evidencias, cola de trabajo, equipo y acceso se mantienen accesibles como soporte operativo. SISAT y Psicosocial se dejan como siguiente alcance hasta que existan ruta, contrato, evidencia de datos y revisión profesional suficientes.

El motor de capacidad es `1.2.0`. La sincronización de referencias de producción existe en el código y el gate cubre el caso de base fresca sin `seed`; no se presenta esa prueba de CI como evidencia de que el runtime productivo ya fue inspeccionado.

## Corpus y decisión de publicación

El inventario tiene 15 fuentes en estado global `REVIEW_ONLY`, 1.112 unidades oficiales extraídas y 893 unidades de artículo. El piloto MDT-2024-196 contiene 2 disposiciones, 5 requisitos y 5 borradores de regla, todos pendientes de revisión técnica. La comunicación de Jorge del 2026-09-24 registra que Anita aprobó las leyes para el trabajo; se conserva como ratificación comunicada y se exige decisión por unidad antes de publicar. El runtime mantiene **0 reglas regulatorias reales publicadas**.

SISAT se resumió a partir del PDF local suministrado: se revisaron visualmente las tablas de componentes y categorías de dotación; el repositorio todavía tiene la fuente como `OFFICIAL_REFERENCE_ONLY` sin hash del artefacto exacto. Los límites de confidencialidad y la separación entre coordinación preventiva, salud ocupacional y datos clínicos están documentados en el alcance SISAT/Psicosocial.

## Archivos operables

- [README e índice](./anita-baseline-b0/README.md)
- [Matriz de readiness](./anita-baseline-b0/module-readiness.csv)
- [Manifiesto regulatorio](./anita-baseline-b0/regulatory-publication-manifest.json)
- [Requisitos y A19](./anita-baseline-b0/anita-2026-09-19-requirements.md)
- [SISAT y Psicosocial](./anita-baseline-b0/sisat-psychosocial-scope.md)
- [Mapa UI/API/modelos](./anita-baseline-b0/component-contract-map.md)
- [Pendientes con dueño](./anita-baseline-b0/pending-items.md)
