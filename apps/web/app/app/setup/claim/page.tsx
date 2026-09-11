import { AssessmentClaim } from '@/components/sst-assessment/assessment-claim';
import { Suspense } from 'react';

export default function AssessmentClaimPage() {
  return (
    <Suspense fallback={<p role="status">Preparando continuidad segura…</p>}>
      <AssessmentClaim />
    </Suspense>
  );
}
