# Field Operations, Search y Management Intelligence V1

## DONE

Field Hub ofrece navegación móvil a observación rápida, nueva/actual inspección, acciones, incidentes y búsqueda. Safety Observation conserva su aggregate y añade captura opcional de nota o enlace HTTPS mediante su mecanismo Evidence existente. Si el alta de Evidence falla después de crear la observación, la UI conserva el id ya creado y permite reintentar solo Evidence; nunca reenvía el alta de Observation. No crea Incident ni Finding automáticamente.

El manifest permite instalación standalone y arranca en `/app/field`. Los recorridos centrales usan grids fluidos, controles semánticos, focus visible y objetivos táctiles. Se validan 360 px, 390 px, tablet y desktop sin ocultar los CTA críticos.

Search V1 cubre Findings, Inspections, Safety Observations, Incidents, Actions, Plan Items, Worker por identidad operacional, Positions, Training, PPE y Work Centers. Todos los `UNION` aplican `organizationId` antes de combinar resultados. Cada rama protegida se añade al SQL únicamente si el entitlement canónico del dominio está activo; no se consulta y filtra después. Incidents muestran snippet restringido y Worker no muestra datos sensibles fuera de su identidad operativa. Filtros por tipo/centro, page/pageSize y orden rank/fecha/tipo/id son deterministas. El CTA distingue rutas de detalle (`Abrir registro`) de raíces (`Abrir módulo`).

Management Intelligence muestra primero acciones vencidas y revisiones pendientes; luego conteos por centro/estado, tendencias mensuales, capacitación, reemplazos EPP y series de riesgo separadas por método. Usa filtros distintos para categoría de hallazgo, categoría de observación y tipo de incidente. El corte de hallazgos por centro/categoría/fecha se aplica también a sus series iniciales y residuales. La respuesta declara qué módulos no están disponibles por entitlement y el alcance compatible de cada filtro; el rango temporal no se presenta como global para Plan, capacitación, EPP o revisión profesional. No usa Worker como dimensión de ranking.

Expert Review V2 expone fuente y artículo exactos, propuesta, decisión profesional requerida e historial. Las acciones permanecen finitas y registrar review no publica RuleVersion.

## SYNTHETIC

El recorrido automatizado usa solamente organización, observación, evidencia, inspección y métodos sintéticos. Las guías BASIC/TECHNICAL/SYSTEMIC son orientación de producto, no criterios normativos.

## DEFERRED

- cámara/upload binario hasta revisar almacenamiento, antivirus, retención y Evidence policy;
- sincronización offline profunda, conflictos y background queue;
- QR o reporte anónimo;
- SMS, WhatsApp, push y Notification provider;
- comparación normalizada entre metodologías sin equivalencia profesional aprobada.
