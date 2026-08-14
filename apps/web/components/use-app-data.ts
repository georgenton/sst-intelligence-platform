'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';

export type ModuleItem = {
  status: string;
  source: string;
  expiresAt?: string;
  module: {
    key: string;
    name: string;
    description: string;
    objective: string;
    demoContent: { label?: string; indicators?: Array<{ label: string; value: string | number }> };
  };
};
export type DashboardData = {
  organization: {
    id: string;
    name: string;
    status: string;
    demoStartedAt?: string;
    demoExpiresAt?: string;
    _count: { workCenters: number; memberships: number };
    modules: ModuleItem[];
  };
  entitlements: {
    plan: { key: string; name: string };
    features: Record<string, boolean | number | string>;
    demoActive: boolean;
    demoExpiresAt?: string;
  };
  inspections: null | {
    openFindings: number;
    highCriticalFindings: number;
    overdueActions: number;
    recurrences: number;
  };
};

export function useDashboardData() {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId;
  const query = useQuery({
    queryKey: queryKeys.organization.dashboard(organizationId ?? 'inactive'),
    queryFn: ({ signal }) => auth.request<DashboardData>('/dashboard', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  return { ...query, activeId: organizationId };
}
