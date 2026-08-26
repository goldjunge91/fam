import { trackAptabaseEvent } from '@/lib/analytics/aptabase';
import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';

export interface AnalyticsEventMap {
  paywall_viewed: { source: string; offering_id?: string };
  purchase_started: {
    package_id: string;
    period?: string;
    price?: number;
    currency?: string;
  };
  purchase_completed: { package_id?: string; period?: string };
  purchase_cancelled: { package_id?: string };
  purchase_failed: { package_id?: string; error_code?: string; error_message?: string };
  restore_purchases_clicked: Record<string, never>;
  purchase_restored: Record<string, never>;
  onboarding_started: Record<string, never>;
  onboarding_step_viewed: { step: string };
  onboarding_completed: Record<string, never>;
  household_created: Record<string, never>;
  household_joined: Record<string, never>;
  barcode_scanned: { found: boolean };
  recipe_created: Record<string, never>;
  screen_view: { screen: string };
  screen_leave: { screen: string; duration_seconds: number };
  dev_tools_test_event: { timestamp: number; platform: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsEventProps<T extends AnalyticsEventName> =
  AnalyticsEventMap[T] extends Record<string, never>
    ? undefined | Record<string, never>
    : AnalyticsEventMap[T];

export function trackAnalyticsEvent<T extends AnalyticsEventName>(
  eventName: T,
  props?: AnalyticsEventProps<T>,
): void {
  const normalizedProps = (props ?? {}) as Record<string, string | number | boolean>;

  // 1. Aptabase Tracking
  try {
    trackAptabaseEvent(eventName, normalizedProps);
  } catch (err) {
    if (__DEV__) {
      console.warn(`[analytics] Aptabase-Event "${eventName}" fehlgeschlagen:`, err);
    }
  }

  // 2. PostHog Tracking
  try {
    if (isPostHogConfigured()) {
      const client = getPostHogClient();
      client?.capture(eventName, normalizedProps);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn(`[analytics] PostHog-Event "${eventName}" fehlgeschlagen:`, err);
    }
  }
}
