# Inventario de superficies normativas

DEMO permanece en snapshots sellados, fixtures y rutas históricas. Las organizaciones PILOT no reciben ni exponen estándares DEMO_SYNTHETIC desde la API, incluso durante una ventana demo activa; la política sintética queda limitada a la demostración explícita de una organización FULL. La UI llama a los resultados DEMO lógica determinística de producto, nunca autoridad jurídica.

- Demo Electrical Standard A/B y Demo Fire Standard A: histórico verdadero; no default nuevo.
- RETIE y REBT: referencia extranjera; nunca ley ecuatoriana.
- RTQ: referencia local limitada a Quito configurado.
- HIGH_ENERGY_RULE y HIGH_ENERGY_PROFESSIONAL_REVIEW: claves internas; la UI muestra decisión de producto y revisión.
- Cada `ruleKey` emitido por Evaluación SST lleva ahora un `regulatoryFoundation`: el único
  mapeo `OFFICIAL_ARTIFACT_VERIFIED` de R1 es `HIGH_ENERGY_RULE` cuando el centro confirma
  `ELECTRICAL`; los demás contextos, incluidos los cinco RuleDrafts, muestran
  `NO_EXACT_SOURCE_MAPPING` o `SOURCE_CONTEXT_REQUIRED`.
- sourceLocator, ruleKey y hashes se mantienen en detalle técnico autenticado.

No se borran nombres DEMO de registros sellados ni pruebas históricas.
