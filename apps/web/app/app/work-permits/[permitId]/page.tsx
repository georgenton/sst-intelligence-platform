import { WorkPermitDetail } from '@/components/work-permits-ui';

export default async function Page({ params }: { params: Promise<{ permitId: string }> }) {
  const { permitId } = await params;
  return <WorkPermitDetail permitId={permitId} />;
}
