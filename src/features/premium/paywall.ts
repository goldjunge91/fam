import { Platform } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { trackAnalyticsEvent } from '@/lib/analytics';
import { ENTITLEMENT_IDS, isPurchasesConfigured } from '@/lib/purchases';

function isPaywallUiAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'unavailable';

export async function presentPaywall(): Promise<PaywallOutcome> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return 'unavailable';

  trackAnalyticsEvent('paywall.view.completed', { source: 'revenuecat_ui' });
  const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });

  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      trackAnalyticsEvent('purchase.checkout.completed');
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      trackAnalyticsEvent('purchase.restore.completed');
      return 'restored';
    case PAYWALL_RESULT.CANCELLED:
      trackAnalyticsEvent('purchase.checkout.cancelled');
      return 'cancelled';
    default:
      return 'cancelled';
  }
}

export async function presentPaywallIfNeeded(): Promise<PaywallOutcome> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return 'unavailable';

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ENTITLEMENT_IDS.PLUS,
    displayCloseButton: true,
  });

  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      trackAnalyticsEvent('purchase.checkout.completed');
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      trackAnalyticsEvent('purchase.restore.completed');
      return 'restored';
    case PAYWALL_RESULT.CANCELLED:
      trackAnalyticsEvent('purchase.checkout.cancelled');
      return 'cancelled';
    case PAYWALL_RESULT.NOT_PRESENTED:
      // Zugriff besteht bereits, daher aus Aufrufersicht erfolgreich.
      return 'purchased';
    default:
      return 'cancelled';
  }
}

export async function presentCustomerCenter(): Promise<void> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return;
  await RevenueCatUI.presentCustomerCenter();
}
