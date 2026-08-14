import { InspectionAnalytics, type InspectionAnalyticsFilters } from '@/components/inspections-ui';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters: InspectionAnalyticsFilters = {
    workCenterId: first(params.workCenterId),
    workAreaId: first(params.workAreaId),
    category: first(params.category),
  };
  return <InspectionAnalytics filters={filters} />;
}
