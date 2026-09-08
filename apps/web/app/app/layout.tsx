import { AppShell } from '@/components/app-shell';
import { resolveFrontendEnvironmentIdentity } from '@/lib/environment-identity';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell environmentIdentity={resolveFrontendEnvironmentIdentity()}>{children}</AppShell>;
}
