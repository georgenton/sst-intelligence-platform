import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? process.env.APP_NAME ?? 'SST Inteligente';

export const metadata: Metadata = {
  title: { default: appName, template: `%s | ${appName}` },
  description: 'Plataforma modular para organizar la gestión de Seguridad y Salud en el Trabajo.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
