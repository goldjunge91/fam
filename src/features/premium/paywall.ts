import { Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

import { isPurchasesConfigured } from '@/lib/purchases';

function isPaywallUiAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Einziger verbliebener RevenueCatUI-Einstieg: die App rendert ihre Plus-/AI-Paywall
 * selbst (`/settings/plus-and-ai`), aber das native Customer Center bleibt RevenueCats
 * eigene Verwaltungsoberflaeche.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return;
  await RevenueCatUI.presentCustomerCenter();
}
