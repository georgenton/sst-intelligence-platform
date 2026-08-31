import { NewFinding } from '@/components/inspections-ui';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criterionResultId?: string }>;
}) {
  const { id } = await params;
  const { criterionResultId } = await searchParams;
  return <NewFinding inspectionId={id} criterionResultId={criterionResultId} />;
}
