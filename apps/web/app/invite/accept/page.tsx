import { InvitationAcceptanceView } from '@/components/invitation-acceptance-view';
import { SiteHeader } from '@/components/site-header';

export default function InvitationAcceptancePage() {
  return (
    <>
      <SiteHeader authReturnPath="/invite/accept" />
      <main className="auth-wrap">
        <InvitationAcceptanceView />
      </main>
    </>
  );
}
