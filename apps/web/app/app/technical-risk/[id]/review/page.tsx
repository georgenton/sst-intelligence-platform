import { TechnicalAssessmentReview } from '@/components/technical-risk-ui';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TechnicalAssessmentReview assessmentId={id} />;
}
