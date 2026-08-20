import { adaptiveContentHash } from '@sst/contracts';

export function assertPublishedVersionMatches(label: string, actual: unknown, expected: unknown) {
  if (adaptiveContentHash(actual) !== adaptiveContentHash(expected))
    throw new Error(`PUBLISHED_VERSION_DRIFT:${label}`);
}
