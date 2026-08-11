# ADR 0004: Frontera de proveedor AI

## Contexto

El producto debe funcionar sin proveedor y la IA no puede decidir necesidades SST.

## Decisión

El motor puro calcula; `ExplainSolutionRecommendation` usa plantilla por defecto u OpenAI opcional,
valida Zod, verifica módulos invariantes y registra metadata sin prompt completo.

## Alternativas

Usar LLM para recomendar, depender siempre de OpenAI o no ofrecer explicación generativa.

## Consecuencias

Fallos del proveedor degradan a plantilla sin romper el flujo.

## Riesgos

Texto incorrecto pese a schema válido; se limita el prompt y se conserva disclaimer.

## Criterio de revisión futura

Revisar modelos y prompts solo mediante evaluaciones representativas y métricas de interacción.
