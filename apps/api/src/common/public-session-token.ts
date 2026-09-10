import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function publicSessionTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createPublicSessionToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: publicSessionTokenHash(token) };
}

export function publicSessionTokenMatches(expectedHash: string, token: string) {
  const actual = Buffer.from(publicSessionTokenHash(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
