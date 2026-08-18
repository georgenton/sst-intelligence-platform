import { RegulatorySourceDetailView } from '@/components/regulatory-source-ui';

export default async function Page({ params }: { params: Promise<{ sourceKey: string }> }) {
  const { sourceKey } = await params;
  return <RegulatorySourceDetailView sourceKey={sourceKey} />;
}
