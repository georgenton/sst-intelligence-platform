import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
  storeFocus(storage, 'user-a', 'inspections', 'on');
  storeFocus(storage, 'user-a', 'technical-risk', 'off');

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
    appearanceFocusStorageKey('user-a', 'technical-risk').includes('organization'),
    false,
  );
});
