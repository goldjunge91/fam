import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { Store } from '../../hooks/use-stores';
import { saveConfirmedBetaOutput } from '../integration/confirmed-output-adapter';
import type { BetaStorageState, NaturalLanguageAdditionInput, SpeechInputResult } from '../types';
import type { TextBetaPreview, TextBetaSelection } from '../workflow/text-workflow';
import { NaturalLanguageAdditionController } from './natural-language-addition-controller';

const mockParams: { action?: string } = { action: 'preview' };
const mockSetParams = jest.fn();
const mockLoadBetaState = jest.fn<Promise<BetaStorageState>, [string]>();
const mockSaveBetaState = jest.fn<Promise<void>, [string, BetaStorageState]>();
const mockAlert = jest.fn();

const emptyBetaState: BetaStorageState = {
  version: 1,
  session: null,
  learningRules: [],
  confirmations: [],
  conflicts: [],
  clarifications: [],
  consent: {
    qualityMetrics: 'undecided',
    contentData: 'undecided',
    automaticApplication: 'undecided',
  },
  feedback: [],
  qualityMetrics: {
    confirmedItemCount: 0,
    automaticAssignmentCount: 0,
    correctAutomaticAssignmentCount: 0,
    falseListAssignmentCount: 0,
    manualCorrectionCount: 0,
    completionDurationsMs: [],
    recordedObservationIds: [],
    measuredSessionIds: [],
  },
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    const { useEffect } = require('react') as typeof import('react');
    useEffect(effect, []);
  },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/lib/db/client', () => ({ getDatabase: jest.fn() }));

jest.mock('../integration/confirmed-output-adapter', () => ({
  saveConfirmedBetaOutput: jest.fn(async (input: { output: { items: readonly unknown[] } }) => ({
    savedItemCount: input.output.items.length,
    mutationCount: input.output.items.length,
    itemIds: input.output.items.map((_, index) => `item-${index}`),
  })),
}));

jest.mock('@/lib/observability/debug-log', () => ({ debugLogEvent: jest.fn() }));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'session-1') }));

jest.mock('../beta-storage', () => ({
  getNaturalLanguageAdditionBetaState: (userId: string) => mockLoadBetaState(userId),
  saveNaturalLanguageAdditionBetaState: (userId: string, state: BetaStorageState) =>
    mockSaveBetaState(userId, state),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('./natural-language-addition-voice-overlay', () => ({
  NaturalLanguageAdditionVoiceOverlay: (props: {
    visible: boolean;
    onFallback: (result: Exclude<SpeechInputResult, { status: 'transcript' }>) => void;
    onTranscript: (input: NaturalLanguageAdditionInput) => void | Promise<void>;
  }) => {
    const { Pressable, View } = require('react-native') as typeof import('react-native');
    return props.visible ? (
      <View testID="mock-voice-overlay">
        <Pressable
          testID="mock-voice-error"
          onPress={() =>
            props.onFallback({
              status: 'error',
              text: null,
              locale: 'de-DE',
              onDevice: false,
              error: 'Mikrofon nicht verfügbar',
              errorCode: 'speech-recognition-unavailable',
            })
          }
        />
        <Pressable
          testID="mock-voice-transcript"
          onPress={() =>
            void props.onTranscript({
              source: 'speech',
              text: '3 Äpfel und Brot',
              locale: 'de-DE',
              onDevice: true,
            })
          }
        />
      </View>
    ) : null;
  },
}));

jest.mock('./natural-language-addition-swift-ui-preview', () => {
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = require('react-native') as typeof import('react-native');

  type MockPreviewProps = {
    visible: boolean;
    preview?: TextBetaPreview;
    onDismiss?: () => void;
    onRequestClose?: () => void;
    onConfirm?: (selections: readonly TextBetaSelection[]) => void;
  };

  return {
    NaturalLanguageAdditionSwiftUIPreview: ({
      visible,
      preview,
      onDismiss,
      onRequestClose,
      onConfirm,
    }: MockPreviewProps) => (
      <MockView testID="mock-preview">
        <MockText>{visible ? 'presented' : 'dismissed'}</MockText>
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Schließen"
          onPress={onRequestClose ?? onDismiss}>
          <MockText>Schließen</MockText>
        </MockPressable>
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Bestätigen"
          onPress={() =>
            onConfirm?.(
              preview?.items.map((item) => ({
                itemId: item.itemId,
                targetListId: 'store-1',
              })) ?? [],
            )
          }>
          <MockText>Bestätigen</MockText>
        </MockPressable>
        {preview?.items.map((item) => (
          <MockText key={item.itemId}>{item.item.name}</MockText>
        ))}
      </MockView>
    ),
  };
});

const stores: readonly Store[] = [
  {
    id: 'store-1',
    household_id: 'household-1',
    name: 'REWE',
    color: '#000000',
    sort_order: 0,
    category_order: null,
  },
];

describe('NaturalLanguageAdditionController', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation((...args) => {
      mockAlert(...args);
    });
    mockParams.action = 'preview';
    mockSetParams.mockReset();
    mockLoadBetaState.mockReset().mockResolvedValue(emptyBetaState);
    mockSaveBetaState.mockReset().mockResolvedValue(undefined);
    mockAlert.mockReset();
    jest.mocked(saveConfirmedBetaOutput).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the preview mounted while the native sheet dismisses', async () => {
    const user = userEvent.setup();

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);

    await waitFor(() => {
      expect(screen.getByText('presented')).toBeOnTheScreen();
    });

    await user.press(screen.getByRole('button', { name: 'Schließen' }));

    expect(screen.getByText('dismissed')).toBeOnTheScreen();
  });

  it('asks for automatic application only after crossing the learning threshold', async () => {
    const thresholdState: BetaStorageState = {
      ...emptyBetaState,
      confirmations: Array.from({ length: 9 }, (_, index) => ({
        id: `confirmation-${index}`,
        sessionId: `session-${index}`,
        itemName: `Artikel ${index}`,
        brand: `Marke ${index}`,
        targetListId: 'store-1',
        result: 'confirmed' as const,
        createdAt: '2026-09-18T12:00:00.000Z',
      })),
    };
    let state = thresholdState;
    mockLoadBetaState.mockImplementation(async () => state);
    mockSaveBetaState.mockImplementation(async (_userId, nextState) => {
      state = nextState;
    });

    const user = userEvent.setup();
    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await waitFor(() => {
      expect(screen.getByText('presented')).toBeOnTheScreen();
    });

    await user.press(screen.getByRole('button', { name: 'Bestätigen' }));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Automatische Zuordnung',
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Nicht jetzt' }),
          expect.objectContaining({ text: 'Erlauben' }),
        ]),
      );
    });
    expect(state.consent.automaticApplication).toBe('undecided');
  });

  it('does not create a manual input surface after a speech error', async () => {
    const user = userEvent.setup();
    mockParams.action = 'voice';

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);

    await user.press(await screen.findByTestId('mock-voice-error'));

    expect(screen.queryByTestId('mock-voice-overlay')).toBeNull();
    expect(mockAlert).toHaveBeenCalledWith(
      'Spracheingabe fehlgeschlagen',
      'Mikrofon nicht verfügbar',
    );
  });

  it('sends a speech transcript through the existing preview and confirmation path', async () => {
    const user = userEvent.setup();
    let state = emptyBetaState;
    mockLoadBetaState.mockImplementation(async () => state);
    mockSaveBetaState.mockImplementation(async (_userId, nextState) => {
      state = nextState;
    });
    mockParams.action = 'voice';

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);

    await user.press(await screen.findByTestId('mock-voice-transcript'));

    await waitFor(() => {
      expect(screen.getByText('Äpfel')).toBeOnTheScreen();
      expect(screen.getByText('Brot')).toBeOnTheScreen();
    });

    await user.press(screen.getByRole('button', { name: 'Bestätigen' }));

    await waitFor(() => {
      expect(saveConfirmedBetaOutput).toHaveBeenCalledTimes(1);
    });
  });
});
