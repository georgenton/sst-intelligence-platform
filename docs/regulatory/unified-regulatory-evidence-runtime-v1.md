# Unified Regulatory Evidence Runtime V1

## Objetivo y límites

Este runtime convierte el catálogo ecuatoriano de referencia en una cadena verificable de fuente
oficial, versión, unidad estructural, interpretación editorial, requisito, regla candidata y
evaluación histórica. Coordina los motores existentes; no reemplaza sus decisiones ni ofrece
asesoría legal. Un resultado regulatorio se presenta como **Interpretación propuesta** hasta que
supere los gates técnicos, jurídicos y de publicación.

No se implementan puntajes de cumplimiento o brecha. La existencia de evidencia empresarial, una
coincidencia de regla o un nivel de riesgo no permite afirmar “cumple” o “no cumple”.

## Cadena de evidencia

```text
RegulatorySource (global)
→ RegulatorySourceVersion (global e inmutable)
→ RegulatoryUnit (texto oficial exacto, hash y páginas)
→ RegulatoryProvision (interpretación editorial)
→ RegulatoryRequirement (candidato semántico)
→ AdaptiveRuleDraft (regla candidata)
→ UnifiedSstEvaluationItem (snapshot tenant-private)
→ RegulatoryInterpretationReview (procedencia profesional global sin hechos tenant)
```

La versión V1 estructura ocho artefactos con extracción completa: 1.112 unidades, de las cuales 893
son artículos. El catálogo conserva 15 identidades de fuente; 13 artefactos están verificados y dos
permanecen pendientes. Las fuentes pendientes o rechazadas nunca se sincronizan como texto
verificado.

## Runtime

`UnifiedSstEvaluationService` carga el pack candidato MDT-2024-196, normaliza únicamente la frontera
geográfica Ecuador→EC, llama al evaluador adaptativo puro y fija en cada resultado el perfil, los
hechos, predicados, hash de salida, regla candidata, requisito, artículo y versión exactos. El
servicio no reimplementa fórmulas ni precedencias.

Estado declarado, evidencia de la organización y referencias de riesgo se guardan en el item
tenant-private y permanecen conceptualmente separados del texto oficial. Toda mutación valida la
organización activa. El workspace experto muestra el texto oficial y la propuesta; registrar una
revisión no publica la regla.

## Derechos

Los artefactos legales oficiales se registran con URL, hash, MIME, fecha de recuperación y
clasificación de verificación. GTC45 permanece en `MethodologySource` como resumen de procedencia
técnica; su texto completo no está en `RegulatoryUnit` ni en este corpus.
