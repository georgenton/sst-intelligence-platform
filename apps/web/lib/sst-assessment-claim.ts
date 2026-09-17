import { ApiClientError } from '@sst/api-client';

export type ClaimDestinationState = {
  mode: 'UNDECIDED' | 'EXISTING' | 'NEW';
  selectedOrganizationId: string | null;
  createdOrganizationId: string | null;
};

export type ClaimDestinationAction =
  | { type: 'choose-existing'; organizationId: string }
  | { type: 'choose-new' }
  | { type: 'company-created'; organizationId: string }
  | { type: 'reset' };

export const initialClaimDestination: ClaimDestinationState = {
  mode: 'UNDECIDED',
  selectedOrganizationId: null,
  createdOrganizationId: null,
};

export function reduceClaimDestination(
  state: ClaimDestinationState,
  action: ClaimDestinationAction,
): ClaimDestinationState {
  switch (action.type) {
    case 'choose-existing':
      return {
        mode: 'EXISTING',
        selectedOrganizationId: action.organizationId,
        createdOrganizationId: state.createdOrganizationId,
      };
    case 'choose-new':
      return { ...state, mode: 'NEW', selectedOrganizationId: null };
    case 'company-created':
      return { ...state, mode: 'NEW', createdOrganizationId: action.organizationId };
    case 'reset':
      return { ...state, mode: 'UNDECIDED', selectedOrganizationId: null };
  }
}

export function claimDestinationTarget(state: ClaimDestinationState) {
  if (state.mode === 'EXISTING') return state.selectedOrganizationId;
  if (state.mode === 'NEW') return state.createdOrganizationId;
  return null;
}

export function canMutateCentersForClaim(state: ClaimDestinationState) {
  return state.mode === 'NEW' && state.createdOrganizationId !== null;
}

export function claimCompanyActivity(canonicalActivity: string, enteredActivity: string) {
  return enteredActivity.trim() || canonicalActivity.trim();
}

export function canCreateClaimCompany(
  companyName: string,
  canonicalActivity: string,
  enteredActivity: string,
) {
  return (
    companyName.trim().length >= 2 &&
    companyName.trim().length <= 120 &&
    claimCompanyActivity(canonicalActivity, enteredActivity).length >= 2 &&
    claimCompanyActivity(canonicalActivity, enteredActivity).length <= 120
  );
}

export function claimCompanyCreationError(error: unknown) {
  if (
    error instanceof ApiClientError &&
    error.payload.code === 'ORGANIZATION_CREATE_RETRY_CONFLICT'
  ) {
    return 'El intento anterior usó otros datos. Reintenta con los mismos datos o revisa la empresa de destino.';
  }
  return 'No pudimos crear la empresa. Tu diagnóstico sigue guardado. Revisa los datos e intenta nuevamente.';
}
