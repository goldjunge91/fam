import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { env } from '@/lib/env';

/**
 * Entitlement-Identifier aus dem RevenueCat-Dashboard (Entitlements-Tab).
 * Muss dort exakt so angelegt werden, bevor echte Kaeufe geprueft werden
 * koennen. Aktueller Stand im "Foodapp"-Projekt: `Premium`, verknuepft mit
 * den Test-Store-Produkten `fam_premium_monthly` (4,99 €/Monat) und
 * `fam_premium_yearly` (49,99 €/Jahr) im Offering "default".
 */
export const PREMIUM_ENTITLEMENT_ID = 'Premium';

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

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    // Ohne eigenen Handler ruft das SDK fuer WARN/ERROR-Log-Zeilen
    // console.warn/console.error auf, und React Natives LogBox faengt das als
    // Vollbild-Ueberlagerung ab — auch fuer Zeilen, die gar kein Fehler sind,
    // etwa "[Test Store] Purchase failure simulated successfully": Das ist
    // der Test-Store-Dialog, der plangemaess einen Fehlkauf durchspielt.
    // console.log haelt die Zeile im Metro-Log sichtbar, ohne die App zu
    // unterbrechen. Nichts wird gefiltert — nur die Console-Funktion aendert
    // sich, jede Nachricht bleibt vollstaendig sichtbar.
    Purchases.setLogHandler((_level, message) => {
      console.log(`[RevenueCat] ${message}`);
    });
  }

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

/**
 * Liefert die kaufbaren Packages des aktuellen Offerings (Dashboard: Offerings
 * > "default", aktuell markiert). Leeres Array ohne konfigurierten API-Key
 * oder ohne aktuelles Offering, statt zu werfen — der Aufrufer entscheidet,
 * wie er eine leere Paywall behandelt.
 */
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

/**
 * Kauft ein Package. Nutzerabbruch ist kein Fehler (siehe `error.userCancelled`)
 * — der Aufrufer soll dann still bleiben statt einen Alert zu zeigen.
 *
 * Schaltet Premium nicht selbst frei: `PremiumProvider` haengt an
 * `Purchases.addCustomerInfoUpdateListener` und uebernimmt das anhand der
 * zurueckgegebenen `customerInfo` als einzige Quelle der Wahrheit.
 */
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

/**
 * Fragt den Store nach bereits getaetigten Kaeufen und synchronisiert sie zu
 * RevenueCat. Eine Nutzeraktion (sichtbarer "Kaeufe wiederherstellen"-Knopf),
 * kein automatischer Schritt — auf iOS von Apple fuer Abo-Apps vorgeschrieben.
 */
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
