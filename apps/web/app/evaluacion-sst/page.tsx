import { PublicAssessmentEntry } from '@/components/sst-assessment/public-assessment-entry';
import { SiteHeader } from '@/components/site-header';

export default function PublicSstAssessmentPage() {
  return (
    <>
      <SiteHeader />
      <main className="assessment-page">
        <PublicAssessmentEntry continuation="public" />
      </main>
    </>
  );
}
