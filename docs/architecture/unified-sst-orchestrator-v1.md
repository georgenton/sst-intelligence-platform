# Unified SST Orchestrator V1

La UI ofrece una sola entrada “Evaluación SST”, pero el backend conserva motores especializados.

```text
Organization Profile ─┐
Adaptive/Regulatory ──┼─→ UnifiedSstEvaluationService → snapshot histórico
Current State ────────┤
Organization Evidence ┤
Technical Risk ───────┘
```

El orquestador llama al evaluador adaptativo y materializa trazas; no replica precedencia,
planificación de preguntas, Guided 5×5, GTC45, recurrencia ni ciclo de Technical Assessment. Cada
item contiene hechos y predicados usados, artículo exacto, estado declarado, evidencia empresarial y
referencias de riesgo como ámbitos separados.

`RegulatorySource`, versiones, unidades, provisiones, requisitos y drafts son globales. Evaluaciones,
estado, evidencia y referencias operacionales incluyen y validan `organizationId`. La caché web usa
query keys por organización y la API vuelve a validar membresía; ocultar una acción no es seguridad.
