# EPP V3 — continuidad de cargo a protección

Base: PR52 cerrado, `main@57a35020f1632c0a8d2cdf5449d79571136b7e9f`.
Diseño: EPP Cloud Design v1, 34 superficies, 65 archivos. Implementación en curso.

## Recorrido y autoridad

Cargo → riesgos registrados → categorías de protección a considerar → selección
profesional explícita → requisito de cargo → trabajador → requisito individual →
entrega → confirmación → en servicio → condición → reemplazo → evidencia e historia
→ Cola de trabajo canónica.

`suggestPpeCategories()` y `PPE_CATEGORY_BY_POSITION_RISK` conservan sus reglas.
Los candidatos son categorías deterministas, no artículos seleccionados ni
requisitos. ERGONOMIC y OTHER no reciben categorías inventadas. Crear riesgos,
seleccionar elementos, aplicar requisitos y entregar requieren acciones humanas.
La recomendación diagnóstica no activa módulos ni crea requisitos o entregas.

Worker no es User ni Membership. La persona receptora puede tener historial de
EPP sin cuenta SaaS; las operaciones registran al usuario autorizado como actor.
El alcance de cargo, centro y área se valida en el servicio, junto con tenant,
roles, entitlements y estado activo. Las proyecciones de procedencia usan vínculos
y actores existentes; no infieren causalidad por coincidencia de artículo.

## Auditoría y fallos

Las siete mutaciones de catálogo, selección de cargo, requisito individual,
entrega, confirmación, condición y reemplazo confirman dominio y AuditLog en la
misma transacción mediante `AuditService.record(event, tx)`. Un fallo obligatorio
revierte ambos. Se conservan locks, versiones y restricciones de unicidad.
Confirmación y condición construyen su respuesta dentro de la transacción; no
dependen de una lectura posterior al commit que pueda devolver un error tardío.

Entrega incluye el paso REQUIRED → FULFILLED del requisito. Condición incluye
inspección, versión y transición aplicable. Reemplazo incluye anterior, sucesor,
versiones y vínculo con el incidente cuando se aporta. No hay outbox, bus,
compensación parcial ni nueva migración. Las regresiones HTTP inyectan fallo en
cada auditoría, comparan el estado completo antes/después y verifican un único
éxito y evento tras reintentar.

El cliente conserva los campos al fallar, deshabilita el envío pendiente y ofrece
reintento explícito. Un conflicto de versión requiere actualizar y revisar el
borrador. Una pérdida de respuesta exige recuperar el estado antes de repetir:
atomicidad no equivale a idempotencia universal de transporte.

## Ciclo vigente

Entrega crea ISSUED/PENDING. La confirmación explícita, con nota obligatoria,
produce IN_SERVICE/RECORDED; no es firma digital. La revisión de condición del
EPP conserva SERVICEABLE, REVIEW_REQUIRED y UNSERVICEABLE y es independiente de
Inspection Intelligence. UNSERVICEABLE puede establecer REPLACEMENT_DUE conforme
a las transiciones actuales; nunca crea automáticamente un reemplazo.

La fecha prevista vencida deriva atención de lectura y no modifica el estado
persistido ni autoriza por sí sola reemplazar. Solo REPLACEMENT_DUE o LOST_DAMAGED
admiten la operación existente. EXPIRY, WEAR, DAMAGE, LOSS y OTHER_JUSTIFIED
conservan su significado; la última exige justificación. El anterior pasa a
REPLACED y el sucesor inicia ISSUED/PENDING, sin borrar la historia.

En DAMAGE se puede vincular un incidente existente del mismo tenant que ya
incluya al trabajador. El vínculo pertenece a la entrega anterior. No se crea
un incidente ni involucramiento automáticamente. Entrega y reemplazo admiten
nota **o** URL HTTPS, de forma excluyente; condición conserva sus campos propios.

## Cola y escala

PPE_REPLACEMENT_DUE conserva la elegibilidad por estado/fecha y exclusión de
terminales. PPE_CONDITION_REVIEW depende de la última condición por inspectedAt,
createdAt e id descendentes; workspace y cola comparten ese desempate. Una
condición SERVICEABLE posterior retira la revisión pendiente.

La cola calcula el conjunto elegible antes del orden, filtro de estado y corte
final. Se retiran los prefijos dependientes de page/pageSize y el tope 500 de sus
fuentes existentes: corregir solo EPP dejaría incorrecto el total mixto. Esto no
cambia reglas ni prioridades de otros dominios. La proyección completa tiene
costo proporcional al conjunto candidato; no se ofrece un total truncado para
ocultar ese costo. Se verifican más de 500 candidatos, datos mixtos, páginas de
1/20/50/100, filtros, terminales, aislamiento y entitlements.

Los selectores de catálogo, trabajador e incidente deben consultar búsqueda y
paginación del servidor con páginas moderadas, conservar la selección fuera de
la página visible y reiniciar su estado al cambiar organización. No se eleva el
límite ni se carga toda una colección como solución de UI. La atención enlaza a
la única Cola de trabajo y al trabajador/entrega exactos.

La landing usa únicamente cargos activos con riesgos y los totales canónicos de
reemplazos y condiciones. No hay porcentaje de cumplimiento, safety score, cero
supuesto durante carga/error, ni agregado deducido desde una página visible.

## Referencias y límites profesionales

referenceStandard, referenceJurisdiction, referenceProvenance y
referenceReviewStatus son metadatos declarados. REVIEWED conserva validación y
permisos actuales y no equivale a certificación. No se inventan revisores,
estándares, intervalos ni fechas ausentes.

NEEDS_ANITA: cambios de mapeo riesgo/categoría; significado o permisos de REVIEWED;
política de reemplazo; daño fuera del caso vigente; catálogo y selecciones
profesionales reales; certificaciones, intervalos y lenguaje regulatorio.
La pregunta sobre administración de inventario permanece documental y futura.
No se implementan stock, proveedores, compras, costos, códigos, fotos, archivos,
firma, modo offline ni IA externa sobre personas/EPP.

Se preservan Capability Engine 1.2.0, Guided Setup, Plan Operativo, Inspection
Intelligence V2, métodos de riesgo y corpus regulatorio. Se mantienen 34
migraciones; no se publica contenido profesional ni se despliega producción.

## Evidencia

Los artefactos ignorados se guardan en `.artifacts/epp-v3/`. Incluyen preflight,
reproducción sobre la base exacta, regresiones de persistencia y cola, y se
completarán con validación funcional, accesibilidad, capturas y previews del HEAD
final. Las cifras de prueba son sintéticas y no son decisiones profesionales.
