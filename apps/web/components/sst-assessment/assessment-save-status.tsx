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
        ? 'Analizando…'
        : status === 'saved'
          ? (message ?? 'Información actualizada')
          : 'Lista para responder';
  return (
    <span className="assessment-save-status" data-status={status} role="status" aria-live="polite">
      {label}
    </span>
  );
}
