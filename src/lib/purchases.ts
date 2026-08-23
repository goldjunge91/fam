import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { env } from '@/lib/env';

/** Muss dem Entitlement-Identifier im RevenueCat-Dashboard entsprechen. */
export const PREMIUM_ENTITLEMENT_ID = 'Premium';

let configured = false;

/** Nutzt in Dev den Test-Store-Key, sonst den plattformspezifischen Key. */
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

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    // Verhindert LogBox-Overlays fuer erwartete Test-Store-Warnungen.
    Purchases.setLogHandler((_level, message) => {
      console.log(`[RevenueCat] ${message}`);
    });
  }

  Purchases.configure({ apiKey });
  configured = true;
}

export function isPurchasesConfigured(): boolean {
  return configured;
}

export function hasPremiumEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

/** Liefert ohne Konfiguration oder aktuelles Offering ein leeres Array. */
export async function currentPackages(): Promise<PurchasesPackage[]> {
  if (!isPurchasesConfigured()) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function currentOffering(): Promise<PurchasesOffering | null> {
  if (!isPurchasesConfigured()) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export type PurchaseOutcome =
  | { kind: 'purchased'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: PurchasesError };

/** Behandelt Nutzerabbruch getrennt von Kauf-Fehlern. */
export async function buyPackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { kind: 'purchased', customerInfo };
  } catch (error) {
    const purchasesError = error as PurchasesError;
    if (purchasesError.userCancelled) return { kind: 'cancelled' };
    return { kind: 'failed', error: purchasesError };
  }
}

export async function restorePurchases(): Promise<
  { ok: true; customerInfo: CustomerInfo } | { ok: false; error: unknown }
> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { ok: true, customerInfo };
  } catch (error) {
    return { ok: false, error };
  }
}
