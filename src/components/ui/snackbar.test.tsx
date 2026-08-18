import { fireEvent, render, screen } from '@testing-library/react-native';
import { act } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SnackbarProvider, useSnackbar } from '@/components/ui/snackbar';

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

function TriggerButton({ onUndo, durationMs }: { onUndo: () => void; durationMs?: number }) {
  const { showUndoSnackbar } = useSnackbar();
  return (
    <Pressable
      onPress={() => showUndoSnackbar({ message: 'Artikel gelöscht', onUndo, durationMs })}>
      <Text>Löschen</Text>
    </Pressable>
  );
}

function renderWithProvider(props: { onUndo: () => void; durationMs?: number }) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <SnackbarProvider>
        <TriggerButton {...props} />
      </SnackbarProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('zeigt die Snackbar nach dem Ausloesen und ruft onUndo beim Tap auf "Rückgängig" auf', async () => {
  const onUndo = jest.fn();
  await renderWithProvider({ onUndo });

  await fireEvent.press(screen.getByText('Löschen'));
  expect(screen.getByText('Artikel gelöscht')).toBeTruthy();

  await fireEvent.press(screen.getByText('Rückgängig'));
  expect(onUndo).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Artikel gelöscht')).not.toBeOnTheScreen();
});

it('blendet die Snackbar nach der Auto-Dismiss-Dauer selbststaendig aus', async () => {
  const onUndo = jest.fn();
  await renderWithProvider({ onUndo, durationMs: 1000 });

  await fireEvent.press(screen.getByText('Löschen'));
  expect(screen.getByText('Artikel gelöscht')).toBeTruthy();

  act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(screen.queryByText('Artikel gelöscht')).not.toBeOnTheScreen();
  expect(onUndo).not.toHaveBeenCalled();
});
