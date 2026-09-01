import { WorkerWorkspace } from '@/components/workforce-safety-ui';

export default async function WorkerPage({ params }: { params: Promise<{ workerId: string }> }) {
  const { workerId } = await params;
  return <WorkerWorkspace workerId={workerId} />;
}
