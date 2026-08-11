import { SolutionFlow } from '@/components/solution-flow';
import { SiteHeader } from '@/components/site-header';

export default function DiagnosticSessionPage() {
  return (
    <>
      <SiteHeader />
      <main className="container" style={{ paddingBlock: 40 }}>
        <SolutionFlow />
      </main>
    </>
  );
}
