import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/themes.css';
import './globals.css';
import '@/styles/foundations.css';
import '@/styles/focus.css';
import '@/styles/app-shell-command-center.css';
import '@/styles/inspections-experience.css';
import '@/styles/technical-risk-experience.css';
import '@/styles/applicability-experience.css';
import '@/styles/workforce-safety.css';
import { Providers } from './providers';
import { appearanceBootstrapScript } from '@/lib/appearance';

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  weight: 'variable',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
  subsets: ['latin', 'latin-ext'],
  preload: false,
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? process.env.APP_NAME ?? 'SST Inteligente';

export const metadata: Metadata = {
  title: { default: appName, template: `%s | ${appName}` },
  description: 'Plataforma modular para organizar la gestión de Seguridad y Salud en el Trabajo.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      data-theme="operativo"
      data-focus="off"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrapScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
