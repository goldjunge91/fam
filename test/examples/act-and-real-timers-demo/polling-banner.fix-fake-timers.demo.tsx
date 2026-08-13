import { act, render, screen } from '@testing-library/react-native';
import { PollingBanner } from './polling-banner';

// FIX: jest.useFakeTimers() macht das Polling deterministisch und
// unabhaengig von echter Wanduhrzeit/Systemlast. Virtuelle Zeit vorspulen
// statt real zu warten.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  // testing-library.com/docs/using-fake-timers: vor dem Zurueckschalten auf
  // echte Timer noch ausstehende Tasks abarbeiten, sonst bleiben
  // Zeitplaene haengen und verhalten sich beim naechsten Test unerwartet.
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('FIX: jest.useFakeTimers() macht das Polling deterministisch statt wall-clock-abhaengig', async () => {
  await render(<PollingBanner intervalMs={3000} />);

  // Date.now() wird von modernen Fake-Timers mitvirtualisiert, ist hier also
  // kein brauchbares Mass fuer echte Wanduhrzeit mehr (siehe REPRODUKTION-
  // Test fuer den Wanduhrzeit-Nachweis mit echten Timern). Der Beweis fuer
  // "deterministisch, keine echte Wartezeit" ist stattdessen: dieser Test
  // laueft in Jests eigener Laufzeitmessung in wenigen ms/ohne die 3000ms
  // Verzoegerung, die der REPRODUKTION-Test real abwarten musste.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });

  expect(screen.getByText('1')).toBeOnTheScreen();
});
