import { TrainingSessionWorkspace } from '@/components/training-ui';

export default async function TrainingSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <TrainingSessionWorkspace sessionId={sessionId} />;
}
