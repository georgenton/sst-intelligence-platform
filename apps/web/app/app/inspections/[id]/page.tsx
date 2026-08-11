import { InspectionDetail } from '@/components/inspections-ui';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InspectionDetail inspectionId={id} />;
}
