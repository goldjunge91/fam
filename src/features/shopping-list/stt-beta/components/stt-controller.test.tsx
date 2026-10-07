import { render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { NaturalLanguageAdditionController } from './stt-controller';

jest.spyOn(Alert, 'alert');

let mockParams: { action?: string } = {};
let mockSpeechEnabled = true;
const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/use-feature-access', () => ({
  useFeatureAccess: () => ({
    isFeatureEnabled: (feature: string) => feature !== 'shoppingStt' || mockSpeechEnabled,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'session-1' }));

jest.mock('./stt-overlay', () => ({
  NaturalLanguageAdditionVoiceOverlay: ({
    visible,
    onTranscript,
  }: {
    visible: boolean;
    onTranscript: (input: { source: 'text'; text: string; locale: null }) => void;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return visible
      ? React.createElement(
          Pressable,
          { onPress: () => onTranscript({ source: 'text', text: 'Brot', locale: null }) },
          React.createElement(Text, null, 'Sprachaufnahme geöffnet'),
        )
      : null;
  },
}));

jest.mock('./stt-ui-preview', () => ({
  NaturalLanguageAdditionSwiftUIPreview: () => null,
}));

describe('NaturalLanguageAdditionController', () => {
  beforeEach(() => {
    mockParams = {};
    mockSpeechEnabled = true;
    mockSetParams.mockClear();
    jest.mocked(Alert.alert).mockClear();
  });

  it('clears a pending voice action and keeps speech closed when the feature is disabled', async () => {
    mockParams = { action: 'voice' };
    mockSpeechEnabled = false;

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={[]} />);

    expect(screen.queryByText('Sprachaufnahme geöffnet')).not.toBeOnTheScreen();
    expect(mockSetParams).toHaveBeenCalledWith({ action: undefined });
  });

  it('opens speech from the voice route action and clears the consumed action', async () => {
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={[]} />);

    expect(screen.getByText('Sprachaufnahme geöffnet')).toBeOnTheScreen();
    expect(mockSetParams).toHaveBeenCalledWith({ action: undefined });
  });

  it('explains that a store is needed when a transcript arrives before any stores exist', async () => {
    const user = userEvent.setup();
    mockParams = { action: 'voice' };

    await render(<NaturalLanguageAdditionController householdId="household-1" stores={[]} />);
    await user.press(screen.getByText('Sprachaufnahme geöffnet'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Spracheingabe nicht verfügbar',
      'Lege zuerst einen Markt für die Einkaufsliste an.',
    );
  });
});
