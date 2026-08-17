import { ApplicabilityAssessmentDetail } from '@/components/applicability-ui';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicabilityAssessmentDetail assessmentId={id} />;
}
