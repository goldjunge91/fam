import { useAnalyticsSettingsStore } from '@/constants/analytics';
import {
  getAnalyticsFeatureForEvent,
  getTelemetryChannelForEvent,
  isAnalyticsProviderEnabled,
  shouldCaptureTelemetry,
} from '@/lib/telemetry/policy';

describe('telemetry policy', () => {
  beforeEach(() => {
    useAnalyticsSettingsStore.getState().resetOverrides();
  });

  it('ordnet bestehende Produkt-Events deterministisch Feature-Domaenen zu', () => {
    expect(getAnalyticsFeatureForEvent('onboarding.flow.completed')).toBe('onboarding');
    expect(getAnalyticsFeatureForEvent('household.join.completed')).toBe('household');
    expect(getAnalyticsFeatureForEvent('inventory_item.consume.completed')).toBe('inventory');
    expect(getAnalyticsFeatureForEvent('shopping_item.check.completed')).toBe('shoppingList');
    expect(getAnalyticsFeatureForEvent('recipe.create.completed')).toBe('recipes');
    expect(getAnalyticsFeatureForEvent('meal_plan.reuse.completed')).toBe('mealPlanner');
    expect(getAnalyticsFeatureForEvent('product.barcode_scan.completed')).toBe('productSearch');
    expect(getAnalyticsFeatureForEvent('purchase.checkout.completed')).toBe('premium');
    expect(getAnalyticsFeatureForEvent('sync.manual.completed')).toBe('sync');
    expect(getAnalyticsFeatureForEvent('future.feature.completed')).toBeUndefined();
  });

  it('ordnet Fehlerberichte getrennt von Diagnose-Events zu', () => {
    expect(getTelemetryChannelForEvent('error.occurred')).toBe('errorReports');
    expect(getTelemetryChannelForEvent('warning.occurred')).toBe('errorReports');
    expect(getTelemetryChannelForEvent('route.changed')).toBe('diagnostics');
  });

  it('respektiert globale, Provider-, Kanal- und Feature-Schalter unabhaengig', () => {
    const store = useAnalyticsSettingsStore.getState();

    expect(isAnalyticsProviderEnabled('aptabase')).toBe(true);
    expect(shouldCaptureTelemetry('productEvents', 'recipe.create.completed')).toBe(true);

    store.setOverride('features.recipes', false);
    expect(shouldCaptureTelemetry('productEvents', 'recipe.create.completed')).toBe(false);
    expect(shouldCaptureTelemetry('productEvents', 'household.join.completed')).toBe(true);

    store.setOverride('channels.productEvents', false);
    expect(shouldCaptureTelemetry('productEvents', 'household.join.completed')).toBe(false);
    expect(shouldCaptureTelemetry('diagnostics', 'route.changed')).toBe(true);

    store.setOverride('providers.aptabase', false);
    expect(isAnalyticsProviderEnabled('aptabase')).toBe(false);
    expect(isAnalyticsProviderEnabled('posthog')).toBe(true);
  });

  it('laesst unbekannte Produkt-Events aktiv, solange der Produktkanal aktiv ist', () => {
    expect(shouldCaptureTelemetry('productEvents', 'future.feature.completed')).toBe(true);

    useAnalyticsSettingsStore.getState().setOverride('channels.productEvents', false);
    expect(shouldCaptureTelemetry('productEvents', 'future.feature.completed')).toBe(false);
  });
});
