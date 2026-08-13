'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  appearanceFocusScope,
  appearanceThemeLabels,
  appearanceThemes,
  clearAppearanceSessionUser,
  defaultAppearanceTheme,
  isAppearanceTheme,
  isAuthenticatedSurface,
  resolveAppearanceForSurface,
  setAppearanceSessionUser,
  storeFocus,
  storeTheme,
  type AppearanceTheme,
  type FocusPreference,
} from '@/lib/appearance';
import { useAuth } from './auth-provider';

type AppearanceContextValue = {
  theme: AppearanceTheme;
  focus: FocusPreference;
  setTheme(theme: AppearanceTheme): void;
  setFocus(focus: FocusPreference): void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function applyAppearance(theme: AppearanceTheme, focus: FocusPreference): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.focus = focus;
  root.style.colorScheme = theme === 'noche' ? 'dark' : 'light';
}

function rootTheme(): AppearanceTheme {
  const value = document.documentElement.dataset.theme;
  return isAppearanceTheme(value) ? value : defaultAppearanceTheme;
}

function rootFocus(): FocusPreference {
  return document.documentElement.dataset.focus === 'on' ? 'on' : 'off';
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const pathname = usePathname();
  const [theme, setThemeState] = useState<AppearanceTheme>(defaultAppearanceTheme);
  const [focus, setFocusState] = useState<FocusPreference>('off');
  const authenticatedSurface = isAuthenticatedSurface(pathname);
  const scope = appearanceFocusScope(pathname);
  const userId = auth.user?.id;

  useLayoutEffect(() => {
    if (!authenticatedSurface) {
      applyAppearance(defaultAppearanceTheme, 'off');
      setThemeState(defaultAppearanceTheme);
      setFocusState('off');
      return;
    }
    if (!userId) {
      if (!auth.loading) {
        clearAppearanceSessionUser(window.localStorage);
        applyAppearance(defaultAppearanceTheme, 'off');
        setThemeState(defaultAppearanceTheme);
        setFocusState('off');
      } else {
        setThemeState(rootTheme());
        setFocusState(rootFocus());
      }
      return;
    }
    setAppearanceSessionUser(window.localStorage, userId);
    const { theme: nextTheme, focus: nextFocus } = resolveAppearanceForSurface(
      window.localStorage,
      pathname,
      userId,
    );
    applyAppearance(nextTheme, nextFocus);
    setThemeState(nextTheme);
    setFocusState(nextFocus);
  }, [auth.loading, authenticatedSurface, pathname, scope, userId]);

  const setTheme = useCallback(
    (nextTheme: AppearanceTheme) => {
      if (!authenticatedSurface || !userId) return;
      applyAppearance(nextTheme, focus);
      setThemeState(nextTheme);
      storeTheme(window.localStorage, userId, nextTheme);
    },
    [authenticatedSurface, focus, userId],
  );

  const setFocus = useCallback(
    (nextFocus: FocusPreference) => {
      if (!authenticatedSurface || !userId) return;
      applyAppearance(theme, nextFocus);
      setFocusState(nextFocus);
      storeFocus(window.localStorage, userId, scope, nextFocus);
    },
    [authenticatedSurface, scope, theme, userId],
  );

  const value = useMemo(
    () => ({ theme, focus, setTheme, setFocus }),
    [focus, setFocus, setTheme, theme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function AppearanceControls() {
  const { theme, focus, setTheme, setFocus } = useAppearance();
  return (
    <fieldset className="appearance-controls">
      <legend>Apariencia</legend>
      <label className="theme-control">
        <span>Tema</span>
        <select
          aria-label="Tema visual"
          value={theme}
          onChange={(event) => setTheme(event.target.value as AppearanceTheme)}
        >
          {appearanceThemes.map((option) => (
            <option value={option} key={option}>
              {appearanceThemeLabels[option]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="focus-switch"
        role="switch"
        aria-checked={focus === 'on'}
        onClick={() => setFocus(focus === 'on' ? 'off' : 'on')}
      >
        Enfoque {focus === 'on' ? 'activo' : 'inactivo'}
      </button>
    </fieldset>
  );
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('AppearanceProvider is required');
  return value;
}
