import { FindingDetail } from '@/components/inspections-ui';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; findingId: string }>;
}) {
  const { id, findingId } = await params;
  return <FindingDetail inspectionId={id} findingId={findingId} />;
}
