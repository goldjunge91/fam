import { act, renderHook } from '@testing-library/react-native';
import { useCookingTimer } from './use-cooking-timer';

type TimerProps = {
  stepId: string;
  durationSeconds: number | null;
};

describe('useCookingTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
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
});
