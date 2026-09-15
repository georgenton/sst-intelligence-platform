import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="auth-wrap">
          <p>Cargando espacio de trabajo…</p>
        </main>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
