import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, LOG_LEVEL } from 'react-native-purchases';

import { env } from '@/lib/env';

/**
 * Entitlement-Identifier aus dem RevenueCat-Dashboard (Entitlements-Tab).
 * Muss dort exakt so angelegt werden, bevor echte Kaeufe geprueft werden
 * koennen. Aktueller Stand im "Foodapp"-Projekt: `Pro` ("access to all
 * features"), verknuepft mit dem Test-Store-Produkt `fam_premium_monthly`.
 */
export const PREMIUM_ENTITLEMENT_ID = 'Pro';

let configured = false;

/**
 * Konfiguriert den RevenueCat-SDK einmalig pro App-Leben.
 *
 * Key-Wahl, in dieser Reihenfolge:
 * 1. In Entwicklungs-Builds (`__DEV__`) der RevenueCat Test Store
 *    (`EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`) — eine synthetische Store-
 *    Implementierung, die echte Entitlement-Aenderungen ohne Sandbox-Account
 *    oder App-Store-Review ausloest. Siehe `revenueCatTestStoreApiKey` in
 *    `env.ts`.
 * 2. Sonst der plattformeigene Key (`revenueCatApiKeyIos`/`Android`) — fuer
 *    Sandbox- und Produktions-Builds.
 *
 * Ohne passenden Key (noch keine Store-App im RevenueCat-Projekt angelegt)
 * bleibt das bewusst ein No-op mit Warnung statt eines Absturzes.
 * `EXPO_PUBLIC_FORCE_PREMIUM` funktioniert dann trotzdem, siehe
 * `PremiumProvider`.
 */
export function initPurchases(): void {
  if (configured) return;

  const apiKey =
    (__DEV__ && env.revenueCatTestStoreApiKey) ||
    Platform.select({
      ios: env.revenueCatApiKeyIos,
      android: env.revenueCatApiKeyAndroid,
      default: undefined,
    });

  if (!apiKey) {
    console.warn(
      '[Purchases] Kein RevenueCat-API-Key gesetzt (EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY ' +
        'fuer die Entwicklung, sonst EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / _ANDROID_API_KEY). ' +
        'Kaeufe bleiben deaktiviert; EXPO_PUBLIC_FORCE_PREMIUM=true schaltet Premium-Funktionen ' +
        'trotzdem zum Testen frei.',
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
