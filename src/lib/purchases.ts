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

export const PREMIUM_ENTITLEMENT_ID = 'Premium';

let configured = false;

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

/** Prueft, ob das Premium-Entitlement in den gegebenen `CustomerInfo` aktiv ist. */
export function hasPremiumEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  checkEntitlementVerification(customerInfo);
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

export async function currentPackages(): Promise<PurchasesPackage[]> {
  if (!isPurchasesConfigured()) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/** Wie `currentPackages()`, gibt aber das ganze Offering zurueck (z.B. fuer `RevenueCatUI.Paywall`). */
export async function currentOffering(): Promise<PurchasesOffering | null> {
  if (!isPurchasesConfigured()) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
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
