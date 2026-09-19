import { FindingDetail } from '@/components/inspections-ui';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; findingId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { id, findingId } = await params;
  const { action } = await searchParams;
  return <FindingDetail inspectionId={id} findingId={findingId} actionId={action} />;
}
