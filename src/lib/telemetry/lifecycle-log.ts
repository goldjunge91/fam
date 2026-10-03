import { bugBubbleConsole } from '@/lib/analytics/bug-bubble';
import { getDeviceStorage } from '@/lib/storage/local-device-storage';

/**
 * Ringpuffer der letzten Lifecycle-Ereignisse, persistiert im Geraetespeicher.
 *
 * Zweck: Nach einem Kaltstart-/Hintergrund-Crash steht kein JS-Stack mehr zur
 * Verfuegung. Dieses Log haelt fest, was die App vor dem Absturz getan hat
 * (Background-Wechsel, unsaubere Session, Event-Loop-Stall), und ist damit der
 * guenstige Ersatz fuer einen nativen Crash-Handler.
 *
 * Bewusst klein gehalten: MMKV-Schreibvorgaenge sind synchron und schnell, ein
 * Event pro Lifecycle-Uebergang ist vernachlaessigbar. Bei jeder Beruehrung
 * werden zusaetzlich die BugBubble-Konsole gespiegelt, damit die Flag-Gruppe
 * die Ereignisse live im Inspector sieht.
 */

const LIFECYCLE_LOG_STORAGE_KEY = 'dev.lifecycle_log.v1';
const MAX_LIFECYCLE_EVENTS = 50;

export type LifecycleLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LifecycleLogEvent = {
  /** Epoch-Millisekunden, damit die Liste stabil sortierbar bleibt. */
  at: number;
  /** Ereignisname, z. B. app.backgrounded oder app.previous_session.unclean. */
  name: string;
  level: LifecycleLogLevel;
  /** Kurze, nicht sensible Zusatzwerte (Dauer, Route, Session-ID ...). */
  detail?: string;
};

export type LifecycleLogInput = {
  name: string;
  level?: LifecycleLogLevel;
  detail?: string;
  at?: number;
};

function isLifecycleLogEvent(value: unknown): value is LifecycleLogEvent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.at === 'number' &&
    typeof candidate.name === 'string' &&
    typeof candidate.level === 'string'
  );
}

function readEvents(): LifecycleLogEvent[] {
  try {
    const raw = getDeviceStorage().getString(LIFECYCLE_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLifecycleLogEvent);
  } catch {
    return [];
  }
}

/** Der komplette Logverlauf, aeltestes zuerst. */
export function getLifecycleLog(): LifecycleLogEvent[] {
  return readEvents();
}

/**
 * Persistiert ein Lifecycle-Ereignis und spiegelt es in die BugBubble-Konsole.
 * Nie werfen: Diagnose darf den App-Lifecycle nicht stoeren.
 */
export function recordLifecycleEvent(input: LifecycleLogInput): void {
  const event: LifecycleLogEvent = {
    at: input.at ?? Date.now(),
    name: input.name,
    level: input.level ?? 'info',
    ...(input.detail ? { detail: input.detail } : {}),
  };

  bugBubbleConsole(event.level, `[lifecycle] ${event.name}`, event.detail ?? '');

  try {
    const storage = getDeviceStorage();
    const events = [...readEvents(), event].slice(-MAX_LIFECYCLE_EVENTS);
    storage.set(LIFECYCLE_LOG_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Persistenz ist best effort; ein voller Speicher darf den Lifecycle nicht brechen.
  }
}
