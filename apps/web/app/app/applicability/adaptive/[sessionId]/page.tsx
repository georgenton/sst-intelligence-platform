import { AdaptiveConfigurationSessionView } from '@/components/adaptive-configuration-ui';

export default async function AdaptiveConfigurationSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <AdaptiveConfigurationSessionView sessionId={sessionId} />;
}
