import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { CookingModeVoiceStatus } from './cooking-mode-voice-status';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#957b91',
      backgroundSoft: '#eee',
      backgroundElement: '#fff',
      danger: '#c65e4f',
      warning: '#a8713a',
      success: '#6e8365',
    },
  }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Press: ({
      children,
      onPress,
      accessibilityRole,
      accessibilityLabel,
    }: {
      children: ReactNode;
      onPress: () => void;
      accessibilityRole?: 'button';
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        NativePressable,
        { accessibilityRole, accessibilityLabel, onPress },
        children,
      ),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
  };
});

const callbacks = () => ({
  onReadStep: jest.fn(),
  onReadIngredients: jest.fn(),
  onStopReading: jest.fn(),
  onStartListening: jest.fn(),
  onStopListening: jest.fn(),
  onPauseHandsFree: jest.fn(),
  onResumeHandsFree: jest.fn(),
  onEndHandsFree: jest.fn(),
});

it.each([
  ['ready', 'Voice bereit'],
  ['reading', 'Vorlesen läuft'],
  ['listening', 'Zuhören läuft'],
  ['processing', 'Befehl wird verarbeitet'],
  ['paused', 'Hands-free pausiert'],
  ['denied', 'Mikrofonzugriff verweigert'],
  ['unavailable', 'Voice nicht verfügbar'],
  ['error', 'Voice-Fehler'],
] as const)('shows a visible label for %s', async (status, label) => {
  await render(
    <CookingModeVoiceStatus
      status={status}
      transcript={null}
      error={status === 'error' ? 'Spracherkennung fehlgeschlagen' : null}
      handsFreeEnabled={false}
      {...callbacks()}
    />,
  );

  expect(screen.getByText(label)).toBeOnTheScreen();
});

it('exposes reading, ingredient, and listening actions with accessible names', async () => {
  const user = userEvent.setup();
  const handlers = callbacks();
  await render(
    <CookingModeVoiceStatus
      status="ready"
      transcript={null}
      error={null}
      handsFreeEnabled={false}
      {...handlers}
    />,
  );

  await user.press(screen.getByRole('button', { name: 'Vorlesen' }));
  await user.press(screen.getByRole('button', { name: 'Zutaten dieses Schritts vorlesen' }));
  await user.press(screen.getByRole('button', { name: 'Zuhören' }));

  expect(handlers.onReadStep).toHaveBeenCalledTimes(1);
  expect(handlers.onReadIngredients).toHaveBeenCalledTimes(1);
  expect(handlers.onStartListening).toHaveBeenCalledTimes(1);
});

it('switches to stop actions while reading or processing', async () => {
  const user = userEvent.setup();
  const readingHandlers = callbacks();
  await render(
    <CookingModeVoiceStatus
      status="reading"
      transcript={null}
      error={null}
      handsFreeEnabled={false}
      {...readingHandlers}
    />,
  );
  await user.press(screen.getByRole('button', { name: 'Vorlesen stoppen' }));
  expect(readingHandlers.onStopReading).toHaveBeenCalledTimes(1);

  const processingHandlers = callbacks();
  await screen.rerender(
    <CookingModeVoiceStatus
      status="processing"
      transcript="weiter"
      error={null}
      handsFreeEnabled={false}
      {...processingHandlers}
    />,
  );
  expect(screen.getByText('Gehört: weiter')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Zuhören beenden' }));
  expect(processingHandlers.onStopListening).toHaveBeenCalledTimes(1);
});

it('zeigt manuelle Pause, Fortsetzung und Beenden für Hands-free', async () => {
  const user = userEvent.setup();
  const handlers = callbacks();
  await render(
    <CookingModeVoiceStatus
      status="listening"
      transcript={null}
      error={null}
      handsFreeEnabled
      {...handlers}
    />,
  );

  await user.press(screen.getByRole('button', { name: 'Hands-free pausieren' }));
  expect(handlers.onPauseHandsFree).toHaveBeenCalledTimes(1);
  await user.press(screen.getByRole('button', { name: 'Hands-free beenden' }));
  expect(handlers.onEndHandsFree).toHaveBeenCalledTimes(1);

  await screen.rerender(
    <CookingModeVoiceStatus
      status="paused"
      transcript={null}
      error={null}
      handsFreeEnabled
      {...handlers}
    />,
  );
  await user.press(screen.getByRole('button', { name: 'Hands-free fortsetzen' }));
  expect(handlers.onResumeHandsFree).toHaveBeenCalledTimes(1);
});
it('announces voice errors visibly', async () => {
  await render(
    <CookingModeVoiceStatus
      status="error"
      transcript="unbekannt"
      error="Befehl nicht erkannt"
      handsFreeEnabled={false}
      {...callbacks()}
    />,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Befehl nicht erkannt');
  expect(screen.getByText('Gehört: unbekannt')).toBeOnTheScreen();
});
