export const SUPPORTED_JURISDICTIONS = ['EC'] as const;
export type SupportedJurisdiction = (typeof SUPPORTED_JURISDICTIONS)[number];

/**
 * Keeps the country value that already exists in the organization profile as
 * the single source of truth for jurisdiction decisions.
 */
export function normalizeJurisdictionCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().toLocaleLowerCase('es');
  if (!normalized) return null;
  if (normalized === 'ecuador' || normalized === 'ec') return 'EC';
  if (normalized === 'colombia' || normalized === 'co') return 'CO';
  return normalized.length <= 80 ? normalized.toUpperCase() : normalized.slice(0, 80).toUpperCase();
}

export function isSupportedJurisdictionCode(value: string): value is SupportedJurisdiction {
  return (SUPPORTED_JURISDICTIONS as readonly string[]).includes(value);
}

export function isSupportedJurisdiction(value: unknown): boolean {
  const normalized = normalizeJurisdictionCode(value);
  return normalized !== null && isSupportedJurisdictionCode(normalized);
}
