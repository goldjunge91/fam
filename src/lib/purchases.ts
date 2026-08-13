import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, LOG_LEVEL } from 'react-native-purchases';

import { env } from '@/lib/env';

/**
 * Entitlement-Identifier aus dem RevenueCat-Dashboard (Entitlements-Tab).
 * Muss dort exakt so angelegt werden, bevor echte Kaeufe geprueft werden
 * koennen.
 */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

let configured = false;

/**
 * Konfiguriert den RevenueCat-SDK einmalig pro App-Leben.
 *
 * Ohne API-Key (noch kein RevenueCat-Projekt verknuepft, siehe `env.ts`)
 * bleibt das bewusst ein No-op mit Warnung statt eines Absturzes — die
 * Paywall-Vorbereitung soll nicht voraussetzen, dass schon ein
 * RevenueCat-Projekt existiert. `EXPO_PUBLIC_FORCE_PREMIUM` funktioniert
 * dann trotzdem, siehe `PremiumProvider`.
 */
export function initPurchases(): void {
  if (configured) return;

  const apiKey = Platform.select({
    ios: env.revenueCatApiKeyIos,
    android: env.revenueCatApiKeyAndroid,
    default: undefined,
  });

  if (!apiKey) {
    console.warn(
      '[Purchases] Kein RevenueCat-API-Key gesetzt (EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / ' +
        '_ANDROID_API_KEY). Kaeufe bleiben deaktiviert; EXPO_PUBLIC_FORCE_PREMIUM=true ' +
        'schaltet Premium-Funktionen trotzdem zum Testen frei.',
    );
    return;
  }

  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  configured = true;
}

/** Ob `initPurchases()` erfolgreich einen API-Key konfiguriert hat. */
export function isPurchasesConfigured(): boolean {
  return configured;
}

/** Prueft, ob das Premium-Entitlement in den gegebenen `CustomerInfo` aktiv ist. */
export function hasPremiumEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}
