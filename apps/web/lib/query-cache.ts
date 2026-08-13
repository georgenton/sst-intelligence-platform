import type { QueryClient } from '@tanstack/react-query';

const privateQueryRoot = ['private'] as const;

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
  nextOrganizationId: string,
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
