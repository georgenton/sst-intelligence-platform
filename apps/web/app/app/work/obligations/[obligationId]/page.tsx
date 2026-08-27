import { ObligationExecutionDetail } from '@/components/operational-work-ui';

export default async function Page({ params }: { params: Promise<{ obligationId: string }> }) {
  const { obligationId } = await params;
  return <ObligationExecutionDetail obligationId={obligationId} />;
}
