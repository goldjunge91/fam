import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { Store } from '../../hooks/use-stores';
import type { BetaStorageState, NaturalLanguageAdditionInput } from '../types';
import type { TextBetaPreview } from '../workflow/text-workflow';
import { NaturalLanguageAdditionController } from './stt-controller';

jest.spyOn(Alert, 'alert');

let mockParams: { action?: string } = {};
let mockSpeechEnabled = true;
let mockUserId: string | undefined = 'user-1';
const mockSetParams = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockGetBetaState = jest.fn<Promise<BetaStorageState>, [string]>();
const mockSaveBetaState = jest.fn<Promise<void>, [string, BetaStorageState]>();
const mockGetNameCorrections = jest.fn();
const mockUpdateNameCorrection = jest.fn();
const mockCreateBetaPreview = jest.fn();
const mockCorrectBetaPreviewItem = jest.fn();
const mockConfirmTextBetaItems = jest.fn();
const mockSaveConfirmedBetaOutput = jest.fn();
const mockGetDatabase = jest.fn();
const mockDebugLogEvent = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));

jest.mock('@/features/settings/use-feature-access', () => ({
  useFeatureAccess: () => ({
    isFeatureEnabled: (feature: string) => feature !== 'shoppingStt' || mockSpeechEnabled,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'item-1' }));

jest.mock('@/lib/db/local-client', () => ({ getDatabase: () => mockGetDatabase() }));
jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: (event: string, details?: Record<string, unknown>) =>
    details === undefined ? mockDebugLogEvent(event) : mockDebugLogEvent(event, details),
}));
jest.mock('../beta-storage', () => ({
  getNaturalLanguageAdditionBetaState: (userId: string) => mockGetBetaState(userId),
  saveNaturalLanguageAdditionBetaState: (userId: string, state: BetaStorageState) =>
    mockSaveBetaState(userId, state),
}));
jest.mock('../name-corrections', () => ({
  getNameCorrections: (userId: string) => mockGetNameCorrections(userId),
  updateNameCorrection: (userId: string, original: string, corrected: string | null) =>
    mockUpdateNameCorrection(userId, original, corrected),
}));
jest.mock('../integration/confirmed-output-adapter', () => ({
  saveConfirmedBetaOutput: (input: Parameters<typeof mockSaveConfirmedBetaOutput>[0]) =>
    mockSaveConfirmedBetaOutput(input),
}));
jest.mock('../workflow/text-workflow', () => ({
  createBetaPreview: (input: import('../workflow/text-workflow').CreateBetaPreviewInput) =>
    mockCreateBetaPreview(input),
  correctBetaPreviewItem: (
    input: Parameters<typeof import('../workflow/text-workflow').correctBetaPreviewItem>[0],
  ) => mockCorrectBetaPreviewItem(input),
  confirmTextBetaItems: (input: import('../workflow/text-workflow').ConfirmTextBetaItemsInput) =>
    mockConfirmTextBetaItems(input),
}));

jest.mock('./stt-overlay', () => {
  const React = require('react');
  const { Pressable: MockPressable, Text: MockText, View: MockView } = require('react-native');

  return {
    NaturalLanguageAdditionVoiceOverlay: ({
      visible,
      onCancel,
      onTranscript,
      onFallback,
    }: {
      visible: boolean;
      onCancel: () => void;
      onTranscript: (input: NaturalLanguageAdditionInput) => void;
      onFallback: (result: {
        status: 'permission-denied';
        text: null;
        locale: string;
        onDevice: false;
        error: string;
      }) => void;
    }) =>
      visible
        ? React.createElement(
            MockView,
            null,
            React.createElement(
              MockPressable,
              { onPress: () => onTranscript({ source: 'text', text: 'Brot', locale: null }) },
              React.createElement(MockText, null, 'Transkript übernehmen'),
            ),
            React.createElement(
              MockPressable,
              {
                onPress: () =>
                  onFallback({
                    status: 'permission-denied',
                    text: null,
                    locale: 'de-DE',
                    onDevice: false,
                    error: 'Mikrofonzugriff fehlt',
                  }),
              },
              React.createElement(MockText, null, 'Aufnahmefehler'),
            ),
            React.createElement(
              MockPressable,
              { onPress: onCancel },
              React.createElement(MockText, null, 'Aufnahme abbrechen'),
            ),
          )
        : null,
  };
});

jest.mock('./stt-ui-preview', () => {
  const React = require('react');
  const { Pressable: MockPressable, Text: MockText, View: MockView } = require('react-native');

  return {
    NaturalLanguageAdditionSwiftUIPreview: ({
      visible,
      preview,
      onRequestClose,
      onDismiss,
      onEditText,
      onConfirm,
      onCorrectName,
      onForgetCorrection,
    }: {
      visible: boolean;
      preview: TextBetaPreview;
      onRequestClose: () => void;
      onDismiss: () => void;
      onEditText: (text: string) => void;
      onConfirm: (selections: readonly { itemId: string; targetListId: string }[]) => void;
      onCorrectName: (itemId: string, name: string, remember: boolean) => void;
      onForgetCorrection: (original: string) => void;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        visible
          ? React.createElement(
              MockView,
              null,
              React.createElement(MockText, null, `Vorschau: ${preview.input.text}`),
              React.createElement(
                MockPressable,
                { onPress: () => onEditText('Brot ohne Salz') },
                React.createElement(MockText, null, 'Neu prüfen'),
              ),
              React.createElement(
                MockPressable,
                { onPress: () => onCorrectName('session-1:item:0', 'Brot', false) },
                React.createElement(MockText, null, 'Einmal korrigieren'),
              ),
              React.createElement(
                MockPressable,
                { onPress: () => onCorrectName('session-1:item:0', 'Brot', true) },
                React.createElement(MockText, null, 'Korrektur merken'),
              ),
              React.createElement(
                MockPressable,
                { onPress: () => onCorrectName('missing-item', 'Brot', true) },
                React.createElement(MockText, null, 'Unbekannten Artikel korrigieren'),
              ),
              React.createElement(
                MockPressable,
                { onPress: () => onForgetCorrection('Äpfel') },
                React.createElement(MockText, null, 'Korrektur vergessen'),
              ),
              React.createElement(
                MockPressable,
                {
                  onPress: () =>
                    onConfirm([{ itemId: 'session-1:item:0', targetListId: 'store-1' }]),
                },
                React.createElement(MockText, null, 'Hinzufügen bestätigen'),
              ),
              React.createElement(
                MockPressable,
                { onPress: onRequestClose },
                React.createElement(MockText, null, 'Vorschau schließen'),
              ),
            )
          : null,
        React.createElement(
          MockPressable,
          { onPress: onDismiss },
          React.createElement(MockText, null, 'Vorschau entfernt'),
        ),
      ),
  };
});

const betaState: BetaStorageState = {
  version: 1,
  session: {
    id: 'session-1',
    source: 'text',
    startedAt: '2026-10-30T10:00:00.000Z',
  },
  learningRules: [],
  confirmations: [],
  autoAssign: 'unset',
};

const preview: TextBetaPreview = {
  session: {
    id: 'session-1',
    source: 'text',
    startedAt: '2026-10-30T10:00:00.000Z',
  },
  input: { source: 'text', text: 'Äpfel', locale: null },
  parseResult: {
    items: [{ name: 'Äpfel', quantity: 2, unit: null, brand: null }],
    unparsedText: null,
  },
  items: [
    {
      itemId: 'session-1:item:0',
      originalName: 'Äpfel',
      item: { name: 'Äpfel', quantity: 2, unit: null, brand: null },
      routing: {
        kind: 'uncertain',
        item: { name: 'Äpfel', quantity: 2, unit: null, brand: null },
        listId: null,
        confidence: 0.5,
        bestMatch: { listId: 'store-1', listName: 'Markt 1', confidence: 0.5 },
        suggestions: [{ listId: 'store-1', listName: 'Markt 1', confidence: 0.5 }],
        needsClarification: true,
      },
      reviewState: 'pending',
    },
  ],
  learningProgress: { uniqueAssignments: 0, thresholdReached: false },
};

const stores: Store[] = [
  {
    id: 'store-1',
    household_id: 'household-1',
    name: 'Markt 1',
    color: 'plum',
    sort_order: 0,
    category_order: null,
  },
];

describe('NaturalLanguageAdditionController', () => {
  beforeEach(() => {
    mockParams = {};
    mockSpeechEnabled = true;
    mockUserId = 'user-1';
    mockSetParams.mockClear();
    mockInvalidateQueries.mockReset().mockResolvedValue(undefined);
    mockGetBetaState.mockReset().mockResolvedValue(betaState);
    mockSaveBetaState.mockReset().mockResolvedValue(undefined);
    mockGetNameCorrections.mockReset().mockResolvedValue([]);
    mockUpdateNameCorrection
      .mockReset()
      .mockResolvedValue([{ original: 'Äpfel', corrected: 'Brot' }]);
    mockCreateBetaPreview.mockReset().mockImplementation(async ({ input }) => ({
      ...preview,
      input,
      session: { ...preview.session, source: input.source },
    }));
    mockCorrectBetaPreviewItem.mockReset().mockImplementation(({ preview: current }) => current);
    mockConfirmTextBetaItems.mockReset().mockResolvedValue({ shouldAskForAutoAssign: false });
    mockSaveConfirmedBetaOutput.mockReset().mockResolvedValue({
      savedItemCount: 1,
      mutationCount: 1,
      itemIds: ['item-1'],
    });
    mockGetDatabase.mockReset().mockResolvedValue({});
    mockDebugLogEvent.mockClear();
    jest.mocked(Alert.alert).mockClear();
  });

  it('clears a pending voice action and keeps speech closed when the feature is disabled', async () => {
    mockParams = { action: 'voice' };
    mockSpeechEnabled = false;

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={[]} />);

    expect(screen.queryByText('Transkript übernehmen')).not.toBeOnTheScreen();
    expect(mockSetParams).toHaveBeenCalledWith({ action: undefined });
  });

  it('opens speech from the voice route action and clears the consumed action', async () => {
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={[]} />);

    expect(screen.getByText('Transkript übernehmen')).toBeOnTheScreen();
    expect(mockSetParams).toHaveBeenCalledWith({ action: undefined });
    expect(mockDebugLogEvent).toHaveBeenCalledWith('shopping-list.voice-action.received');
  });

  it('explains that a store is needed when a transcript arrives before any stores exist', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={[]} />);
    await user.press(screen.getByText('Transkript übernehmen'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Spracheingabe nicht verfügbar',
      'Lege zuerst einen Markt für die Einkaufsliste an.',
    );
    expect(screen.queryByText('Transkript übernehmen')).not.toBeOnTheScreen();
  });

  it('shows a preview from transcript input and forwards the route and telemetry data', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));

    expect(await screen.findByText('Vorschau: Brot')).toBeOnTheScreen();
    expect(mockCreateBetaPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        betaSessionId: 'item-1',
        lists: [{ listId: 'store-1', listName: 'Markt 1', knownBrands: [] }],
        input: { source: 'text', text: 'Brot', locale: null },
      }),
    );
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'shopping-list.voice-preview.ready',
      expect.objectContaining({ itemCount: 1, source: 'text' }),
    );
  });

  it('reports preview errors and falls back to stringifying non-Error values', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockCreateBetaPreview.mockRejectedValueOnce({ code: 'offline' });

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));

    expect(Alert.alert).toHaveBeenCalledWith('Spracheingabe fehlgeschlagen', '[object Object]');
    expect(screen.queryByText('Transkript übernehmen')).not.toBeOnTheScreen();
  });

  it('uses the error message when preview creation rejects with an Error', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockCreateBetaPreview.mockRejectedValueOnce(new Error('Parser unavailable'));

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));

    expect(Alert.alert).toHaveBeenCalledWith('Spracheingabe fehlgeschlagen', 'Parser unavailable');
  });

  it('sends speech fallback errors to the alert and closes the recording overlay', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Aufnahmefehler'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Spracheingabe fehlgeschlagen',
      'Mikrofonzugriff fehlt',
    );
    expect(screen.queryByText('Transkript übernehmen')).not.toBeOnTheScreen();
  });

  it('closes the recording overlay and clears a pending voice route action', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Aufnahme abbrechen'));

    expect(screen.queryByText('Transkript übernehmen')).not.toBeOnTheScreen();
    expect(mockSetParams).toHaveBeenCalledWith({ action: undefined });
  });

  it('rechecks edited text and applies a one-off correction without saving it', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Neu prüfen'));

    expect(await screen.findByText('Vorschau: Brot ohne Salz')).toBeOnTheScreen();
    expect(mockCreateBetaPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ input: { source: 'text', text: 'Brot ohne Salz', locale: null } }),
    );

    await user.press(screen.getByText('Einmal korrigieren'));
    expect(mockCorrectBetaPreviewItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'session-1:item:0',
        name: 'Brot',
        lists: expect.any(Array),
      }),
    );
    expect(mockUpdateNameCorrection).not.toHaveBeenCalled();
  });

  it('remembers a name correction and forgets an existing correction', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Korrektur merken'));
    await user.press(screen.getByText('Korrektur vergessen'));

    expect(mockUpdateNameCorrection).toHaveBeenNthCalledWith(1, 'user-1', 'Äpfel', 'Brot');
    expect(mockUpdateNameCorrection).toHaveBeenNthCalledWith(2, 'user-1', 'Äpfel', null);
    expect(mockSaveBetaState).not.toHaveBeenCalled();
  });

  it('reports failures while saving or forgetting a remembered correction', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockUpdateNameCorrection.mockRejectedValue(new Error('correction storage unavailable'));

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Korrektur merken'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Korrektur fehlgeschlagen',
      'correction storage unavailable',
    );

    await user.press(screen.getByText('Korrektur vergessen'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Löschen fehlgeschlagen',
      'correction storage unavailable',
    );
  });

  it('reports edit failures and prevents correction when loading saved state fails', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockCreateBetaPreview
      .mockResolvedValueOnce({ ...preview, input: { source: 'text', text: 'Brot', locale: null } })
      .mockRejectedValueOnce(new Error('recheck unavailable'));

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Neu prüfen'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Artikel konnten nicht neu geprüft werden',
      'recheck unavailable',
    );

    mockGetBetaState.mockRejectedValueOnce(new Error('state unavailable'));
    await user.press(screen.getByText('Einmal korrigieren'));
    expect(Alert.alert).toHaveBeenCalledWith('Korrektur fehlgeschlagen', 'state unavailable');
  });

  it('closes a preview and completes dismissal by clearing its route action', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Vorschau schließen'));
    expect(screen.queryByText('Vorschau: Brot')).not.toBeOnTheScreen();

    // The native sheet can finish its dismissal after the close request.
    await fireEvent.press(screen.getByText('Vorschau entfernt'));
    expect(mockSetParams).toHaveBeenCalledWith({ action: undefined });
  });

  it('refreshes a preview when its shopping lists change before confirmation', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    const view = await render(
      <NaturalLanguageAdditionController householdId="household-1" stores={stores} />,
    );
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await view.rerender(
      <NaturalLanguageAdditionController
        householdId="household-1"
        stores={[
          ...stores,
          {
            id: 'store-2',
            household_id: 'household-1',
            name: 'Markt 2',
            color: 'sage',
            sort_order: 1,
            category_order: null,
          },
        ]}
      />,
    );
    await user.press(screen.getByText('Hinzufügen bestätigen'));

    expect(mockCreateBetaPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lists: expect.arrayContaining([
          { listId: 'store-2', listName: 'Markt 2', knownBrands: [] },
        ]),
      }),
    );
    expect(mockCorrectBetaPreviewItem).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Einkaufslisten aktualisiert',
      'Die verfügbaren Märkte haben sich geändert. Bitte prüfe die Zuordnung erneut.',
    );
    expect(mockConfirmTextBetaItems).not.toHaveBeenCalled();
  });

  it('confirms selected items, invalidates related queries, and asks about automatic assignment', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockConfirmTextBetaItems.mockImplementationOnce(async ({ saveConfirmedOutput }) => {
      await saveConfirmedOutput({
        betaSessionId: 'session-1',
        source: 'text',
        items: [
          {
            confirmation: 'confirmed',
            item: { name: 'Brot', quantity: 1, unit: null, brand: null },
            targetListId: 'store-1',
          },
        ],
      });
      return { shouldAskForAutoAssign: true };
    });

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));

    expect(mockConfirmTextBetaItems).toHaveBeenCalledWith(
      expect.objectContaining({
        selections: [{ itemId: 'session-1:item:0', targetListId: 'store-1' }],
        availableTargetListIds: ['store-1'],
        saveConfirmedOutput: expect.any(Function),
      }),
    );
    expect(mockGetDatabase).toHaveBeenCalledTimes(1);
    expect(mockSaveConfirmedBetaOutput).toHaveBeenCalledWith({
      db: {},
      householdId: 'household-1',
      output: expect.objectContaining({ betaSessionId: 'session-1', source: 'text' }),
      createItemId: expect.any(Function),
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['shopping_list_items', 'household-1'],
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['meal-plan-shopping-needs'],
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['recipe-shopping-needs'],
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(4, {
      queryKey: ['sync-status'],
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Intelligente Zuordnung',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Später', style: 'cancel' }),
        expect.objectContaining({ text: 'Aktivieren' }),
      ]),
    );
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'shopping-list.voice-confirmation.saved',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it('reports cache invalidation failures after the items are already saved', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockInvalidateQueries.mockRejectedValue(new Error('cache unavailable'));

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));

    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'shopping-list.natural-language-addition.cache-invalidation-failed',
      { hasError: true },
    );
  });

  it('does not show auto-assignment preferences when storage loading fails or it is already set', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockConfirmTextBetaItems.mockResolvedValue({ shouldAskForAutoAssign: true });
    mockGetBetaState.mockRejectedValueOnce(new Error('storage offline'));

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Intelligente Zuordnung',
      expect.any(String),
      expect.any(Array),
    );

    mockGetBetaState.mockResolvedValueOnce({ ...betaState, autoAssign: 'on' });
    mockParams = { action: 'voice' };
    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Intelligente Zuordnung',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('reports an error from the preview confirmation workflow', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockConfirmTextBetaItems.mockRejectedValueOnce(new Error('confirmation unavailable'));

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Artikel konnten nicht hinzugefügt werden',
      'confirmation unavailable',
    );
  });

  it('saves the opt-out when asked later and tolerates a storage write failure', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockSaveBetaState.mockRejectedValueOnce(new Error('storage unavailable'));
    mockConfirmTextBetaItems.mockResolvedValueOnce({ shouldAskForAutoAssign: true });

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));
    const alertButtons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    alertButtons?.[0]?.onPress?.();

    expect(mockSaveBetaState).toHaveBeenCalledWith('user-1', { ...betaState, autoAssign: 'off' });
  });

  it('reports confirmation failures and keeps the preview available for correction', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };
    mockGetDatabase.mockRejectedValueOnce(new Error('database unavailable'));

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Artikel konnten nicht hinzugefügt werden',
      'database unavailable',
    );
    expect(screen.getByText('Vorschau: Brot')).toBeOnTheScreen();
  });

  it('does not start confirmation without a household or when there is no signed-in user', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId={undefined} stores={stores} />);
    await user.press(screen.getByText('Transkript übernehmen'));
    await screen.findByText('Vorschau: Brot');
    await user.press(screen.getByText('Hinzufügen bestätigen'));

    expect(mockConfirmTextBetaItems).not.toHaveBeenCalled();

    mockUserId = undefined;
    mockParams = {};
    await render(<NaturalLanguageAdditionController householdId="household-1" stores={stores} />);
    expect(mockGetBetaState).not.toHaveBeenCalled();
  });
});
