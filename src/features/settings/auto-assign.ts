import {
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/stt-beta/beta-storage';
import { setAutoAssign } from '@/features/shopping-list/stt-beta/domain/auto-assign';
import type { AutoAssignState } from '@/features/shopping-list/stt-beta/types';

export type AutoAssignValue = AutoAssignState;

export type AutoAssignPort = {
  get: (userId: string) => Promise<AutoAssignValue>;
  set: (userId: string, value: Exclude<AutoAssignValue, 'unset'>) => Promise<void>;
};

export const autoAssignPort: AutoAssignPort = {
  get: async (userId) => {
    const state = await getNaturalLanguageAdditionBetaState(userId);
    return state.autoAssign;
  },
  set: async (userId, value) => {
    const state = await getNaturalLanguageAdditionBetaState(userId);
    await saveNaturalLanguageAdditionBetaState(userId, setAutoAssign(state, value));
  },
};
