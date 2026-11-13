import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { cancelLocalReminder, scheduleLocalReminder } from '@/lib/platform/notifications';
import { useCookingTimer } from './use-cooking-timer';

jest.mock('@/lib/platform/notifications', () => ({
  cancelLocalReminder: jest.fn().mockResolvedValue(undefined),
  scheduleLocalReminder: jest.fn().mockResolvedValue(true),
}));

const mockCancelLocalReminder = jest.mocked(cancelLocalReminder);
const mockScheduleLocalReminder = jest.mocked(scheduleLocalReminder);

type TimerProps = {
  stepId: string;
  durationSeconds: number | null;
};

describe('useCookingTimer', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-01T08:00:00.000Z'));
    appStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
    });
    mockCancelLocalReminder.mockClear();
    mockScheduleLocalReminder.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('zaehlt bei gestartetem Timer sekundenweise herunter und stoppt bei null', async () => {
    const { result } = await renderHook(
      ({ stepId, durationSeconds }: TimerProps) => useCookingTimer({ stepId, durationSeconds }),
      { initialProps: { stepId: 'step-1', durationSeconds: 3 } },
    );

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.remainingSeconds).toBe(2);
    expect(result.current.running).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.running).toBe(false);
  });

  it('pausiert und setzt den Countdown an der aktuellen Stelle fort', async () => {
    const { result } = await renderHook(
      ({ stepId, durationSeconds }: TimerProps) => useCookingTimer({ stepId, durationSeconds }),
      { initialProps: { stepId: 'step-1', durationSeconds: 4 } },
    );

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    await act(async () => {
      result.current.pause();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.remainingSeconds).toBe(3);
    expect(result.current.running).toBe(false);

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.remainingSeconds).toBe(2);
    expect(result.current.running).toBe(true);
  });

  it('setzt den Timer auf seine Ausgangsdauer zurueck', async () => {
    const { result } = await renderHook(
      ({ stepId, durationSeconds }: TimerProps) => useCookingTimer({ stepId, durationSeconds }),
      { initialProps: { stepId: 'step-1', durationSeconds: 4 } },
    );

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.remainingSeconds).toBe(4);
    expect(result.current.running).toBe(false);
  });

  it('setzt bei einem neuen Schritt Dauer und Status zurueck', async () => {
    const { result, rerender } = await renderHook(
      ({ stepId, durationSeconds }: TimerProps) => useCookingTimer({ stepId, durationSeconds }),
      { initialProps: { stepId: 'step-1', durationSeconds: 4 } },
    );

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    await rerender({ stepId: 'step-2', durationSeconds: 7 });

    expect(result.current.remainingSeconds).toBe(7);
    expect(result.current.running).toBe(false);
  });

  it('verwendet die uebergebene explizite Dauer als Timer-Ausgangswert', async () => {
    const { result } = await renderHook(() =>
      useCookingTimer({ stepId: 'step-1', durationSeconds: 120 }),
    );

    expect(result.current.remainingSeconds).toBe(120);
    expect(result.current.running).toBe(false);
  });

  it('startet eine explizite Sprachdauer auch ohne Schritt-Timer', async () => {
    const { result } = await renderHook(() =>
      useCookingTimer({ stepId: 'step-1', durationSeconds: null }),
    );

    await act(async () => {
      result.current.start(90);
    });

    expect(result.current.remainingSeconds).toBe(90);
    expect(result.current.activeDurationSeconds).toBe(90);
    expect(result.current.running).toBe(true);
  });

  it('berechnet die Restzeit aus einer Deadline und aktualisiert sie bei der Rueckkehr', async () => {
    const { result } = await renderHook(() =>
      useCookingTimer({ stepId: 'step-1', durationSeconds: 5 }),
    );

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(result.current.remainingSeconds).toBe(3);

    await act(async () => {
      jest.setSystemTime(new Date('2026-09-01T08:00:06.000Z'));
      appStateListener?.('active');
    });

    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.running).toBe(false);
  });

  it('plant beim Start eine Erinnerung mit der Standard- oder Sprachdauer', async () => {
    const { result } = await renderHook(() =>
      useCookingTimer({ stepId: 'step-1', durationSeconds: 5 }),
    );

    await act(async () => {
      result.current.start(8);
      await Promise.resolve();
    });

    expect(mockScheduleLocalReminder).toHaveBeenCalledWith({
      identifier: 'fam.recipe.cooking-timer.v1.step-1',
      date: new Date('2026-09-01T08:00:08.000Z'),
      title: 'Koch-Timer abgelaufen',
      body: 'Der Timer für diesen Schritt ist abgelaufen.',
    });
    expect(result.current.activeDurationSeconds).toBe(8);
  });

  it('entfernt die Erinnerung beim Pausieren, Zuruecksetzen, Schrittwechsel und Unmount', async () => {
    const { result, rerender, unmount } = await renderHook(
      ({ stepId }: TimerProps) => useCookingTimer({ stepId, durationSeconds: 5 }),
      { initialProps: { stepId: 'step-1', durationSeconds: 5 } },
    );

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      result.current.pause();
    });
    expect(mockCancelLocalReminder).toHaveBeenCalledWith('fam.recipe.cooking-timer.v1.step-1');

    mockCancelLocalReminder.mockClear();
    await act(async () => {
      result.current.start();
      result.current.reset();
    });
    expect(mockCancelLocalReminder).toHaveBeenCalledWith('fam.recipe.cooking-timer.v1.step-1');

    mockCancelLocalReminder.mockClear();
    await rerender({ stepId: 'step-2', durationSeconds: 5 });
    expect(mockCancelLocalReminder).toHaveBeenCalledWith('fam.recipe.cooking-timer.v1.step-1');

    mockCancelLocalReminder.mockClear();
    await unmount();
    expect(mockCancelLocalReminder).toHaveBeenCalledWith('fam.recipe.cooking-timer.v1.step-2');
  });
});
