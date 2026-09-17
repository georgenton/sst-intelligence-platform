import type { AssessmentSetupState } from './sst-assessment-types';

export function requiresAssessmentSetup(state: AssessmentSetupState | null | undefined) {
  return state?.hardGate === true;
}

export function isAssessmentSetupPath(pathname: string, state?: AssessmentSetupState | null) {
  return (
    (state?.state === 'DIAGNOSIS_READY' &&
      Boolean(state.finalizedAt) &&
      (pathname === '/app/plans' || pathname.startsWith('/app/plans/'))) ||
    pathname === '/app/evaluation' ||
    pathname.startsWith('/app/evaluation/') ||
    pathname === '/app/organizations' ||
    pathname === '/app/setup' ||
    pathname.startsWith('/app/setup/')
  );
}

export function canMountPrivateApplicationChildren(
  state: AssessmentSetupState | null | undefined,
  pathname: string,
) {
  return !requiresAssessmentSetup(state) || isAssessmentSetupPath(pathname, state);
}

export function setupStateMessage(state: AssessmentSetupState['state']) {
  if (state === 'ASSESSMENT_IN_PROGRESS') return 'Tu Evaluación SST está en curso.';
  if (state === 'DIAGNOSIS_READY') return 'Tu diagnóstico está listo.';
  if (state === 'LEGACY_CONFIGURED') return 'Tu empresa conserva su configuración SST actual.';
  return 'Conozcamos primero cómo funciona tu empresa.';
}
