export type AsyncCollectionState =
  'disabled' | 'loading' | 'error' | 'success-empty' | 'success-with-data';

export function resolveAsyncCollectionState({
  enabled,
  status,
  itemCount,
}: {
  enabled: boolean;
  status: 'pending' | 'error' | 'success';
  itemCount: number;
}): AsyncCollectionState {
  if (!enabled) return 'disabled';
  if (status === 'pending') return 'loading';
  if (status === 'error') return 'error';
  return itemCount > 0 ? 'success-with-data' : 'success-empty';
}

export function resolveAttentionState({
  knownAttentionCount,
  sourceStates,
}: {
  knownAttentionCount: number;
  sourceStates: readonly AsyncCollectionState[];
}) {
  const requiredSources = sourceStates.filter((state) => state !== 'disabled');
  const sourcesLoading = requiredSources.some((state) => state === 'loading');
  const sourcesFailed = requiredSources.some((state) => state === 'error');
  const sourcesSettled = requiredSources.every(
    (state) => state === 'success-empty' || state === 'success-with-data',
  );
  const hasKnownAttention = knownAttentionCount > 0;

  return {
    hasKnownAttention,
    sourcesLoading,
    sourcesFailed,
    sourcesSettled,
    showEmpty: sourcesSettled && !hasKnownAttention,
  };
}

export type CommandCenterConfigurationState =
  'loading' | 'unavailable' | 'not-yet-configured' | 'configured';

export function resolveCommandCenterConfigurationState({
  status,
  profileVersionCount,
}: {
  status: 'pending' | 'error' | 'success';
  profileVersionCount: number;
}): CommandCenterConfigurationState {
  if (status === 'pending') return 'loading';
  if (status === 'error') return 'unavailable';
  return profileVersionCount > 0 ? 'configured' : 'not-yet-configured';
}
