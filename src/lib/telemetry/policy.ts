import {
  type AnalyticsSettings,
  getAnalyticsSettings,
  isAnalyticsFeatureEnabled,
} from '@/constants/analytics';

export type TelemetryChannel = 'productEvents' | 'errorReports' | 'diagnostics';
export type AnalyticsFeature = keyof AnalyticsSettings['features'];

const PRODUCT_FEATURE_PREFIXES = [
  ['onboarding.', 'onboarding'],
  ['household.', 'household'],
  ['inventory_item.', 'inventory'],
  ['shopping_item.', 'shoppingList'],
  ['recipe.', 'recipes'],
  ['meal_suggestion.', 'recipes'],
  ['meal_plan', 'mealPlanner'],
  ['product.', 'productSearch'],
  ['paywall.', 'premium'],
  ['purchase.', 'premium'],
  ['sync.manual.', 'sync'],
] as const satisfies ReadonlyArray<readonly [string, AnalyticsFeature]>;

export function getAnalyticsFeatureForEvent(name: string): AnalyticsFeature | undefined {
  return PRODUCT_FEATURE_PREFIXES.find(([prefix]) => name.startsWith(prefix))?.[1];
}

export function getTelemetryChannelForEvent(name: string): TelemetryChannel {
  if (name === 'error.occurred' || name === 'warning.occurred') return 'errorReports';
  return 'diagnostics';
}

export function shouldCaptureTelemetry(channel: TelemetryChannel, eventName?: string): boolean {
  const settings = getAnalyticsSettings();
  if (!settings.enabled || !settings.channels[channel]) return false;

  if (channel !== 'productEvents' || eventName === undefined) return true;
  const feature = getAnalyticsFeatureForEvent(eventName);
  return feature === undefined || isAnalyticsFeatureEnabled(feature);
}

export function isAnalyticsProviderEnabled(provider: 'aptabase' | 'posthog'): boolean {
  const settings = getAnalyticsSettings();
  return settings.enabled && settings.providers[provider];
}
