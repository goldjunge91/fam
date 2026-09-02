import type { AnalyticsSettingPath, AnalyticsSettings } from '@/constants/analytics';

export type AnalyticsToggle = {
  path: AnalyticsSettingPath;
  label: string;
  getValue: (settings: AnalyticsSettings) => boolean;
};

export const analyticsToggles = [
  { path: 'enabled', label: 'Analytics global', getValue: (settings) => settings.enabled },
  {
    path: 'providers.aptabase',
    label: 'Provider Aptabase',
    getValue: (settings) => settings.providers.aptabase,
  },
  {
    path: 'providers.posthog',
    label: 'Provider PostHog',
    getValue: (settings) => settings.providers.posthog,
  },
  {
    path: 'channels.productEvents',
    label: 'Kanal Produkt-Events',
    getValue: (settings) => settings.channels.productEvents,
  },
  {
    path: 'channels.errorReports',
    label: 'Kanal Fehlerberichte',
    getValue: (settings) => settings.channels.errorReports,
  },
  {
    path: 'channels.diagnostics',
    label: 'Kanal Diagnose',
    getValue: (settings) => settings.channels.diagnostics,
  },
  {
    path: 'features.onboarding',
    label: 'Feature Onboarding',
    getValue: (settings) => settings.features.onboarding,
  },
  {
    path: 'features.household',
    label: 'Feature Haushalt',
    getValue: (settings) => settings.features.household,
  },
  {
    path: 'features.inventory',
    label: 'Feature Vorrat',
    getValue: (settings) => settings.features.inventory,
  },
  {
    path: 'features.shoppingList',
    label: 'Feature Einkauf',
    getValue: (settings) => settings.features.shoppingList,
  },
  {
    path: 'features.recipes',
    label: 'Feature Rezepte',
    getValue: (settings) => settings.features.recipes,
  },
  {
    path: 'features.mealPlanner',
    label: 'Feature Essensplan',
    getValue: (settings) => settings.features.mealPlanner,
  },
  {
    path: 'features.productSearch',
    label: 'Feature Produktsuche',
    getValue: (settings) => settings.features.productSearch,
  },
  {
    path: 'features.premium',
    label: 'Feature Premium',
    getValue: (settings) => settings.features.premium,
  },
  {
    path: 'features.sync',
    label: 'Feature Sync',
    getValue: (settings) => settings.features.sync,
  },
] satisfies ReadonlyArray<AnalyticsToggle>;
