# B3 — Salud en el trabajo y prevención psicosocial

B3 añade coordinación organizacional para Ecuador. Registra programas, períodos,
actividades preventivas, instrumentos y resultados agregados. No es historia clínica,
diagnóstico psicológico ni un motor automático de cumplimiento.

## Estado de evidencia

- **DONE**: modelos y APIs tenant-safe para programas de salud en el trabajo y
  prevención psicosocial; auditoría transaccional; roles existentes; reintentos
  idempotentes; superficies web en español; enlace humano a un ítem del Plan Operativo.
- **VERIFIED SOURCE**: el índice oficial del Ministerio del Trabajo fija el
  cuestionario, su guía, la guía del programa, la herramienta de tabulación, la plantilla
  del programa y el manual de registro con URL, fecha, tamaño y SHA-256. MDT-2024-196
  Art. 19 y Art. 20 siguen siendo contexto legal canónico, sin RuleVersion publicada. El
  cuestionario del Ministerio se vincula en la API a su versión de fuente oficial; un
  instrumento externo sigue siendo una declaración profesional.
- **PROFESSIONAL REVIEW REQUIRED**: cualquier interpretación de una guía, instrumento
  o programa; la elección de instrumento externo; y cualquier decisión profesional sobre
  acciones o suficiencia de evidencia.
- **DEFERRED**: categorías, horas, dotación o cualquier obligación SISAT ejecutable. El
  artefacto exacto del Registro Oficial/MSP no se pudo fijar en este bloque; el PDF local
  continúa siendo solo referencia.

## Superficies

- `/app/health-at-work` — coordinación preventiva, actividades genéricas y evidencia
  mediante nota o enlace HTTPS.
- `/app/psychosocial` — programa, ciclo de evaluación e indicadores agregados. El
  cuestionario del Ministerio se ofrece como instrumento opcional; no se guardan respuestas.

Las mutaciones usan la organización autenticada, los roles `ORG_OWNER`, `ORG_ADMIN` y
`SST_MANAGER`, y eventos de auditoría dentro de la misma transacción. Las acciones no se
crean automáticamente desde un resultado: el enlace al Plan Operativo requiere confirmación
humana y su ítem queda disponible para la proyección de Work Queue existente.

Los campos libres muestran una advertencia explícita para no incluir datos personales sensibles.
No se agregan campos clínicos a `Worker`, `User`, `Membership`, `Incident` ni `SafetyObservation`.
No se crean `RuleVersion`; los cinco `RuleDraft` existentes permanecen intactos.
