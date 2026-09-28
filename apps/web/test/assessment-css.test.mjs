import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8');

test('assessment option marker uses an isolated product selector', () => {
  assert.match(css, /\.assessment-option__marker/);
  assert.doesNotMatch(css, /(?:^|[,\s])\.m(?:[\s:{,]|$)/m);
});
