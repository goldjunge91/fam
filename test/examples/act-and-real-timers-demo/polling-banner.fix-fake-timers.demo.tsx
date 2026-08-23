import { act, render, screen } from '@testing-library/react-native';
import { PollingBanner } from './polling-banner';

// Fake Timer machen das Polling unabhaengig von Wanduhrzeit und Systemlast.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  // Ausstehende Tasks muessen vor echten Timern abgearbeitet werden.
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('FIX: jest.useFakeTimers() macht das Polling deterministisch statt wall-clock-abhaengig', async () => {
  await render(<PollingBanner intervalMs={3000} />);

  // `Date.now()` wird mitvirtualisiert; Jests Laufzeit zeigt die fehlende reale Wartezeit.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });

  expect(screen.getByText('1')).toBeOnTheScreen();
});
