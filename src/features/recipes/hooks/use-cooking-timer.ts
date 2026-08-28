import { useCallback, useEffect, useState } from 'react';

export type CookingTimerOptions = {
  stepId: string | null | undefined;
  durationSeconds: number | null | undefined;
};

export type CookingTimer = {
  remainingSeconds: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
};

function normalizeDuration(durationSeconds: number | null | undefined): number {
  return durationSeconds && durationSeconds > 0 ? durationSeconds : 0;
}

export function useCookingTimer({ stepId, durationSeconds }: CookingTimerOptions): CookingTimer {
  const initialDuration = normalizeDuration(durationSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(stepId ? initialDuration : 0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemainingSeconds(stepId ? initialDuration : 0);
    setRunning(false);
  }, [initialDuration, stepId]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          setRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1_000);

    return () => clearInterval(interval);
  }, [running]);

  const start = useCallback(() => {
    if (remainingSeconds > 0) setRunning(true);
  }, [remainingSeconds]);

  const pause = useCallback(() => {
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    setRemainingSeconds(stepId ? initialDuration : 0);
    setRunning(false);
  }, [initialDuration, stepId]);

  return { remainingSeconds, running, start, pause, reset };
}
