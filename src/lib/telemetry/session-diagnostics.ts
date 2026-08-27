import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

import type { TelemetryProperties } from './schema';

const SESSION_MARKER_KEY = '@fam/telemetry-session.v1';
const WATCHDOG_INTERVAL_MS = 500;
const WATCHDOG_STALL_MS = 2_000;
const WATCHDOG_THROTTLE_MS = 30_000;

type SessionMarker = {
  sessionId: string;
  state: 'closed' | 'open';
  startedAt: number;
  lastEventAt: number;
  lastOperation?: string;
  lastRoute?: string;
};

let currentMarker: SessionMarker | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function sessionId(now = Date.now()): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseMarker(value: string | null): SessionMarker | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sessionId' in parsed &&
      typeof parsed.sessionId === 'string' &&
      'state' in parsed &&
      (parsed.state === 'open' || parsed.state === 'closed') &&
      'lastEventAt' in parsed &&
      typeof parsed.lastEventAt === 'number'
    ) {
      return parsed as SessionMarker;
    }
  } catch {
    // Ein beschädigter Diagnosemarker darf den App-Start nie blockieren.
  }
  return null;
}

async function persistMarker(): Promise<void> {
  if (!currentMarker) return;
  try {
    await AsyncStorage.setItem(SESSION_MARKER_KEY, JSON.stringify(currentMarker));
  } catch (error) {
    if (__DEV__) console.warn('[telemetry] Session-Marker konnte nicht gespeichert werden:', error);
  }
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistMarker();
  }, 250);
}

export function recordSessionOperation(operation: string): void {
  if (!currentMarker) return;
  currentMarker.lastOperation = operation;
  currentMarker.lastEventAt = Date.now();
  schedulePersist();
}

export function recordSessionRoute(route: string): void {
  if (!currentMarker) return;
  currentMarker.lastRoute = route;
  currentMarker.lastEventAt = Date.now();
  schedulePersist();
}

export async function startSessionDiagnostics(callbacks: {
  onPreviousSessionUnclean: (properties: TelemetryProperties) => void;
  onEventLoopStalled: (properties: TelemetryProperties) => void;
  onBackgrounded?: () => void;
}): Promise<() => void> {
  const now = Date.now();
  let previous: SessionMarker | null = null;
  try {
    previous = parseMarker(await AsyncStorage.getItem(SESSION_MARKER_KEY));
  } catch (error) {
    if (__DEV__) console.warn('[telemetry] Session-Marker konnte nicht gelesen werden:', error);
  }

  currentMarker = {
    sessionId: sessionId(now),
    state: 'open',
    startedAt: now,
    lastEventAt: now,
  };
  await persistMarker();

  if (previous?.state === 'open') {
    callbacks.onPreviousSessionUnclean({
      previous_session_id: previous.sessionId,
      last_event_at: previous.lastEventAt,
      seconds_since_last_event: Math.max(0, Math.round((now - previous.lastEventAt) / 1_000)),
      ...(previous.lastOperation ? { last_operation: previous.lastOperation } : {}),
      ...(previous.lastRoute ? { last_route: previous.lastRoute } : {}),
    });
  }

  let active = AppState.currentState === 'active';
  let expectedWatchdogAt = Date.now() + WATCHDOG_INTERVAL_MS;
  let lastStallReportedAt = -Infinity;

  const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'background') {
      active = false;
      callbacks.onBackgrounded?.();
      if (currentMarker) {
        currentMarker.state = 'closed';
        currentMarker.lastEventAt = Date.now();
        void persistMarker();
      }
      return;
    }

    if (nextState === 'inactive') {
      active = false;
      return;
    }

    if (nextState === 'active') {
      active = true;
      expectedWatchdogAt = Date.now() + WATCHDOG_INTERVAL_MS;
      if (currentMarker) {
        currentMarker.state = 'open';
        currentMarker.lastEventAt = Date.now();
        void persistMarker();
      }
    }
  });

  const watchdog = setInterval(() => {
    const observedAt = Date.now();
    if (active) {
      const delayMs = observedAt - expectedWatchdogAt;
      if (
        delayMs >= WATCHDOG_STALL_MS &&
        observedAt - lastStallReportedAt >= WATCHDOG_THROTTLE_MS
      ) {
        lastStallReportedAt = observedAt;
        callbacks.onEventLoopStalled({
          operation: 'app.event_loop',
          outcome: 'stalled',
          duration_ms: delayMs,
        });
      }
    }
    expectedWatchdogAt = observedAt + WATCHDOG_INTERVAL_MS;
  }, WATCHDOG_INTERVAL_MS);

  return () => {
    appStateSubscription.remove();
    clearInterval(watchdog);
    if (currentMarker) {
      currentMarker.state = 'closed';
      currentMarker.lastEventAt = Date.now();
      void persistMarker();
    }
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
      void persistMarker();
    }
  };
}
