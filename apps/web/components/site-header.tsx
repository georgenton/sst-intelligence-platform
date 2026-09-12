import Link from 'next/link';

export function SiteHeader({ authReturnPath }: { authReturnPath?: '/invite/accept' } = {}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'SST Inteligente';
  const authReturnQuery = authReturnPath ? `?next=${encodeURIComponent(authReturnPath)}` : '';
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="brand" href="/">
          {appName}
        </Link>
        <nav className="header-nav" aria-label="Navegación principal">
          <Link href="/evaluacion-sst">Evaluación SST</Link>
          <Link href={`/auth/login${authReturnQuery}`}>Iniciar sesión</Link>
          <Link className="button" href={`/auth/register${authReturnQuery}`}>
            Crear cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}
