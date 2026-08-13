'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { AppearanceProvider } from '@/components/appearance-provider';
import { AuthProvider } from '@/components/auth-provider';

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppearanceProvider>{children}</AppearanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
