import type { AutoAssignState, BetaStorageState } from '../types';
import type { ShoppingLearningProgress } from './routing';

export function shouldAskForAutoAssign(input: {
  progress: ShoppingLearningProgress;
  autoAssign: AutoAssignState;
}): boolean {
  return input.progress.thresholdReached && input.autoAssign === 'unset';
}

export function canAutoAssign(autoAssign: AutoAssignState): boolean {
  return autoAssign === 'on';
}

export function setAutoAssign(state: BetaStorageState, value: AutoAssignState): BetaStorageState {
  return {
    ...state,
    autoAssign: value,
  };
}
