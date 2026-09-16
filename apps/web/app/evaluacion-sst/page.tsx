import { PublicAssessmentEntry } from '@/components/sst-assessment/public-assessment-entry';
import { SiteHeader } from '@/components/site-header';

export default function PublicSstAssessmentPage() {
  return (
    <div className="assessment-public">
      <SiteHeader />
      <main className="assessment-page">
        <PublicAssessmentEntry continuation="public" />
      </main>
    </div>
  );
}
