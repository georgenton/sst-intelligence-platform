import { InspectionAlerts, type InspectionAlertFilters } from '@/components/inspections-ui';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters: InspectionAlertFilters = {
    status: Array.isArray(params.status) ? params.status[0] : params.status,
  };
  return <InspectionAlerts filters={filters} />;
}
