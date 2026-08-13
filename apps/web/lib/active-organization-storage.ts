export type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const legacyKey = 'active-organization-id';
const storageVersion = 'v1';

export function activeOrganizationStorageKey(userId: string) {
  return `active-organization-id:${storageVersion}:${userId}`;
}

export function resolveStoredActiveOrganization(
  storage: StorageAdapter,
  userId: string,
  validOrganizationIds: readonly string[],
) {
  try {
    storage.removeItem(legacyKey);
    const key = activeOrganizationStorageKey(userId);
    const stored = storage.getItem(key);
    if (stored && validOrganizationIds.includes(stored)) return stored;
    if (stored) storage.removeItem(key);
  } catch {
    // Storage can be disabled; active membership data remains authoritative.
  }
  return validOrganizationIds[0] ?? null;
}

export function storeActiveOrganization(
  storage: StorageAdapter,
  userId: string,
  organizationId: string,
  validOrganizationIds: readonly string[],
) {
  if (!validOrganizationIds.includes(organizationId)) {
    throw new Error('ACTIVE_ORGANIZATION_NOT_AVAILABLE');
  }
  try {
    storage.setItem(activeOrganizationStorageKey(userId), organizationId);
  } catch {
    // A valid in-memory context can continue when browser storage is unavailable.
  }
}

export function clearStoredActiveOrganization(storage: StorageAdapter, userId: string) {
  try {
    storage.removeItem(activeOrganizationStorageKey(userId));
    storage.removeItem(legacyKey);
  } catch {
    // Logout cache isolation does not depend on browser storage being available.
  }
}
