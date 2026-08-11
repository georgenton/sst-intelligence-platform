'use client';

import { apiRequest } from '@sst/api-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

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
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' })
      .then((result) => {
        setUser(result.user);
        setAccessToken(result.accessToken);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(
    async (path: '/auth/login' | '/auth/register', input: Credentials) => {
      const result = await apiRequest<{ user: User; accessToken: string }>(path, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setUser(result.user);
      setAccessToken(result.accessToken);
    },
    [],
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
        await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setUser(null);
        setAccessToken(null);
      },
      request,
    }),
    [accessToken, authenticate, loading, request, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
