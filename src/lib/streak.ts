/**
 * Cooking streak — the Duolingo-style "don't break the chain" reward.
 * Counts consecutive days the user cooks or logs food. Stored locally (and
 * synced like other srf: keys). recordActivity() is called from cook-complete
 * and food logging; the home screen shows a 🔥 chip.
 */
import { useSyncExternalStore } from 'react';

import { getDeviceStorage } from './storage/device-storage';

const KEY = 'srf:cook-streak';

type StreakState = { count: number; lastDate: string | null; best: number };

function readRaw(): string | null {
  try {
    return getDeviceStorage().getString(KEY) ?? null;
  } catch {
    return null;
  }
}

function parse(raw: string | null): StreakState {
  if (raw) {
    try {
      const s: unknown = JSON.parse(raw);
      if (typeof s === 'object' && s !== null && 'count' in s && typeof s.count === 'number') {
        const state = s as { count: number; lastDate?: unknown; best?: unknown };
        return {
          count: state.count,
          lastDate: typeof state.lastDate === 'string' ? state.lastDate : null,
          best: typeof state.best === 'number' ? state.best : state.count,
        };
      }
    } catch {
      /* ignore invalid local state */
    }
  }
  return { count: 0, lastDate: null, best: 0 };
}

function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayDiff(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

function read(): StreakState {
  return parse(readRaw());
}

function write(s: StreakState): void {
  try {
    getDeviceStorage().set(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export type StreakView = { count: number; best: number; activeToday: boolean };

function toView(s: StreakState, today: string): StreakView {
  const daysSinceActivity = s.lastDate ? dayDiff(s.lastDate, today) : null;
  const active = daysSinceActivity === 0 || daysSinceActivity === 1;
  return { count: active ? s.count : 0, best: s.best, activeToday: daysSinceActivity === 0 };
}

/** Current streak, treating it as broken unless the last activity was today or yesterday. */
export function getStreak(): StreakView {
  const s = read();
  return toView(s, todayStr());
}

/**
 * Record a day of activity. Increments on a new consecutive day, resets after a
 * gap, no-ops if already counted today. Returns whether the streak grew + if it
 * hit a milestone (for a bigger celebration).
 */
export function recordActivity(): { count: number; increased: boolean; milestone: boolean } {
  const s = read();
  const today = todayStr();
  if (s.lastDate === today) return { count: s.count, increased: false, milestone: false };
  const count = s.lastDate && dayDiff(s.lastDate, today) === 1 ? s.count + 1 : 1;
  write({ count, lastDate: today, best: Math.max(s.best, count) });
  return { count, increased: true, milestone: [3, 7, 14, 30, 50, 100, 365].includes(count) };
}

/** Reactive streak for the home screen. */
export function useStreak(): StreakView {
  const raw = useSyncExternalStore(
    (onStoreChange) => {
      try {
        const listener = getDeviceStorage().addOnValueChangedListener((key) => {
          if (key === KEY) onStoreChange();
        });
        return () => listener.remove();
      } catch {
        return () => undefined;
      }
    },
    readRaw,
    readRaw,
  );
  const s = parse(raw);
  return toView(s, todayStr());
}
