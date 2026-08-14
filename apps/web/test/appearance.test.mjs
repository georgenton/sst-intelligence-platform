import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import {
  appearanceFocusScope,
  appearanceFocusStorageKey,
  appearanceSessionUserKey,
  appearanceThemeStorageKey,
  clearAppearanceSessionUser,
  isAppearanceTheme,
  resolveAppearanceForSurface,
  resolveStoredFocus,
  resolveStoredTheme,
  setAppearanceSessionUser,
  storeFocus,
  storeTheme,
} from '../lib/appearance.ts';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    get: (key) => values.get(key),
    has: (key) => values.has(key),
  };
}

test('accepts only the four authoritative theme values and falls back safely', () => {
  assert.equal(isAppearanceTheme('operativo'), true);
  assert.equal(isAppearanceTheme('sereno'), true);
  assert.equal(isAppearanceTheme('noche'), true);
  assert.equal(isAppearanceTheme('contraste'), true);
  assert.equal(isAppearanceTheme('alto-contraste'), false);
  assert.equal(isAppearanceTheme('invalid'), false);

  const storage = memoryStorage({ [appearanceThemeStorageKey('user-a')]: 'invalid' });
  assert.equal(resolveStoredTheme(storage, 'user-a'), 'operativo');
});

test('persists theme per user without organization ownership or cross-user leakage', () => {
  const storage = memoryStorage();
  storeTheme(storage, 'user-a', 'noche');
  storeTheme(storage, 'user-b', 'sereno');

  assert.equal(resolveStoredTheme(storage, 'user-a'), 'noche');
  assert.equal(resolveStoredTheme(storage, 'user-b'), 'sereno');
  assert.equal(resolveStoredTheme(storage, 'user-c'), 'operativo');
  assert.equal(appearanceThemeStorageKey('user-a').includes('organization'), false);
});

test('forces public surfaces to Operativo with focus off even when a user preference exists', () => {
  const storage = memoryStorage();
  storeTheme(storage, 'user-a', 'noche');
  storeFocus(storage, 'user-a', 'workspace', 'on');

  assert.deepEqual(resolveAppearanceForSurface(storage, '/', 'user-a'), {
    theme: 'operativo',
    focus: 'off',
  });
  assert.deepEqual(resolveAppearanceForSurface(storage, '/diagnostico', 'user-a'), {
    theme: 'operativo',
    focus: 'off',
  });
});

test('keeps focus independent from theme and remembers it per task type', () => {
  const storage = memoryStorage();
  storeTheme(storage, 'user-a', 'contraste');
  storeFocus(storage, 'user-a', 'inspection', 'on');
  storeFocus(storage, 'user-a', 'technical-assessment', 'off');

  assert.deepEqual(resolveAppearanceForSurface(storage, '/app/inspections/new', 'user-a'), {
    theme: 'contraste',
    focus: 'on',
  });
  assert.deepEqual(resolveAppearanceForSurface(storage, '/app/technical-risk/new', 'user-a'), {
    theme: 'contraste',
    focus: 'off',
  });
  assert.equal(resolveStoredFocus(storage, 'user-a', 'workspace'), 'off');
});

test('maps only real task routes to distinct focus scopes', () => {
  assert.equal(appearanceFocusScope('/app/inspections'), 'workspace');
  assert.equal(appearanceFocusScope('/app/inspections/alerts'), 'workspace');
  assert.equal(appearanceFocusScope('/app/inspections/new'), 'inspection');
  assert.equal(appearanceFocusScope('/app/inspections/inspection-id'), 'inspection');
  assert.equal(appearanceFocusScope('/app/inspections/inspection-id/findings/new'), 'finding');
  assert.equal(
    appearanceFocusScope('/app/inspections/inspection-id/findings/finding-id'),
    'finding',
  );
  assert.equal(appearanceFocusScope('/app/technical-risk'), 'workspace');
  assert.equal(appearanceFocusScope('/app/technical-risk/new'), 'technical-assessment');
  assert.equal(appearanceFocusScope('/app/technical-risk/assessment-id'), 'technical-assessment');
  assert.equal(
    appearanceFocusScope('/app/technical-risk/assessment-id/review'),
    'professional-review',
  );
});

test('does not leak focus between inspection and finding task types', () => {
  const storage = memoryStorage();
  storeFocus(storage, 'user-a', 'inspection', 'on');

  assert.equal(
    resolveAppearanceForSurface(storage, '/app/inspections/inspection-id', 'user-a').focus,
    'on',
  );
  assert.equal(
    resolveAppearanceForSurface(
      storage,
      '/app/inspections/inspection-id/findings/finding-id',
      'user-a',
    ).focus,
    'off',
  );
});

test('does not leak focus between technical assessment and professional review', () => {
  const storage = memoryStorage();
  storeTheme(storage, 'user-a', 'noche');
  storeFocus(storage, 'user-a', 'technical-assessment', 'on');

  assert.deepEqual(
    resolveAppearanceForSurface(storage, '/app/technical-risk/assessment-id', 'user-a'),
    { theme: 'noche', focus: 'on' },
  );
  assert.deepEqual(
    resolveAppearanceForSurface(storage, '/app/technical-risk/assessment-id/review', 'user-a'),
    { theme: 'noche', focus: 'off' },
  );
});

test('keeps Plex Mono available without globally preloading it', () => {
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');

  assert.match(layout, /IBM_Plex_Mono/);
  assert.match(layout, /const plexMono = IBM_Plex_Mono\(\{[\s\S]*?preload: false,/);
  assert.match(layout, /className=\{`\$\{plexSans\.variable\} \$\{plexMono\.variable\}`\}/);
});

test('focus motion reduction is opt-in and never targets every descendant', () => {
  const focusCss = readFileSync(new URL('../styles/focus.css', import.meta.url), 'utf8');

  assert.doesNotMatch(
    focusCss,
    /\[data-focus=['"]on['"]\]\s+\*\s*\{[^}]*?(?:animation|transition)-duration/s,
  );
  assert.match(focusCss, /\[data-focus='on'\] \.focus-decorative-motion/);
});

test('session owner marker can be replaced and cleared without deleting user preferences', () => {
  const storage = memoryStorage();
  storeTheme(storage, 'user-a', 'noche');
  setAppearanceSessionUser(storage, 'user-a');
  assert.equal(storage.get(appearanceSessionUserKey), 'user-a');
  setAppearanceSessionUser(storage, 'user-b');
  assert.equal(storage.get(appearanceSessionUserKey), 'user-b');
  clearAppearanceSessionUser(storage);

  assert.equal(storage.has(appearanceSessionUserKey), false);
  assert.equal(resolveStoredTheme(storage, 'user-a'), 'noche');
});

test('storage failures preserve in-memory safety defaults and never throw', () => {
  const unavailableStorage = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
    removeItem: () => {
      throw new Error('storage disabled');
    },
  };

  assert.equal(resolveStoredTheme(unavailableStorage, 'user-a'), 'operativo');
  assert.equal(resolveStoredFocus(unavailableStorage, 'user-a', 'inspections'), 'off');
  assert.doesNotThrow(() => storeTheme(unavailableStorage, 'user-a', 'noche'));
  assert.doesNotThrow(() => storeFocus(unavailableStorage, 'user-a', 'inspections', 'on'));
  assert.doesNotThrow(() => setAppearanceSessionUser(unavailableStorage, 'user-a'));
  assert.doesNotThrow(() => clearAppearanceSessionUser(unavailableStorage));
  assert.equal(
    appearanceFocusStorageKey('user-a', 'technical-assessment').includes('organization'),
    false,
  );
});
