import {
  InspectionsDashboard,
  type InspectionsDashboardFilters,
} from '@/components/inspections-ui';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters: InspectionsDashboardFilters = {
    workCenterId: first(params.workCenterId),
    workAreaId: first(params.workAreaId),
    inspectionStatus: first(params.inspectionStatus),
    riskLevel: first(params.riskLevel),
    findingStatus: first(params.findingStatus),
    hasRecurrence: first(params.hasRecurrence),
    overdue: first(params.overdue),
  };
  return <InspectionsDashboard filters={filters} />;
}
