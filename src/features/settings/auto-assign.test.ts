import {
  createEmptyNaturalLanguageAdditionBetaState,
  getNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/stt-beta/beta-storage';
import { autoAssignPort } from './auto-assign';

jest.mock('@/features/shopping-list/stt-beta/beta-storage', () => ({
  ...jest.requireActual('@/features/shopping-list/stt-beta/beta-storage'),
  getNaturalLanguageAdditionBetaState: jest.fn(),
  saveNaturalLanguageAdditionBetaState: jest.fn(),
}));

const mockGetNaturalLanguageAdditionBetaState = jest.mocked(getNaturalLanguageAdditionBetaState);

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
});
