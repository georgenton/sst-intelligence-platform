import type { QueryClient } from '@tanstack/react-query';

const privateQueryRoot = ['private'] as const;

type OrganizationReconciliation = {
  action: 'initialize' | 'preserve' | 'transition';
  organizationId: string | null;
};

export function planOrganizationReconciliation(input: {
  contextUserId: string | null;
  authenticatedUserId: string;
  activeOrganizationId: string | null;
  validOrganizationIds: readonly string[];
  initialOrganizationId: string | null;
}): OrganizationReconciliation {
  if (input.contextUserId !== input.authenticatedUserId) {
    return { action: 'initialize', organizationId: input.initialOrganizationId };
  }
  if (
    input.activeOrganizationId &&
    input.validOrganizationIds.includes(input.activeOrganizationId)
  ) {
    return { action: 'preserve', organizationId: input.activeOrganizationId };
  }
  const fallbackOrganizationId = input.validOrganizationIds[0] ?? null;
  return {
    action: input.activeOrganizationId === fallbackOrganizationId ? 'preserve' : 'transition',
    organizationId: fallbackOrganizationId,
  };
}

function organizationQueryRoot(organizationId: string) {
  return ['private', 'org', organizationId] as const;
}

export async function removeOrganizationPrivateQueries(
  queryClient: QueryClient,
  organizationId: string,
) {
  const queryKey = organizationQueryRoot(organizationId);
  await queryClient.cancelQueries({ queryKey });
  queryClient.removeQueries({ queryKey });
}

export async function removeAllPrivateQueries(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: privateQueryRoot });
  queryClient.removeQueries({ queryKey: privateQueryRoot });
}

export async function isolateOrganizationTransition(
  queryClient: QueryClient,
  previousOrganizationId: string | null,
  nextOrganizationId: string | null,
  commitContext: () => void,
) {
  if (previousOrganizationId === nextOrganizationId) return;
  if (previousOrganizationId) {
    await queryClient.cancelQueries({
      queryKey: organizationQueryRoot(previousOrganizationId),
    });
  }
  commitContext();
  if (previousOrganizationId) {
    queryClient.removeQueries({
      queryKey: organizationQueryRoot(previousOrganizationId),
    });
  }
}
