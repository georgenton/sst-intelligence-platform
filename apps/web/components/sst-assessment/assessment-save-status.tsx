export function AssessmentSaveStatus({
  status,
  message,
}: {
  status: 'idle' | 'saving' | 'evaluating' | 'saved';
  message?: string;
}) {
  const label =
    status === 'saving'
      ? 'Guardando…'
      : status === 'evaluating'
        ? 'Actualizando contexto…'
        : status === 'saved'
          ? (message ?? 'Respuesta guardada')
          : 'Lista para responder';
  return (
    <span className="assessment-save-status" data-status={status} role="status" aria-live="polite">
      <span aria-hidden="true">{status === 'saved' ? '✓' : '●'}</span>
      {label}
    </span>
  );
}
