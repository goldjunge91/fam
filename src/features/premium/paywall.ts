import { Platform } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { trackAptabaseEvent } from '@/lib/analytics/aptabase';
import { isPurchasesConfigured, PREMIUM_ENTITLEMENT_ID } from '@/lib/purchases';

/**
 * `react-native-purchases-ui` ist iOS/Android-only (natives View-Hosting,
 * kein Web-Ziel). Ohne diese Pruefung wuerde `presentPaywall()` im
 * Web-Build der App (siehe `web.output` in app.json) mit einem
 * "native module not found" abstuerzen statt einfach nichts zu tun.
 */
function isPaywallUiAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'unavailable';

/**
 * Zeigt die im RevenueCat-Dashboard konfigurierte Paywall (Offerings > Paywall)
 * als Vollbild-Modal. Ohne dort hinterlegtes Template faellt RevenueCatUI auf
 * ein Standardlayout zurueck — funktioniert, sieht aber generisch aus.
 *
 * Ruft `Purchases.purchasePackage` NICHT selbst auf — die Paywall kauft
 * intern. `PremiumProvider` uebernimmt den neuen Status ueber den
 * CustomerInfo-Listener, sobald der Kauf durchgelaufen ist.
 */
export async function presentPaywall(): Promise<PaywallOutcome> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return 'unavailable';

  trackAptabaseEvent('paywall_viewed');
  const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });

  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      trackAptabaseEvent('purchase_completed');
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      trackAptabaseEvent('purchase_restored');
      return 'restored';
    default:
      return 'cancelled';
  }
}

/**
 * Wie `presentPaywall()`, zeigt die Paywall aber nur, wenn das Premium-
 * Entitlement noch nicht aktiv ist. Gedacht fuer Einstiegspunkte, die vor
 * einer Premium-Funktion haengen ("Rezept kochen" -> Paywall nur falls noetig).
 */
export async function presentPaywallIfNeeded(): Promise<PaywallOutcome> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return 'unavailable';

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PREMIUM_ENTITLEMENT_ID,
    displayCloseButton: true,
  });

  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      trackAptabaseEvent('purchase_completed');
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      trackAptabaseEvent('purchase_restored');
      return 'restored';
    case PAYWALL_RESULT.NOT_PRESENTED:
      // Entitlement war schon aktiv - keine Paywall noetig, aus Aufrufersicht
      // aber trotzdem ein Erfolg (Zugriff besteht).
      return 'purchased';
    default:
      return 'cancelled';
  }
}

/**
 * Oeffnet das im Dashboard konfigurierte Customer Center (Abo verwalten,
 * kuendigen, Kaufhistorie wiederherstellen, Support). Ohne Konfiguration im
 * Dashboard zeigt es ein minimales Standardlayout.
 *
 * Ruft NICHT `restorePurchases()` parallel auf - das Customer Center fuehrt
 * seinen eigenen Restore-Flow, ein zweiter waere redundant.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!isPaywallUiAvailable() || !isPurchasesConfigured()) return;
  await RevenueCatUI.presentCustomerCenter();
}
