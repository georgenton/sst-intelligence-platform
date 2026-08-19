import { RegulatoryRequirementDetailView } from '@/components/regulatory-requirement-ui';

export default async function Page({ params }: { params: Promise<{ requirementKey: string }> }) {
  const { requirementKey } = await params;
  return <RegulatoryRequirementDetailView requirementKey={requirementKey} />;
}
