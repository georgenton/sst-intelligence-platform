import Link from 'next/link';

export function SiteHeader() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'SST Inteligente';
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="brand" href="/">
          {appName}
        </Link>
        <nav className="header-nav" aria-label="Navegación principal">
          <Link href="/diagnostico">Diagnóstico</Link>
          <Link href="/auth/login">Iniciar sesión</Link>
          <Link className="button" href="/auth/register">
            Crear cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}
