import { Platform } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { isPurchasesConfigured, PREMIUM_ENTITLEMENT_ID } from '@/lib/purchases';

/** RevenueCatUI ist nativ und darf im Web-Build nicht geladen werden. */
function isPaywallUiAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'unavailable';

/** Zeigt RevenueCats konfigurierte Paywall; Kauf und Statusupdate laufen im SDK. */
export async function presentPaywall(): Promise<PaywallOutcome> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return 'unavailable';

  const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });

  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      return 'restored';
    default:
      return 'cancelled';
  }
}

/** Zeigt die Paywall nur ohne aktives Premium-Entitlement. */
export async function presentPaywallIfNeeded(): Promise<PaywallOutcome> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return 'unavailable';

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PREMIUM_ENTITLEMENT_ID,
    displayCloseButton: true,
  });

  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      return 'restored';
    case PAYWALL_RESULT.NOT_PRESENTED:
      return 'purchased';
    default:
      return 'cancelled';
  }
}

/** Oeffnet RevenueCats Customer Center samt eigenem Restore-Flow. */
export async function presentCustomerCenter(): Promise<void> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return;
  await RevenueCatUI.presentCustomerCenter();
}
