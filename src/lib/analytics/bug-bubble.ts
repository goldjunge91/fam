import { BugBubbleLogger } from '@lokal-dev/react-native-bugbubble';

import { env } from '@/lib/env';

let active = (typeof __DEV__ !== 'undefined' && __DEV__) || env.devTools;

export function setBugBubbleActive(enabled: boolean): void {
  active = enabled;
}

export function isBugBubbleActive(): boolean {
  return active;
}

export type BugBubbleUserCheckOptions = {
  userId?: string | null;
  email?: string | null;
  flagEnabled?: boolean;
};

/**
 * Prüft, ob BugBubble für den aktuellen Kontext freigeschaltet werden soll:
 * - Im lokalen Entwicklungsmodus (__DEV__) immer aktiv.
 * - Mit env.devTools aktiv.
 * - In TestFlight / Preview / Production aktiv, wenn das Feature-Flag greift
 *   oder die User-ID / E-Mail berechtigt ist.
 */
export function isBugBubbleEnabledForUser(options: BugBubbleUserCheckOptions): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return true;
  }
  if (env.devTools) {
    return true;
  }
  if (options.flagEnabled === true) {
    return true;
  }

  const allowedEmails = process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS?.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (options.email && allowedEmails?.includes(options.email.toLowerCase())) {
    return true;
  }

  const allowedUserIds = process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS?.split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (options.userId && allowedUserIds?.includes(options.userId)) {
    return true;
  }

  return false;
}

/**
 * Spiegelt Analytics-Events und Konsolen-Diagnostik in den BugBubble-Inspector
 * (siehe `AppProviders`). Nur aktiv, wenn BugBubble gemountet ist.
 */
export function bugBubbleAnalytics(eventName: string, properties?: Record<string, unknown>): void {
  if (!active) return;
  BugBubbleLogger.logAnalytics(eventName, properties);
}

export function bugBubbleConsole(
  level: 'debug' | 'info' | 'warn' | 'error',
  ...args: unknown[]
): void {
  if (!active) return;
  BugBubbleLogger.logConsole(level, ...args);
}
