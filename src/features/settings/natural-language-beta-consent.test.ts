import {
  createEmptyNaturalLanguageAdditionBetaState,
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage';
import { setBetaConsent } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/consent';
import { naturalLanguageBetaConsentPort } from './natural-language-beta-consent';

jest.mock(
  '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage',
  () => ({
    ...jest.requireActual(
      '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage',
    ),
    getNaturalLanguageAdditionBetaState: jest.fn(),
    saveNaturalLanguageAdditionBetaState: jest.fn(),
  }),
);

jest.mock(
  '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/consent',
  () => ({
    setBetaConsent: jest.fn((state, key, value) => ({
      ...state,
      consent: { ...state.consent, [key]: value },
    })),
  }),
);

const mockGetNaturalLanguageAdditionBetaState = jest.mocked(getNaturalLanguageAdditionBetaState);
const mockSaveNaturalLanguageAdditionBetaState = jest.mocked(saveNaturalLanguageAdditionBetaState);
const mockSetBetaConsent = jest.mocked(setBetaConsent);

describe('naturalLanguageBetaConsentPort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads automatic application without conflating an undecided content consent', async () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();
    mockGetNaturalLanguageAdditionBetaState.mockResolvedValue({
      ...state,
      consent: {
        ...state.consent,
        contentData: 'undecided',
        automaticApplication: 'granted',
      },
    });

    await expect(
      naturalLanguageBetaConsentPort.getAutomaticApplicationConsent('user-1'),
    ).resolves.toBe('granted');
  });

  it('updates only automatic application and preserves content plus feedback data', async () => {
    const state = {
      ...createEmptyNaturalLanguageAdditionBetaState(),
      consent: {
        qualityMetrics: 'granted' as const,
        contentData: 'revoked' as const,
        automaticApplication: 'granted' as const,
      },
      feedback: [
        {
          id: 'feedback-1',
          sessionId: 'session-1',
          kind: 'corrected' as const,
          createdAt: '2026-09-18T12:00:00.000Z',
        },
      ],
    };
    mockGetNaturalLanguageAdditionBetaState.mockResolvedValue(state);

    await naturalLanguageBetaConsentPort.setAutomaticApplicationConsent('user-1', 'revoked');

    expect(mockSetBetaConsent).toHaveBeenCalledWith(state, 'automaticApplication', 'revoked');
    expect(mockSaveNaturalLanguageAdditionBetaState).toHaveBeenCalledWith('user-1', {
      ...state,
      consent: {
        qualityMetrics: 'granted',
        contentData: 'revoked',
        automaticApplication: 'revoked',
      },
    });
  });

  it('keeps quality and content consent independently addressable', async () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();
    mockGetNaturalLanguageAdditionBetaState.mockResolvedValue(state);

    await naturalLanguageBetaConsentPort.setQualityMetricsConsent('user-1', 'granted');

    expect(mockSetBetaConsent).toHaveBeenCalledWith(state, 'qualityMetrics', 'granted');
    expect(mockSetBetaConsent).not.toHaveBeenCalledWith(state, 'contentData', expect.anything());
  });
});
