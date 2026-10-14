import {
  createEmptyNaturalLanguageAdditionBetaState,
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/stt-beta/beta-storage';
import { autoAssignPort } from './auto-assign';

jest.mock('@/features/shopping-list/stt-beta/beta-storage', () => ({
  ...jest.requireActual('@/features/shopping-list/stt-beta/beta-storage'),
  getNaturalLanguageAdditionBetaState: jest.fn(),
  saveNaturalLanguageAdditionBetaState: jest.fn(),
}));

const mockGetNaturalLanguageAdditionBetaState = jest.mocked(getNaturalLanguageAdditionBetaState);
const mockSaveNaturalLanguageAdditionBetaState = jest.mocked(saveNaturalLanguageAdditionBetaState);

describe('autoAssignPort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the automatic assignment setting', async () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();
    mockGetNaturalLanguageAdditionBetaState.mockResolvedValue({
      ...state,
      autoAssign: 'on',
    });

    await expect(autoAssignPort.get('user-1')).resolves.toBe('on');
  });

  it('saves the selected setting while preserving the rest of the beta state', async () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();
    mockGetNaturalLanguageAdditionBetaState.mockResolvedValue(state);

    await autoAssignPort.set('user-1', 'off');

    expect(mockSaveNaturalLanguageAdditionBetaState).toHaveBeenCalledWith('user-1', {
      ...state,
      autoAssign: 'off',
    });
  });
});
