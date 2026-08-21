import { describe, expect, it } from 'vitest';
import { assertAllowedOfficialUrl } from './source-verifier.js';

describe('official-source URL guard', () => {
  it.each([
    'http://www.trabajo.gob.ec/file.pdf',
    'https://user:pass@www.trabajo.gob.ec/file.pdf',
    'https://www.trabajo.gob.ec:444/file.pdf',
    'https://127.0.0.1/file.pdf',
    'https://localhost/file.pdf',
    'https://trabajo.gob.ec.evil.example/file.pdf',
  ])('rejects unsafe URL %s before network access', async (url) => {
    await expect(assertAllowedOfficialUrl(url)).rejects.toThrow('OFFICIAL_SOURCE_URL_REJECTED');
  });
});
