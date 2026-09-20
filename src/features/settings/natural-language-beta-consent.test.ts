import {
  createEmptyNaturalLanguageAdditionBetaState,
  getNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/stt-beta/beta-storage';
import { naturalLanguageBetaConsentPort } from './natural-language-beta-consent';

jest.mock('@/features/shopping-list/stt-beta/beta-storage', () => ({
  ...jest.requireActual('@/features/shopping-list/stt-beta/beta-storage'),
  getNaturalLanguageAdditionBetaState: jest.fn(),
  saveNaturalLanguageAdditionBetaState: jest.fn(),
}));

const mockGetNaturalLanguageAdditionBetaState = jest.mocked(getNaturalLanguageAdditionBetaState);

describe('naturalLanguageBetaConsentPort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads automatic application consent', async () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();
    mockGetNaturalLanguageAdditionBetaState.mockResolvedValue({
      ...state,
      consent: {
        ...state.consent,
        automaticApplication: 'granted',
      },
    });

    await expect(
      naturalLanguageBetaConsentPort.getAutomaticApplicationConsent('user-1'),
    ).resolves.toBe('granted');
  });
});
