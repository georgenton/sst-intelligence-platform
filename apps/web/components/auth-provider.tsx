'use client';

import { apiRequest } from '@sst/api-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { clearStoredActiveOrganization } from '@/lib/active-organization-storage';
import { clearAppearanceSessionUser, setAppearanceSessionUser } from '@/lib/appearance';
import { removeAllPrivateQueries } from '@/lib/query-cache';

type User = { id: string; email: string; displayName: string; memberships?: unknown[] };
type Credentials = { email: string; password: string; displayName?: string };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  login(input: Credentials): Promise<void>;
  register(input: Credentials): Promise<void>;
  logout(): Promise<void>;
  request<T>(path: string, init?: RequestInit, organizationId?: string): Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' })
      .then((result) => {
        setAppearanceSessionUser(window.localStorage, result.user.id);
        setUser(result.user);
        setAccessToken(result.accessToken);
      })
      .catch(() => clearAppearanceSessionUser(window.localStorage))
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(
    async (path: '/auth/login' | '/auth/register', input: Credentials) => {
      const result = await apiRequest<{ user: User; accessToken: string }>(path, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (user?.id !== result.user.id) {
        setLoading(true);
        setAccessToken(null);
        await removeAllPrivateQueries(queryClient);
        if (user?.id) clearStoredActiveOrganization(window.localStorage, user.id);
      }
      setAppearanceSessionUser(window.localStorage, result.user.id);
      setUser(result.user);
      setAccessToken(result.accessToken);
      setLoading(false);
    },
    [queryClient, user?.id],
  );

  const request = useCallback(
    <T,>(path: string, init: RequestInit = {}, organizationId?: string) =>
      apiRequest<T>(path, init, { accessToken: accessToken ?? undefined, organizationId }),
    [accessToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      accessToken,
      login: (input) => authenticate('/auth/login', input),
      register: (input) => authenticate('/auth/register', input),
      logout: async () => {
        const exitingUserId = user?.id;
        setLoading(true);
        setAccessToken(null);
        await removeAllPrivateQueries(queryClient);
        if (exitingUserId) clearStoredActiveOrganization(window.localStorage, exitingUserId);
        clearAppearanceSessionUser(window.localStorage);
        await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setUser(null);
        setLoading(false);
      },
      request,
    }),
    [accessToken, authenticate, loading, queryClient, request, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
