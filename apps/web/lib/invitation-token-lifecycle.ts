const TERMINAL_INVITATION_STATUSES = new Set(['ACCEPTED', 'REVOKED', 'EXPIRED']);

const TERMINAL_INVITATION_ERROR_CODES = new Set([
  'INVITATION_ALREADY_USED',
  'INVITATION_EXPIRED',
  'INVITATION_NOT_FOUND',
  'INVITATION_REVOKED',
]);

export function isTerminalInvitationStatus(status: string | undefined) {
  return Boolean(status && TERMINAL_INVITATION_STATUSES.has(status));
}

export function isTerminalInvitationErrorCode(code: string | undefined) {
  return Boolean(code && TERMINAL_INVITATION_ERROR_CODES.has(code));
}

export function clearStoredInvitationToken(
  storage: Pick<Storage, 'removeItem'>,
  storageKey: string,
) {
  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}
