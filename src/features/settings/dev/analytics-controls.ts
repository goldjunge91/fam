import type { AnalyticsSettingPath, AnalyticsSettings } from '@/constants/analytics';

export type AnalyticsToggle = {
  path: AnalyticsSettingPath;
  labelKey: `dev.overrides.analytics.${string}`;
  getValue: (settings: AnalyticsSettings) => boolean;
};

export const analyticsToggles = [
  {
    path: 'enabled',
    labelKey: 'dev.overrides.analytics.global',
    getValue: (settings) => settings.enabled,
  },
  {
    path: 'providers.aptabase',
    labelKey: 'dev.overrides.analytics.aptabase',
    getValue: (settings) => settings.providers.aptabase,
  },
  {
    path: 'providers.posthog',
    labelKey: 'dev.overrides.analytics.posthog',
    getValue: (settings) => settings.providers.posthog,
  },
  {
    path: 'channels.productEvents',
    labelKey: 'dev.overrides.analytics.productEvents',
    getValue: (settings) => settings.channels.productEvents,
  },
  {
    path: 'channels.errorReports',
    labelKey: 'dev.overrides.analytics.errorReports',
    getValue: (settings) => settings.channels.errorReports,
  },
  {
    path: 'channels.diagnostics',
    labelKey: 'dev.overrides.analytics.diagnostics',
    getValue: (settings) => settings.channels.diagnostics,
  },
  {
    path: 'features.onboarding',
    labelKey: 'dev.overrides.analytics.onboarding',
    getValue: (settings) => settings.features.onboarding,
  },
  {
    path: 'features.household',
    labelKey: 'dev.overrides.analytics.household',
    getValue: (settings) => settings.features.household,
  },
  {
    path: 'features.inventory',
    labelKey: 'dev.overrides.analytics.inventory',
    getValue: (settings) => settings.features.inventory,
  },
  {
    path: 'features.shoppingList',
    labelKey: 'dev.overrides.analytics.shoppingList',
    getValue: (settings) => settings.features.shoppingList,
  },
  {
    path: 'features.recipes',
    labelKey: 'dev.overrides.analytics.recipes',
    getValue: (settings) => settings.features.recipes,
  },
  {
    path: 'features.mealPlanner',
    labelKey: 'dev.overrides.analytics.mealPlanner',
    getValue: (settings) => settings.features.mealPlanner,
  },
  {
    path: 'features.productSearch',
    labelKey: 'dev.overrides.analytics.productSearch',
    getValue: (settings) => settings.features.productSearch,
  },
  {
    path: 'features.premium',
    labelKey: 'dev.overrides.analytics.premium',
    getValue: (settings) => settings.features.premium,
  },
  {
    path: 'features.sync',
    labelKey: 'dev.overrides.analytics.sync',
    getValue: (settings) => settings.features.sync,
  },
] satisfies ReadonlyArray<AnalyticsToggle>;
