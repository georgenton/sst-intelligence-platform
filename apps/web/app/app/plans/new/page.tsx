import { AssessmentPlanHandoff } from '@/components/assessment-plan-handoff';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string }>;
}) {
  const { assessment } = await searchParams;
  return assessment ? (
    <AssessmentPlanHandoff key={assessment} assessmentId={assessment} />
  ) : (
    <p>Selecciona un diagnóstico finalizado desde Evaluación SST.</p>
  );
}
