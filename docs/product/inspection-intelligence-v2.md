# Inspection Intelligence V2: continuidad de inspección acotada

## Alcance

Una inspección existente conecta ubicación, dominio configurado, recurso, base técnica,
criterios, hallazgo humano, valoración, acción, evidencia, verificación y Cola de trabajo.
Se conservan el monolito modular, los contratos y ciclos de vida existentes. No hay nuevo
estado profesional, esquema, migración, catálogo profesional ni infraestructura.

El punto de partida es main `ba94809f45d3041d6dc6157e04049d353c1505c7`.
PR50 y PR51 permanecen fuera de este incremento. Capability Engine conserva `1.2.0`.
Los planes, Guided Setup, assessment, fórmulas y corpus regulatorio no cambian.

## Entrada fresca y referencias de release

Se reprodujo `POST /api/v1/solution-finder/sessions` con HTTP 500 en una base nueva
que tenía las 34 migraciones y `production:release`, sin seed de desarrollo.
La misma entrada falló desde `/diagnostico` en el navegador. No había usuarios ni
organizaciones; solamente estaba provisionada la definición global CORE.

La causa demostrada fue `PrismaClientKnownRequestError`, código `P2025`, modelo
`GuidedFlowDefinition`: `SolutionFinderService.create()` usa `findFirstOrThrow()`
para la definición activa `solution-finder`, que existía únicamente en el seed.
También faltaban las cinco definiciones globales de módulos que necesita la
activación humana de la demo. FREE y CORE sí estaban disponibles; no fueron la causa.

`solution-entry-reference-sync.ts` incorpora la definición y los mismos metadatos
existentes de módulos al sync canónico. Forma parte de su transacción serializable
con advisory lock. Los upserts solamente crean referencias ausentes: no sobrescriben
una definición configurada ni reactivan un flujo deshabilitado. El seed reutiliza
esas constantes, sin convertirse en un requisito de producción.

El sync no crea usuarios, empresas, membresías, suscripciones, recomendaciones ni
`OrganizationModule`. La empresa normal conserva FREE/CORE; la demo continúa
requiriendo su acto humano explícito. No hay inserción manual exclusiva de staging.

## Preparación y congelación

Se elige centro y área opcional, un dominio realmente configurado y un recurso de la
taxonomía existente. La base presenta todas sus fuentes con papel principal,
suplementario o interno, jurisdicción/origen disponible y límite técnico. Una fuente
sintética se identifica como demostración. La edición y la huella quedan en detalle.

La vista previa muestra los IDs resueltos del mapping vigente y su orden configurado.
Para alcance general muestra todos los criterios de todas las fuentes. El conteo es
dinámico. Título, profundidad y método utilizan el DTO y política actuales; descripción
y programación son opcionales. La fecha local se transforma a ISO UTC al enviar.

Una base multifuente no tiene hoy un mapping por recurso que pruebe cobertura conjunta.
Los recursos aparecen indisponibles con explicación previa. La persona puede escoger
explícitamente **Inspección general sin recurso**, conservando todas las fuentes y sus
criterios. No se declara equivalencia profesional entre los dos alcances.

El backend mantiene el rechazo multifuente existente. Un recurso explícito en un
dominio sin catálogo ahora se rechaza con `INSPECTION_RESOURCE_NOT_AVAILABLE`:
no se convierte silenciosamente en una inspección general. Un recurso enviado sin dominio
también se rechaza antes de crear con `INSPECTION_RESOURCE_DOMAIN_REQUIRED`; una regresión
demostró que previamente se aceptaba y descartaba silenciosamente.

Al crear se conservan `standardSnapshot`, `inspectionBasisSnapshot`,
`resourceScopeSnapshot`, método, profundidad y los resultados congelados existentes.
La lectura ordena el recurso con los IDs de su snapshot, sin consultar el mapping
actual. La presentación prioriza el nombre y las fuentes guardadas en ese snapshot.
Cambiar la base activa no reemplaza la composición histórica.

## Ejecución focal y estado real

Se presenta un criterio a la vez con contexto continuo; escritorio tiene panel lateral
y móvil una banda desplegable. Los cuatro resultados son controles radio nativos,
con texto y símbolos: Conforme, No conforme, No aplica y No verificado.

`canMarkNotApplicable` y `notApplicableReason` son metadatos de lectura derivados de
la misma política existente del criterio. No aplica inadmisible se deshabilita y
explica antes de escribir. El API sigue validando la política autoritativamente.

`hasRecordedResult` distingue el No verificado predeterminado del registro humano.
`observedAt` ya tiene un valor por defecto en la base y por sí solo no acredita ese
acto. Se usa el evento obligatorio existente `INSPECTION_CRITERION_RECORDED`, limitado
a la empresa y resultados de esa inspección. Los otros resultados ya registrados
conservan su semántica. No se añade columna ni se inventa respuesta.

Anterior, siguiente y salto de criterio conservan borradores solamente en memoria
del recorrido. Se advierte sobre cambios no guardados antes de recargar. Esto no es
persistencia offline. Un error no descarta observación ni referencias, no avanza y
permite reintentar. Solamente guardar registra el criterio.

La deshabilitación usa el pending real. El texto de procesamiento aparece después
de aproximadamente 250 ms de un request aún pendiente. No se retrasa la respuesta,
no hay duración mínima ni temporizador que simule éxito. Guardar rápido confirma y
permite continuar; guardar No conforme propone un siguiente acto humano.

## Hallazgo y riesgo

No conforme no crea automáticamente un hallazgo. Se ofrecen **Registrar hallazgo**
y **Solo registrar resultado**. Antes de vincularlo se explica que el criterio
conservará No conforme; después, los resultados incompatibles se bloquean previamente.
Observación y referencias siguen editables durante la inspección según la regla actual.

El hallazgo recoge el criterio, fuente, observación y referencias conocidas. Título y
descripción quedan precargados y editables; la categoría y valoración son selección
humana explícita. No se infiere peligrosidad ni se añade Preliminary/Confirmed.

GTC 45 presenta ND, NE, NP, NC, NR y nivel devueltos por el servidor. Explica las mismas
relaciones `NP = ND × NE` y `NR = NP × NC`. ND bajo y sus resultados nulos permanecen
nulos; no se convierten en cero. La presencia del resultado residual depende de su
resultado guardado y no de la truthiness de un score numérico.

Se conserva la advertencia de metodología colombiana candidata, revisión profesional
pendiente y ausencia de adopción automática como obligación ecuatoriana. No se renderiza
`PLACEHOLDER_NEEDS_ANITA`, ni se añade interpretación profesional, fórmula o guía nueva.
GUIDED_5X5 mantiene su propio método, señales y selección humana; DEMO_5X5 conserva
la valoración histórica sin recalcularla.

## Acción, evidencia y tres actos independientes

La acción prioriza qué hacer, responsable, fecha y prioridad. Descripción es secundaria.
`datetime-local` se convierte a UTC respetando la zona del navegador. Cola de trabajo
enlaza al finding real con `?action=<id>`; el detalle valida que esa acción pertenece al
hallazgo, la desplaza a la vista y le da foco. Un ID desconocido no selecciona otra acción. El consumidor conversacional de Cola de
trabajo extrae solamente el segmento de inspección de esta ruta; la integración existente
comprueba que su explicación siga resolviendo el contexto autorizado.

NOTE y EXTERNAL_LINK muestran tipo, autor, fecha y referencia. No hay cámara, fotos,
upload, adjuntos, archivos ni offline.

Ejecutar una acción, verificar el riesgo residual y completar el recorrido son actos
distintos. El resumen de cierre muestra resultados registrados, pendientes, hallazgos
abiertos y acciones pendientes. No se añade veto por pendientes ni cierre automático
de hallazgos o acciones. Las señales de recurrencia conservan ventana, conteo, centro,
categoría y enlaces humanos a antecedentes; no confirman causa raíz.

## Auditoría y atomicidad

Una prueba de fault injection demostró que un fallo en el audit posterior a crear la
inspección devolvía error dejando una inspección y resultados persistidos.
La creación y su audit obligatorio ahora se confirman en la misma transacción Prisma.
La prueba verifica rollback completo cuando ese audit falla.

Los actos del mismo recorrido —registrar criterio, crear hallazgo y recurrencia,
iniciar/completar inspección, crear/actualizar/completar acción y verificar hallazgo—
utilizan también su transacción con los audits obligatorios. Los cambios asociados de
hallazgo, alertas y verificaciones participan en esa misma confirmación. No se elimina
la exigencia de audit ni se convierte su fallo en éxito.

La compensación es el rollback de la transacción de base de datos; no hay compensación
externa, cola o evento diferido. Las validaciones y restricciones existentes se conservan.
Un reintento tras fallo del audit no encuentra una creación parcial de ese comando.
La restricción existente de un hallazgo por resultado rechaza un segundo vínculo.
No se introduce garantía de idempotencia universal para comandos sin clave de idempotencia.

## Validación

La regresión primaria de Playwright usa esquema nuevo, migraciones y release canónico,
sin seed ni fixtures de empresa. Hace entrada pública, registro, empresa y activación
humana de la demo por UI, luego inspección eléctrica acotada, los cuatro resultados,
hallazgo GTC 45, acción, NOTE, EXTERNAL_LINK, cierre, handoff y verificación residual.
Prisma se usa para assertions de esa historia, no para suplir sus escrituras.

La historia secundaria configura una base sintética multifuente como fixture declarada,
comprueba indisponibilidad por recurso, alcance general íntegro, fallo/reintento sin
avance, GUIDED_5X5 y cambio de base activa sin alteración del histórico. Se mantienen
las historias previas de standards, riesgo y acciones adaptando selectores a controles
accesibles. Integración cubre rollback, política No aplica, registro real de NV,
decisión humana, bloqueo, evidencia, Queue y aislamiento entre empresas.

Se validan 320/390 px, tablet, escritorio, teclado, foco del criterio, foco del diálogo y
restauración, reduced motion y reflow a 200%. Los screenshots de datos sintéticos y
evidencia de reproducción quedan en `.artifacts/inspection-intelligence-v2/` (ignorados).
Las pruebas completas incluyen `pnpm check`, integración, sync de referencia, imagen
runtime y E2E con `workers=1`, `retries=0`. El reporte del PR identifica los resultados
y el SHA exacto; los previews Demo/Staging se validan sobre ese mismo HEAD.

## Límites y pendientes

- Catálogo profesional de recursos.
- Mappings profesionales fuente/recurso, incluida cobertura multifuente.
- Semántica profesional de profundidad de inspección.
- Política de hallazgo preliminar/confirmado.
- Política de metodología por hallazgo.
- Política de reapertura/finalización.
- Interpretación profesional GTC 45.
- Evidencia de fotos/archivos.
- Operación de campo offline.
- Redacción mediante IA en runtime.
- Importación Excel/CSV del Plan Operativo.

Los gaps profesionales G04/G09/G16 del audit anterior siguen diferidos y requieren
Anita; el fallback general y la presentación del candidato no validan esos contenidos.
Este incremento no declara cerrados esos gaps profesionales.

No cambia un status profesional ni se publica regla regulatoria nueva. El PR permanece
OPEN/DRAFT para reauditoría externa separada. No autoriza merge ni despliegue de producción.
