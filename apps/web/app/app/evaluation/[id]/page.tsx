import { UnifiedSstEvaluationDetailView } from '@/components/unified-sst-evaluation-ui';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UnifiedSstEvaluationDetailView evaluationId={id} />;
}
