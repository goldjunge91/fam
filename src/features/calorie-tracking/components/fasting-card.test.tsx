import { render, screen, userEvent } from '@testing-library/react-native';
import { FastingCard } from './fasting-card';

const mockMutateStart = jest.fn();
const mockMutateEnd = jest.fn();

let mockActiveSession: {
  id: string;
  protocol: string;
  started_at: string;
  target_duration_minutes: number;
} | null = null;

jest.mock('@/features/calorie-tracking/fasting-api', () => {
  const actual = jest.requireActual('@/features/calorie-tracking/fasting-api');
  return {
    ...actual,
    useActiveFastingSession: () => ({ data: mockActiveSession, isLoading: false }),
    useStartFastMutation: () => ({ mutate: mockMutateStart, isPending: false }),
    useEndFastMutation: () => ({ mutate: mockMutateEnd, isPending: false }),
  };
});

beforeEach(() => {
  mockActiveSession = null;
  mockMutateStart.mockClear();
  mockMutateEnd.mockClear();
});

describe('FastingCard', () => {
  it('zeigt inaktiven Zustand mit Protokollauswahl wenn kein Fasten aktiv ist', async () => {
    await render(<FastingCard userId="user-1" />);

    expect(screen.getByText(/Intervallfasten/)).toBeOnTheScreen();
    expect(screen.getByText('16:8')).toBeOnTheScreen();
    expect(screen.getByText('18:6')).toBeOnTheScreen();
    expect(screen.getByText('Fasten starten')).toBeOnTheScreen();
  });

  it('startet Fasten-Session mit gewaehltem Protokoll', async () => {
    const user = userEvent.setup();
    await render(<FastingCard userId="user-1" />);

    const p18Btn = screen.getByText('18:6');
    await user.press(p18Btn);

    const startBtn = screen.getByText('Fasten starten');
    await user.press(startBtn);

    expect(mockMutateStart).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        protocol: '18:6',
        targetDurationMinutes: 1080,
      }),
    );
  });

  it('zeigt aktiven Zustand und Fortschritt bei laufendem Fasten an', async () => {
    // 2 Stunden (120 min) vor jetzt gestartet
    const twoHoursAgo = new Date(Date.now() - 120 * 60000).toISOString();
    mockActiveSession = {
      id: 'session-1',
      protocol: '16:8',
      started_at: twoHoursAgo,
      target_duration_minutes: 960,
    };

    await render(<FastingCard userId="user-1" />);

    expect(screen.getByText(/Intervallfasten \(16:8\)/)).toBeOnTheScreen();
    expect(screen.getByText('Fastenphase')).toBeOnTheScreen();
    expect(screen.getByText(/2h/)).toBeOnTheScreen();
    expect(screen.getByText('Fasten beenden')).toBeOnTheScreen();
  });

  it('beendet laufendes Fasten beim Klick auf Beenden', async () => {
    mockActiveSession = {
      id: 'session-1',
      protocol: '16:8',
      started_at: new Date().toISOString(),
      target_duration_minutes: 960,
    };

    const user = userEvent.setup();
    await render(<FastingCard userId="user-1" />);

    const endBtn = screen.getByText('Fasten beenden');
    await user.press(endBtn);

    expect(mockMutateEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
      }),
    );
  });
});
