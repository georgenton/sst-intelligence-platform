export type EntitlementValue = boolean | number | string;

export const WORK_PERMITS_FEATURE_KEY = 'module.work_permits';
export const INCIDENTS_FEATURE_KEY = 'module.incidents';
export const PPE_FEATURE_KEY = 'module.ppe';
export const TRAINING_FEATURE_KEY = 'module.training';
export const WORKFORCE_PREVIEW_FEATURE_KEYS = [
  INCIDENTS_FEATURE_KEY,
  PPE_FEATURE_KEY,
  TRAINING_FEATURE_KEY,
] as const;

export function parseEntitlement(value: string): EntitlementValue {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

export function isDemoActive(expiresAt: Date | null, now = new Date()) {
  return expiresAt !== null && expiresAt.getTime() > now.getTime();
}

export function isWorkPermitsDemoPreviewActive(
  organizationStatus: string,
  demoExpiresAt: Date | null,
  now = new Date(),
) {
  return organizationStatus === 'DEMO' && isDemoActive(demoExpiresAt, now);
}

export function isModuleAccessActive(status: string, expiresAt: Date | null, now = new Date()) {
  if (status === 'ACTIVE') return expiresAt === null || isDemoActive(expiresAt, now);
  return isDemoActive(expiresAt, now);
}

export function roleAllows(role: string, allowed: readonly string[]) {
  return allowed.includes(role);
}
