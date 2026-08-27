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

export type CommandCenterAttentionPrimaryState =
  | 'actionable-work'
  | 'configuration-guidance'
  | 'configuration-loading'
  | 'configuration-unavailable'
  | 'queue-unavailable'
  | 'operational-empty';

export function resolveCommandCenterAttentionPresentation({
  configurationState,
  queueStatus,
  actionableWorkCount,
}: {
  configurationState: CommandCenterConfigurationState;
  queueStatus: 'pending' | 'error' | 'success';
  actionableWorkCount: number;
}) {
  const hasActionableWork = queueStatus === 'success' && actionableWorkCount > 0;
  const showConfigurationRecommendation = configurationState === 'not-yet-configured';

  let primary: CommandCenterAttentionPrimaryState;
  if (hasActionableWork) primary = 'actionable-work';
  else if (queueStatus === 'error') primary = 'queue-unavailable';
  else if (configurationState === 'not-yet-configured') primary = 'configuration-guidance';
  else if (configurationState === 'loading') primary = 'configuration-loading';
  else if (configurationState === 'unavailable') primary = 'configuration-unavailable';
  else primary = 'operational-empty';

  return {
    primary,
    showConfigurationRecommendation:
      primary === 'actionable-work' && showConfigurationRecommendation,
  };
}
