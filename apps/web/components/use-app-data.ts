'use client';

import { useQuery } from '@tanstack/react-query';
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
};

export function useDashboardData() {
  const auth = useAuth();
  const organization = useOrganization();
  const query = useQuery({
    queryKey: ['dashboard', organization.activeId],
    queryFn: () => auth.request<DashboardData>('/dashboard', {}, organization.activeId!),
    enabled: Boolean(organization.activeId),
  });
  return { ...query, activeId: organization.activeId };
}
