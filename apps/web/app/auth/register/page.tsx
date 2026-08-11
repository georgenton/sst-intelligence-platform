import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { SiteHeader } from '@/components/site-header';

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <Suspense fallback={<p>Cargando…</p>}>
          <AuthForm mode="register" />
        </Suspense>
      </main>
    </>
  );
}
