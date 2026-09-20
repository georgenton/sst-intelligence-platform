import { PpeWorkspace } from '@/components/ppe-workspace';

export default async function PpePositionPage({
  params,
}: {
  params: Promise<{ positionId: string }>;
}) {
  const { positionId } = await params;
  return <PpeWorkspace view="positions" positionId={positionId} />;
}
