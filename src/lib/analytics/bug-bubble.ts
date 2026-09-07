import { BugBubbleLogger } from '@lokal-dev/react-native-bugbubble';

import { env } from '@/lib/env';

/**
 * Spiegelt Analytics-Events und Konsolen-Diagnostik in den BugBubble-Inspector
 * (siehe `AppProviders`). Nur relevant, wenn `env.devTools` aktiv ist — sonst
 * ist die Bubble ohnehin nicht gemountet und `BugBubbleLogger` würde die
 * Aufrufe stillschweigend verwerfen.
 */
export function bugBubbleAnalytics(eventName: string, properties?: Record<string, unknown>): void {
  if (!env.devTools) return;
  BugBubbleLogger.logAnalytics(eventName, properties);
}

export function bugBubbleConsole(
  level: 'debug' | 'info' | 'warn' | 'error',
  ...args: unknown[]
): void {
  if (!env.devTools) return;
  BugBubbleLogger.logConsole(level, ...args);
}
