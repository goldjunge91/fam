import { normalizeTelemetryProperties, trackEvent } from '@/lib/telemetry';
import type { ProductTelemetryEventMap } from '@/lib/telemetry/schema';

export type AnalyticsEventMap = ProductTelemetryEventMap;

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsEventProps<T extends AnalyticsEventName> =
  AnalyticsEventMap[T] extends Record<string, never>
    ? undefined | Record<string, never>
    : AnalyticsEventMap[T];

export function trackAnalyticsEvent<T extends AnalyticsEventName>(
  eventName: T,
  props?: AnalyticsEventProps<T>,
): void {
  const normalizedProps = normalizeTelemetryProperties(
    (props ?? {}) as Record<string, string | number | boolean>,
  );
  trackEvent(eventName, normalizedProps);
}
