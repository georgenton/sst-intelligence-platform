import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRequest } from '../dist/index.js';

test('apiRequest propagates AbortSignal to fetch without a second HTTP client', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let receivedSignal;
  globalThis.fetch = async (_input, init) => {
    receivedSignal = init.signal;
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true },
      );
    });
  };

  try {
    const request = apiRequest('/health', { signal: controller.signal });
    controller.abort();
    await assert.rejects(request, { name: 'AbortError' });
    assert.equal(receivedSignal, controller.signal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
