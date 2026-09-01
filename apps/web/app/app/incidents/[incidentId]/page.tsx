import { IncidentWorkspace } from '@/components/incidents-ui';

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  return <IncidentWorkspace incidentId={incidentId} />;
}
