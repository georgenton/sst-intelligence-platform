import { AssessmentPlanHandoff } from '@/components/assessment-plan-handoff';
import { OperationalPlans } from '@/components/operational-plans-ui';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string }>;
}) {
  const { assessment } = await searchParams;
  return assessment ? (
    <AssessmentPlanHandoff key={assessment} assessmentId={assessment} />
  ) : (
    <OperationalPlans manual />
  );
}
