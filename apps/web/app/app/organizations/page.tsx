import { Suspense } from 'react';
import { OrganizationsView } from '@/components/organizations-view';

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <OrganizationsView />
    </Suspense>
  );
}
