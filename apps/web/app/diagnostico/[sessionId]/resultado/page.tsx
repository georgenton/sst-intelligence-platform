import { RecommendationResult } from '@/components/recommendation-result';
import { SiteHeader } from '@/components/site-header';

export default function ResultPage() {
  return (
    <>
      <SiteHeader />
      <main className="container" style={{ paddingBlock: 40 }}>
        <RecommendationResult />
      </main>
    </>
  );
}
