export type AssessmentSessionRecord = {
  version: 1;
  sessionId: string;
  publicToken: string;
  expiresAt: string | null;
  targetOrganizationId?: string;
  targetOrganizationMode?: 'EXISTING' | 'NEW';
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const activeKey = 'sst-assessment-session:active';
const recordKey = (sessionId: string) => `sst-assessment-session:${sessionId}`;

export function storePublicAssessmentSession(
  storage: StorageLike,
  record: AssessmentSessionRecord,
) {
  try {
    storage.setItem(recordKey(record.sessionId), JSON.stringify(record));
    storage.setItem(activeKey, record.sessionId);
    return true;
  } catch {
    return false;
  }
}

export function loadPublicAssessmentSession(
  storage: StorageLike,
  sessionId?: string | null,
): AssessmentSessionRecord | null {
  try {
    const id = sessionId ?? storage.getItem(activeKey);
    if (!id) return null;
    const value = JSON.parse(
      storage.getItem(recordKey(id)) ?? 'null',
    ) as Partial<AssessmentSessionRecord> | null;
    if (
      value?.version !== 1 ||
      value.sessionId !== id ||
      typeof value.publicToken !== 'string' ||
      !value.publicToken
    ) {
      return null;
    }
    if (value.expiresAt && Date.parse(value.expiresAt) <= Date.now()) {
      clearPublicAssessmentSession(storage, id);
      return null;
    }
    return value as AssessmentSessionRecord;
  } catch {
    return null;
  }
}

export function rememberAssessmentTargetOrganization(
  storage: StorageLike,
  sessionId: string,
  organizationId: string,
  mode: 'EXISTING' | 'NEW',
) {
  const current = loadPublicAssessmentSession(storage, sessionId);
  return current
    ? storePublicAssessmentSession(storage, {
        ...current,
        targetOrganizationId: organizationId,
        targetOrganizationMode: mode,
      })
    : false;
}

export function forgetAssessmentTargetOrganization(storage: StorageLike, sessionId: string) {
  const current = loadPublicAssessmentSession(storage, sessionId);
  if (!current) return false;
  return storePublicAssessmentSession(storage, {
    version: current.version,
    sessionId: current.sessionId,
    publicToken: current.publicToken,
    expiresAt: current.expiresAt,
  });
}

export function clearPublicAssessmentSession(storage: StorageLike, sessionId: string) {
  try {
    storage.removeItem(recordKey(sessionId));
    if (storage.getItem(activeKey) === sessionId) storage.removeItem(activeKey);
  } catch {
    // Storage is an optional recovery aid; server authority is unaffected.
  }
}

export function assessmentClaimPath(sessionId: string) {
  return `/app/setup/claim?assessment=${encodeURIComponent(sessionId)}`;
}
