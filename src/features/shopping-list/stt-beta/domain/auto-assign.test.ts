import { createEmptyNaturalLanguageAdditionBetaState } from '../beta-storage';
import { canAutoAssign, setAutoAssign, shouldAskForAutoAssign } from './auto-assign';

describe('automatic list assignment', () => {
  it('asks only after the learning threshold when no choice has been saved', () => {
    expect(
      shouldAskForAutoAssign({
        progress: { uniqueAssignments: 10, thresholdReached: true },
        autoAssign: 'unset',
      }),
    ).toBe(true);
    expect(
      shouldAskForAutoAssign({
        progress: { uniqueAssignments: 9, thresholdReached: false },
        autoAssign: 'unset',
      }),
    ).toBe(false);
    expect(
      shouldAskForAutoAssign({
        progress: { uniqueAssignments: 10, thresholdReached: true },
        autoAssign: 'on',
      }),
    ).toBe(false);
  });

  it('enables assignment only when the saved preference is on', () => {
    expect(canAutoAssign('on')).toBe(true);
    expect(canAutoAssign('off')).toBe(false);
    expect(canAutoAssign('unset')).toBe(false);
  });

  it('updates the preference without changing the rest of the stored state', () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();

    expect(setAutoAssign(state, 'off')).toEqual({ ...state, autoAssign: 'off' });
    expect(state.autoAssign).toBe('unset');
  });
});
