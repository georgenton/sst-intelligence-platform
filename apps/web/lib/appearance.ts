export const appearanceThemes = ['operativo', 'sereno', 'noche', 'contraste'] as const;
export type AppearanceTheme = (typeof appearanceThemes)[number];
export type FocusPreference = 'on' | 'off';
export type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type ResolvedAppearance = { theme: AppearanceTheme; focus: FocusPreference };

export const defaultAppearanceTheme: AppearanceTheme = 'operativo';
export const appearanceSessionUserKey = 'sst:appearance:active-user';

export const appearanceThemeLabels: Record<AppearanceTheme, string> = {
  operativo: 'Operativo',
  sereno: 'Sereno',
  noche: 'Noche',
  contraste: 'Alto contraste',
};

export function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return appearanceThemes.includes(value as AppearanceTheme);
}

export function isAuthenticatedSurface(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/');
}

export function appearanceFocusScope(pathname: string): string {
  if (pathname.startsWith('/app/inspections')) return 'inspections';
  if (pathname.startsWith('/app/technical-risk')) return 'technical-risk';
  return 'workspace';
}

export function appearanceThemeStorageKey(userId: string): string {
  return `sst:appearance:user:${encodeURIComponent(userId)}:theme`;
}

export function appearanceFocusStorageKey(userId: string, scope: string): string {
  return `sst:appearance:user:${encodeURIComponent(userId)}:focus:${encodeURIComponent(scope)}`;
}

export function resolveStoredTheme(storage: AppearanceStorage, userId: string): AppearanceTheme {
  try {
    const stored = storage.getItem(appearanceThemeStorageKey(userId));
    return isAppearanceTheme(stored) ? stored : defaultAppearanceTheme;
  } catch {
    return defaultAppearanceTheme;
  }
}

export function storeTheme(
  storage: AppearanceStorage,
  userId: string,
  theme: AppearanceTheme,
): void {
  try {
    storage.setItem(appearanceThemeStorageKey(userId), theme);
  } catch {
    // Browser storage can be disabled; the in-memory preference still applies.
  }
}

export function resolveStoredFocus(
  storage: AppearanceStorage,
  userId: string,
  scope: string,
): FocusPreference {
  try {
    return storage.getItem(appearanceFocusStorageKey(userId, scope)) === 'on' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export function storeFocus(
  storage: AppearanceStorage,
  userId: string,
  scope: string,
  focus: FocusPreference,
): void {
  try {
    storage.setItem(appearanceFocusStorageKey(userId, scope), focus);
  } catch {
    // Browser storage can be disabled; the in-memory preference still applies.
  }
}

export function setAppearanceSessionUser(storage: AppearanceStorage, userId: string): void {
  try {
    storage.setItem(appearanceSessionUserKey, userId);
  } catch {
    // The app remains usable with the default theme when storage is unavailable.
  }
}

export function clearAppearanceSessionUser(storage: AppearanceStorage): void {
  try {
    storage.removeItem(appearanceSessionUserKey);
  } catch {
    // Storage cleanup is best effort and contains no security decision.
  }
}

export function resolveAppearanceForSurface(
  storage: AppearanceStorage,
  pathname: string,
  userId: string | null,
): ResolvedAppearance {
  if (!isAuthenticatedSurface(pathname) || !userId) {
    return { theme: defaultAppearanceTheme, focus: 'off' };
  }
  return {
    theme: resolveStoredTheme(storage, userId),
    focus: resolveStoredFocus(storage, userId, appearanceFocusScope(pathname)),
  };
}

export const appearanceBootstrapScript = `
(() => {
  const root = document.documentElement;
  const path = window.location.pathname;
  const authenticated = path === '/app' || path.startsWith('/app/');
  let theme = 'operativo';
  let focus = 'off';
  if (authenticated) {
    try {
      const userId = window.localStorage.getItem('sst:appearance:active-user');
      if (userId) {
        const userKey = encodeURIComponent(userId);
        const storedTheme = window.localStorage.getItem('sst:appearance:user:' + userKey + ':theme');
        if (['operativo', 'sereno', 'noche', 'contraste'].includes(storedTheme)) theme = storedTheme;
        const scope = path.startsWith('/app/inspections')
          ? 'inspections'
          : path.startsWith('/app/technical-risk')
            ? 'technical-risk'
            : 'workspace';
        if (window.localStorage.getItem('sst:appearance:user:' + userKey + ':focus:' + scope) === 'on') focus = 'on';
      }
    } catch {}
  }
  root.dataset.theme = theme;
  root.dataset.focus = focus;
  root.style.colorScheme = theme === 'noche' ? 'dark' : 'light';
})();`;
