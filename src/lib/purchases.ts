import {
  ENTITLEMENT_VERIFICATION_MODE,
  VERIFICATION_RESULT,
} from '@revenuecat/purchases-typescript-internal';
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { env } from '@/lib/env';

export { ENTITLEMENT_VERIFICATION_MODE, VERIFICATION_RESULT };

export const ENTITLEMENT_IDS = {
  PLUS: 'Plus',
  AI: 'AI',
} as const;

export type EntitlementId = (typeof ENTITLEMENT_IDS)[keyof typeof ENTITLEMENT_IDS];

export const OFFERING_IDS = {
  PLUS: 'plus',
  AI: 'ai',
} as const;

export const PACKAGE_IDS = {
  MONTHLY: '$rc_monthly',
  ANNUAL: '$rc_annual',
} as const;

const OFFERING_ID_BY_ENTITLEMENT = {
  [ENTITLEMENT_IDS.PLUS]: OFFERING_IDS.PLUS,
  [ENTITLEMENT_IDS.AI]: OFFERING_IDS.AI,
} as const satisfies Record<EntitlementId, (typeof OFFERING_IDS)[keyof typeof OFFERING_IDS]>;

type RevenueCatPlatform = 'ios' | 'android';

const PRODUCTION_KEY_PREFIX: Record<RevenueCatPlatform, string> = {
  ios: 'appl_',
  android: 'goog_',
};

type SelectRevenueCatApiKeyOptions = {
  isDev: boolean;
  platform: string;
  testStoreApiKey: string | undefined;
  iosApiKey: string | undefined;
  androidApiKey: string | undefined;
};

/**
 * Waehlt den RevenueCat-API-Key fuer die aktuelle Plattform aus. In der
 * Entwicklung hat der Test-Store-Key Vorrang. Im Release-Build wird der
 * plattformspezifische Store-Key verlangt und die Auswahl faellt geschlossen
 * aus (liefert `undefined`), wenn dessen Praefix nicht zur Plattform passt --
 * etwa ein versehentlich verbliebener `test_`-Key oder der Key der jeweils
 * anderen Plattform in einem TestFlight-/Store-Build.
 */
export function selectRevenueCatApiKey({
  isDev,
  platform,
  testStoreApiKey,
  iosApiKey,
  androidApiKey,
}: SelectRevenueCatApiKeyOptions): string | undefined {
  if (isDev && testStoreApiKey) return testStoreApiKey;

  const candidate =
    platform === 'ios' ? iosApiKey : platform === 'android' ? androidApiKey : undefined;
  const expectedPrefix = PRODUCTION_KEY_PREFIX[platform as RevenueCatPlatform];
  if (!candidate || !expectedPrefix || !candidate.startsWith(expectedPrefix)) return undefined;

  return candidate;
}

let configured = false;

export function initPurchases(): void {
  if (configured) return;

  const apiKey = selectRevenueCatApiKey({
    isDev: __DEV__,
    platform: Platform.OS,
    testStoreApiKey: env.revenueCatTestStoreApiKey,
    iosApiKey: env.revenueCatApiKeyIos,
    androidApiKey: env.revenueCatApiKeyAndroid,
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
    // Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.setLogLevel(LOG_LEVEL.WARN); // or .ERROR

    // SDK-Warnungen über console.log ausgeben, damit LogBox keine Vollbildwarnung zeigt.
    Purchases.setLogHandler((_level, message) => {
      if (message.includes('unknown workflow trigger type')) return;
      console.log(`[RevenueCat] ${message}`);
    });
  }

  Purchases.configure({
    apiKey,
    entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
  });
  configured = true;
}

/** Ob `initPurchases()` erfolgreich einen API-Key konfiguriert hat. */
export function isPurchasesConfigured(): boolean {
  return configured;
}

/**
 * Prueft den Verifikationsstatus der Entitlements aus `CustomerInfo`.
 * Warnt bei Signaturfehlern (z.B. manipulierte Antworten oder MITM-Proxies).
 */
export function checkEntitlementVerification(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return true;

  if (customerInfo.entitlements.verification === VERIFICATION_RESULT.FAILED) {
    console.warn(
      '[Purchases] Entitlement-Verifikation fehlgeschlagen: Die Server-Antwort konnte nicht kryptografisch verifiziert werden.',
    );
    return false;
  }
  return true;
}

/** Prueft ein bekanntes Entitlement und verwirft nicht verifizierte CustomerInfo. */
export function hasEntitlement(
  customerInfo: CustomerInfo | null,
  entitlementId: EntitlementId,
): boolean {
  if (!customerInfo || !checkEntitlementVerification(customerInfo)) return false;
  return customerInfo.entitlements.active[entitlementId] !== undefined;
}

export function hasPlusEntitlement(customerInfo: CustomerInfo | null): boolean {
  return hasEntitlement(customerInfo, ENTITLEMENT_IDS.PLUS);
}

export function hasAIEntitlement(customerInfo: CustomerInfo | null): boolean {
  return hasEntitlement(customerInfo, ENTITLEMENT_IDS.AI);
}

export async function offeringForEntitlement(
  entitlementId: EntitlementId,
): Promise<PurchasesOffering | null> {
  if (!isPurchasesConfigured()) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.all[OFFERING_ID_BY_ENTITLEMENT[entitlementId]] ?? null;
}

export async function packagesForEntitlement(
  entitlementId: EntitlementId,
): Promise<PurchasesPackage[]> {
  return (await offeringForEntitlement(entitlementId))?.availablePackages ?? [];
}

/** Kompatibilitaetszugriff fuer die bestehende eigene Plus-Paywall. */
export function currentPackages(): Promise<PurchasesPackage[]> {
  return packagesForEntitlement(ENTITLEMENT_IDS.PLUS);
}

export type PurchaseOutcome =
  | { kind: 'purchased'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: PurchasesError };

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

/**
 * Synchronisiert die RevenueCat-Identitaet mit der Supabase-User-ID.
 * Bindet getaetigte Kaeufe an das Nutzerkonto.
 */
export async function syncPurchasesIdentity(
  userId: string,
  attributes?: Record<string, string | null>,
): Promise<CustomerInfo | null> {
  if (!isPurchasesConfigured()) return null;

  try {
    const { customerInfo } = await Purchases.logIn(userId);
    if (attributes) {
      await Purchases.setAttributes(attributes);
    }
    return customerInfo;
  } catch (err) {
    console.warn('[Purchases] syncPurchasesIdentity fehlgeschlagen:', err);
    return null;
  }
}

/**
 * Setzt benutzerdefinierte Subscriber Attributes fuer den aktuellen Nutzer.
 */
export async function setPurchasesAttributes(
  attributes: Record<string, string | null>,
): Promise<void> {
  if (!isPurchasesConfigured()) return;

  try {
    await Purchases.setAttributes(attributes);
  } catch (err) {
    console.warn('[Purchases] setPurchasesAttributes fehlgeschlagen:', err);
  }
}

/**
 * Setzt die E-Mail-Adresse des Nutzers in RevenueCat.
 */
export async function setPurchasesEmail(email: string | null): Promise<void> {
  if (!isPurchasesConfigured() || !email) return;

  try {
    await Purchases.setEmail(email);
  } catch (err) {
    console.warn('[Purchases] setPurchasesEmail fehlgeschlagen:', err);
  }
}

/**
 * Loggt den aktuellen RevenueCat-Nutzer aus, sofern er nicht bereits anonym ist.
 */
export async function resetPurchasesIdentity(): Promise<CustomerInfo | null> {
  if (!isPurchasesConfigured()) return null;

  try {
    const isAnon = await Purchases.isAnonymous();
    if (isAnon) return null;
    return await Purchases.logOut();
  } catch (err) {
    console.warn('[Purchases] resetPurchasesIdentity fehlgeschlagen:', err);
    return null;
  }
}
