'use client';

import { apiRequest } from '@sst/api-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { clearStoredActiveOrganization } from '@/lib/active-organization-storage';
import {
  AuthSessionChangedError,
  createAuthenticatedRequestCoordinator,
} from '@/lib/authenticated-request';
import { clearAppearanceSessionUser, setAppearanceSessionUser } from '@/lib/appearance';
import {
  captureBrowserRefreshSettlement,
  createAuthSessionGeneration,
  refreshBrowserSession,
  startLogoutServerInvalidation,
  waitForBrowserRefreshSettlement,
  type AuthSessionUser,
} from '@/lib/auth-refresh';
import { removeAllPrivateQueries } from '@/lib/query-cache';

type Credentials = { email: string; password: string; displayName?: string };
type AuthContextValue = {
  user: AuthSessionUser | null;
  loading: boolean;
  sessionEnded: boolean;
  accessToken: string | null;
  login(input: Credentials): Promise<void>;
  register(input: Credentials): Promise<void>;
  logout(): Promise<void>;
  request<T>(
    path: string,
    init?: RequestInit,
    organizationId?: string,
    sessionToken?: string,
  ): Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const sessionGeneration = useRef(createAuthSessionGeneration()).current;
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const sessionRef = useRef<{ user: AuthSessionUser | null; accessToken: string | null }>({
    user: null,
    accessToken: null,
  });

  const commitSession = useCallback((result: { user: AuthSessionUser; accessToken: string }) => {
    sessionRef.current = result;
    setUser(result.user);
    setAccessToken(result.accessToken);
  }, []);

  useEffect(() => {
    const generation = sessionGeneration.capture();
    void refreshBrowserSession()
      .then((result) => {
        sessionGeneration.commit(generation, () => {
          setAppearanceSessionUser(window.localStorage, result.user.id);
          commitSession(result);
        });
      })
      .catch(() => {
        sessionGeneration.commit(generation, () => clearAppearanceSessionUser(window.localStorage));
      })
      .finally(() => {
        sessionGeneration.commit(generation, () => setLoading(false));
      });
  }, [commitSession, sessionGeneration]);

  const authenticate = useCallback(
    async (path: '/auth/login' | '/auth/register', input: Credentials) => {
      const generation = sessionGeneration.advance();
      try {
        await waitForBrowserRefreshSettlement();
        if (!sessionGeneration.isCurrent(generation)) return;
        const result = await apiRequest<{ user: AuthSessionUser; accessToken: string }>(path, {
          method: 'POST',
          body: JSON.stringify(input),
        });
        if (!sessionGeneration.isCurrent(generation)) return;
        if (user?.id !== result.user.id) {
          setLoading(true);
          sessionRef.current = { user: null, accessToken: null };
          setAccessToken(null);
          await removeAllPrivateQueries(queryClient);
          if (!sessionGeneration.isCurrent(generation)) return;
          if (user?.id) clearStoredActiveOrganization(window.localStorage, user.id);
        }
        sessionGeneration.commit(generation, () => {
          setAppearanceSessionUser(window.localStorage, result.user.id);
          commitSession(result);
          setSessionEnded(false);
          setLoading(false);
        });
      } catch (error: unknown) {
        sessionGeneration.commit(generation, () => setLoading(false));
        throw error;
      }
    },
    [commitSession, queryClient, sessionGeneration, user?.id],
  );

  const refreshForGeneration = useCallback(
    async (generation: number) => {
      const result = await refreshBrowserSession();
      if (!sessionGeneration.isCurrent(generation)) throw new AuthSessionChangedError();
      sessionGeneration.commit(generation, () => {
        setAppearanceSessionUser(window.localStorage, result.user.id);
        commitSession(result);
      });
      return { accessToken: result.accessToken };
    },
    [commitSession, sessionGeneration],
  );

  const invalidateExpiredSession = useCallback(
    async (generation: number) => {
      if (!sessionGeneration.isCurrent(generation)) return;
      sessionGeneration.advance();
      const exitingUserId = sessionRef.current.user?.id;
      sessionRef.current = { user: null, accessToken: null };
      setAccessToken(null);
      setUser(null);
      setLoading(false);
      setSessionEnded(true);
      clearAppearanceSessionUser(window.localStorage);
      await removeAllPrivateQueries(queryClient);
      if (exitingUserId) clearStoredActiveOrganization(window.localStorage, exitingUserId);
    },
    [queryClient, sessionGeneration],
  );

  const request = useMemo(
    () =>
      createAuthenticatedRequestCoordinator({
        getSession: () => ({
          accessToken: sessionRef.current.accessToken,
          generation: sessionGeneration.capture(),
        }),
        refresh: refreshForGeneration,
        invalidate: invalidateExpiredSession,
      }),
    [invalidateExpiredSession, refreshForGeneration, sessionGeneration],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionEnded,
      accessToken,
      login: (input) => authenticate('/auth/login', input),
      register: (input) => authenticate('/auth/register', input),
      logout: async () => {
        const generation = sessionGeneration.advance();
        const capturedRefreshSettlement = captureBrowserRefreshSettlement();
        const exitingUserId = user?.id;
        setLoading(true);
        sessionRef.current = { user: null, accessToken: null };
        setAccessToken(null);
        setUser(null);
        setSessionEnded(false);
        clearAppearanceSessionUser(window.localStorage);
        const firstServerLogout = startLogoutServerInvalidation({
          capturedRefreshSettlement,
          isCurrentGeneration: () => sessionGeneration.isCurrent(generation),
          requestLogout: () => apiRequest('/auth/logout', { method: 'POST' }),
        });
        await removeAllPrivateQueries(queryClient);
        if (exitingUserId) clearStoredActiveOrganization(window.localStorage, exitingUserId);
        await firstServerLogout;
        sessionGeneration.commit(generation, () => setLoading(false));
      },
      request,
    }),
    [
      accessToken,
      authenticate,
      loading,
      queryClient,
      request,
      sessionEnded,
      sessionGeneration,
      user,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
