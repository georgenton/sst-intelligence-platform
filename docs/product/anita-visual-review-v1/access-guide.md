# Guía de acceso para la revisión de Anita

## Destino seguro

Usar únicamente el preview de staging indicado por Jorge y el backend Railway de staging aislado. El preview puede pedir una autorización temporal de Vercel; la URL temporal se entrega fuera del repositorio y caduca. No usar el dominio productivo ni copiar el parámetro temporal a un documento o captura.

La cuenta del recorrido es el owner sintético del entorno. No se incluye contraseña en el repositorio, en este archivo, en la PR ni en el paquete visual.

## Preparación reproducible

El fixture se prepara con el servicio demo existente y con llamadas canónicas al API. El script solo acepta la confirmación explícita `ANITA_REVIEW_FIXTURE=STAGING_ONLY` y se niega ante señales de producción.

```bash
export ANITA_REVIEW_FIXTURE=STAGING_ONLY
export ANITA_REVIEW_API_ORIGIN='https://<api-staging-autorizado>/api/v1'
export ANITA_REVIEW_EMAIL='pilot.owner@synthetic.invalid' # o el owner sintético entregado por secrets
export ANITA_REVIEW_PASSWORD='<solo en el entorno de ejecución>'
pnpm demo:anita:provision
```

La ejecución es convergente: busca la organización por nombre exacto, reutiliza el owner, reutiliza centros y solo crea los centros que falten. No borra centros, workers, planes ni históricos y no escribe filas directamente en la cola. Las capacidades y los datos de inspección se preparan mediante las primitivas demo canónicas ya existentes.

Para capturas, proporcionar temporalmente el enlace de acceso de Vercel mediante `ANITA_REVIEW_VERCEL_SHARE` y ejecutar:

```bash
export ANITA_REVIEW_BASE_URL='https://<preview-staging-autorizado>'
pnpm demo:anita:capture
```

El comando genera el manifiesto y las imágenes en `design-handoff/anita-visual-review-v1/`. No genera `storageState` ni conserva cookies.

## Acceso de Anita mediante invitación

No se envió una invitación real en esta tarea porque falta confirmar el correo final de Anita. El proceso que debe usarse después es:

1. Jorge entra en **Equipo** con el owner sintético.
2. Selecciona **Invitar**, escribe el correo de Anita y elige `VIEWER` para observación o `SST_MANAGER` para validación activa.
3. Crea la invitación y copia el enlace manual.
4. Comparte el enlace por un canal seguro; no lo pega en la PR, screenshots, logs ni este repositorio.
5. Anita crea o usa una cuenta con ese mismo correo, abre el enlace y acepta.

El enlace no usa un proveedor de email automático. Expira en siete días, es de un solo uso y el correo autenticado debe coincidir exactamente. Después de procesarlo, el token no debe permanecer en la URL.

## Primer recorrido recomendado

1. **Inicio**: comprobar que el banner identifica la demostración conceptual y que la organización activa es la sintética.
2. **Evaluación SST**: revisar 453, 267, 85 y 101 sin convertir la diferencia en una distribución inventada.
3. **Plan operativo**: abrir los seis ítems y seguir el origen de cada uno.
4. **Cola de trabajo**: abrir capacitación, acciones de inspección, observación e EPP y comprobar cada deep link.
5. **Inspecciones**: separar base técnica, criterio, resultado, finding, riesgo, acción, evidencia y verificación.
6. **EPP**: revisar selección humana, entrega, acuse, condición `UNSERVICEABLE`, reemplazo histórico y nueva entrega pendiente.
7. **Capacitación**: leer la necesidad por cargo, la sesión, asistencia y completitud sin llamarla certificación.
8. **Incidentes y observaciones**: distinguir el casi incidente investigado de la buena práctica independiente.
9. **Módulos y biblioteca**: confirmar qué está en demo, qué requiere entitlement y que no hay `RuleVersions` publicadas.

## Roles

- `VIEWER`: recorrido amplio y lectura sin mutaciones.
- `SST_MANAGER`: validación profesional interactiva y acciones acotadas en staging.
- No usar `ORG_ADMIN` u `ORG_OWNER` para Anita salvo decisión posterior explícita.

## Qué no debe hacerse

No cargar datos de clientes o trabajadores reales, no completar respuestas clínicas, no crear invitaciones reales sin el correo confirmado, no usar producción, no presentar estándares extranjeros como ley ecuatoriana y no marcar una superficie como aprobada solo porque la captura carga.
