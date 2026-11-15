import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { cancelLocalReminder, scheduleLocalReminder } from '@/lib/platform/notifications';

export type CookingTimerOptions = {
  stepId: string | null | undefined;
  durationSeconds: number | null | undefined;
};

export type CookingTimer = {
  remainingSeconds: number;
  activeDurationSeconds: number;
  running: boolean;
  start: (durationSeconds?: number) => void;
  pause: () => void;
  reset: () => void;
};

const TIMER_NOTIFICATION_IDENTIFIER_PREFIX = 'fam.recipe.cooking-timer.v1.';

function normalizeDuration(durationSeconds: number | null | undefined): number {
  return durationSeconds && durationSeconds > 0 ? Math.floor(durationSeconds) : 0;
}

function timerNotificationIdentifier(stepId: string): string {
  return `${TIMER_NOTIFICATION_IDENTIFIER_PREFIX}${stepId}`;
}

export function useCookingTimer({ stepId, durationSeconds }: CookingTimerOptions): CookingTimer {
  const initialDuration = normalizeDuration(durationSeconds);
  const reminderIdentifier = stepId ? timerNotificationIdentifier(stepId) : null;
  const [remainingSeconds, setRemainingSeconds] = useState(stepId ? initialDuration : 0);
  const [activeDurationSeconds, setActiveDurationSeconds] = useState(initialDuration);
  const [running, setRunning] = useState(false);
  const remainingRef = useRef(remainingSeconds);
  const runningRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);
  const reminderGenerationRef = useRef(0);

  const updateRemaining = useCallback((nextRemainingSeconds: number) => {
    const normalized = Math.max(0, Math.ceil(nextRemainingSeconds));
    remainingRef.current = normalized;
    setRemainingSeconds(normalized);
  }, []);

  const cancelReminder = useCallback(() => {
    reminderGenerationRef.current += 1;
    if (reminderIdentifier) void cancelLocalReminder(reminderIdentifier);
  }, [reminderIdentifier]);

  const scheduleReminder = useCallback(
    (deadline: number) => {
      if (!reminderIdentifier) return;

      const generation = reminderGenerationRef.current + 1;
      reminderGenerationRef.current = generation;
      void Promise.resolve(
        scheduleLocalReminder({
          identifier: reminderIdentifier,
          date: new Date(deadline),
          title: 'Koch-Timer abgelaufen',
          body: 'Der Timer für diesen Schritt ist abgelaufen.',
        }),
      )
        .catch(() => false)
        .then(() => {
          if (reminderGenerationRef.current !== generation) {
            void cancelLocalReminder(reminderIdentifier);
          }
        });
    },
    [reminderIdentifier],
  );

  const refreshTimer = useCallback(() => {
    if (!runningRef.current || deadlineRef.current === null) return;

    const nextRemainingSeconds = Math.max(0, (deadlineRef.current - Date.now()) / 1_000);
    updateRemaining(nextRemainingSeconds);
    if (nextRemainingSeconds <= 0) {
      deadlineRef.current = null;
      runningRef.current = false;
      setRunning(false);
      cancelReminder();
    }
  }, [cancelReminder, updateRemaining]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') refreshTimer();
    });
    return () => subscription.remove();
  }, [refreshTimer]);

  useEffect(() => {
    if (!running) return;

    refreshTimer();
    const interval = setInterval(refreshTimer, 1_000);
    return () => clearInterval(interval);
  }, [refreshTimer, running]);

  useEffect(() => {
    remainingRef.current = stepId ? initialDuration : 0;
    deadlineRef.current = null;
    runningRef.current = false;
    setActiveDurationSeconds(initialDuration);
    setRemainingSeconds(stepId ? initialDuration : 0);
    setRunning(false);
    cancelReminder();

    return () => {
      deadlineRef.current = null;
      runningRef.current = false;
      cancelReminder();
    };
  }, [cancelReminder, initialDuration, stepId]);

  const start = useCallback(
    (requestedDurationSeconds?: number) => {
      if (!stepId) return;

      const explicitDuration =
        requestedDurationSeconds === undefined ? null : normalizeDuration(requestedDurationSeconds);
      const nextDuration = explicitDuration ?? remainingRef.current;
      if (nextDuration <= 0) return;

      if (explicitDuration !== null) {
        setActiveDurationSeconds(explicitDuration);
        updateRemaining(explicitDuration);
      }

      const deadline = Date.now() + nextDuration * 1_000;
      deadlineRef.current = deadline;
      runningRef.current = true;
      setRunning(true);
      scheduleReminder(deadline);
    },
    [scheduleReminder, stepId, updateRemaining],
  );

  const pause = useCallback(() => {
    if (runningRef.current) refreshTimer();
    deadlineRef.current = null;
    runningRef.current = false;
    setRunning(false);
    cancelReminder();
  }, [cancelReminder, refreshTimer]);

  const reset = useCallback(() => {
    deadlineRef.current = null;
    runningRef.current = false;
    setActiveDurationSeconds(initialDuration);
    updateRemaining(stepId ? initialDuration : 0);
    setRunning(false);
    cancelReminder();
  }, [cancelReminder, initialDuration, stepId, updateRemaining]);

  return {
    remainingSeconds,
    activeDurationSeconds,
    running,
    start,
    pause,
    reset,
  };
}
