import { OperationalWorkQueue } from '@/components/operational-work-ui';

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return (
    <OperationalWorkQueue
      initialFilters={{
        status: first(params.status),
        module: first(params.module),
        priority: first(params.priority),
        workCenterId: first(params.workCenterId),
        assignedToUserId: first(params.assignedToUserId),
        dueFrom: first(params.dueFrom),
        dueTo: first(params.dueTo),
      }}
    />
  );
}
