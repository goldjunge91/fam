import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { DevToolsScreen } from './dev-tools-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestMicrophonePermissionsAsync: jest.fn(),
  },
}));

jest.mock('@/components/layout/screen', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockProps = { children: ReactNode; title?: string };

  return {
    Screen: ({ children, title }: MockProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/features/settings/settings-menu', () => {
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual('react-native') as typeof import('react-native');
  type MockGroupProps = { children: ReactNode; title?: string };
  type MockRowProps = { label: string; onPress?: () => void };

  return {
    SettingsGroup: ({ children, title }: MockGroupProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {children}
      </MockView>
    ),
    SettingsRow: ({ label, onPress }: MockRowProps) => (
      <MockPressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress}>
        <MockText>{label}</MockText>
      </MockPressable>
    ),
  };
});

describe('DevToolsScreen', () => {
  it('öffnet die Shopping-List-Preview', async () => {
    const user = userEvent.setup();
    await render(<DevToolsScreen />);

    await user.press(screen.getByRole('button', { name: 'Shopping-List-Preview öffnen' }));

    expect(router.push).toHaveBeenCalledWith('/shopping-list?action=preview');
  });

  it('öffnet die lokale Qualitätsmetriken-Ansicht', async () => {
    const user = userEvent.setup();
    await render(<DevToolsScreen />);

    await user.press(screen.getByRole('button', { name: 'Qualitätsmetriken' }));

    expect(router.push).toHaveBeenCalledWith('/settings/dev-quality-metrics');
  });
});
