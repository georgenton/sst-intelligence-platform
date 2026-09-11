export function AssessmentSaveStatus({
  status,
}: {
  status: 'idle' | 'saving' | 'evaluating' | 'saved';
}) {
  const label =
    status === 'saving'
      ? 'Guardando…'
      : status === 'evaluating'
        ? 'Analizando…'
        : status === 'saved'
          ? 'Información actualizada'
          : 'Lista para responder';
  return (
    <span className="assessment-save-status" data-status={status} role="status" aria-live="polite">
      {label}
    </span>
  );
}
