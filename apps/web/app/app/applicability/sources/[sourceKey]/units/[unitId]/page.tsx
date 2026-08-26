import { RegulatoryUnitDetailView } from '@/components/regulatory-source-ui';

export default async function Page({
  params,
}: {
  params: Promise<{ sourceKey: string; unitId: string }>;
}) {
  const { sourceKey, unitId } = await params;
  return <RegulatoryUnitDetailView sourceKey={sourceKey} unitId={unitId} />;
}
