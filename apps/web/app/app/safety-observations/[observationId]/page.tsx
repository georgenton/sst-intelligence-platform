import { SafetyObservationDetail } from '@/components/safety-observations-ui';

export default async function SafetyObservationDetailPage({
  params,
}: {
  params: Promise<{ observationId: string }>;
}) {
  const { observationId } = await params;
  return <SafetyObservationDetail observationId={observationId} />;
}
