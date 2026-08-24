import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useActiveHousehold } from '@/features/household/active-household-provider';
import { env } from '@/lib/env';
import { hasPremiumEntitlement, initPurchases, isPurchasesConfigured } from '@/lib/purchases';

type PremiumContextValue = {
  /** Ob der aktive Haushalt Zugriff auf Premium-Funktionen hat. */
  isPremium: boolean;
  /** Ob `isPremium` ueber `EXPO_PUBLIC_FORCE_PREMIUM` erzwungen ist statt aus RevenueCat/der DB zu kommen. */
  isForced: boolean;
  /** `null` ohne konfigurierten RevenueCat-API-Key oder vor dem ersten Laden. */
  customerInfo: CustomerInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

/**
 * Stellt den Premium-Status app-weit bereit, um einzelne Funktionen hinter
 * eine Paywall stellen zu koennen.
 *
 * Drei Quellen, in dieser Reihenfolge:
 *
 * 1. `EXPO_PUBLIC_FORCE_PREMIUM=true` — schaltet Premium hart frei, egal was
 *    RevenueCat oder die DB sagen. Zum Entwickeln einzelner Premium-
 *    Funktionen ohne Sandbox-Kauf pro Testlauf.
 * 2. `households.premium_active` aus dem lokalen SQLite-Spiegel
 *    (`activeHousehold`) — die serverseitige, vom RevenueCat-Webhook
 *    gepflegte Wahrheit. Offline verfuegbar wie der Rest der App, und der
 *    einzige Weg, wie ein Mitglied den Kauf eines anderen Mitglieds sieht.
 * 3. Das RevenueCat-Entitlement `premium` (`PREMIUM_ENTITLEMENT_ID`) aus dem
 *    live geladenen `CustomerInfo` — greift sofort nach dem eigenen Kauf,
 *    noch bevor der Webhook durchgelaufen ist und die DB-Zeile aktualisiert
 *    hat.
 *
 * Ohne API-Key bleibt `customerInfo` `null` und Punkt 3 traegt nichts bei —
 * die App startet trotzdem, siehe `lib/purchases.ts`.
 *
 * Muss innerhalb von `ActiveHouseholdProvider` stehen: der RevenueCat-User
 * wird an die `household_id` gebunden (`Purchases.logIn`), nicht an die
 * Supabase-User-ID — Premium gilt haushaltsweit, nicht pro Person. Alle
 * Mitglieder eines Haushalts teilen sich dadurch denselben RevenueCat-
 * Kunden; ein Kauf durch irgendein Mitglied macht CustomerInfo fuer alle
 * anderen ebenfalls sichtbar, sobald sie selbst online nachfragen — die
 * DB-Zeile (Punkt 2) ist trotzdem die primaere Quelle, weil sie das auch
 * offline kann.
 */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const { activeHouseholdId, activeHousehold } = useActiveHousehold();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }
    try {
      setCustomerInfo(await Purchases.getCustomerInfo());
    } catch (err) {
      console.warn('[Premium] CustomerInfo konnte nicht geladen werden:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initPurchases();

    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }

    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  useEffect(() => {
    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }

    // Bindet RevenueCat an den Haushalt statt an die Person — siehe
    // Kommentar am Provider. Ein Haushaltswechsel (HouseholdSwitcherModal)
    // loggt hier automatisch auf den neuen `activeHouseholdId` um.
    if (activeHouseholdId) {
      Purchases.logIn(activeHouseholdId)
        .then(({ customerInfo: info }) => setCustomerInfo(info))
        .catch((err) => console.warn('[Premium] RevenueCat logIn fehlgeschlagen:', err))
        .finally(() => setLoading(false));
      return;
    }

    // Purchases.logOut() wirft, wenn der RevenueCat-User schon anonym ist —
    // und das ist er beim allerersten App-Start immer, bevor je ein Haushalt
    // ausgewaehlt wurde. Ohne diese Pruefung loggt das bei jedem Start einen
    // Fehler, der keiner ist.
    Purchases.isAnonymous()
      .then((isAnonymous) => {
        if (isAnonymous) {
          setLoading(false);
          return;
        }
        return Purchases.logOut()
          .then((info) => setCustomerInfo(info))
          .finally(() => setLoading(false));
      })
      .catch((err) => {
        console.warn('[Premium] RevenueCat logOut fehlgeschlagen:', err);
        setLoading(false);
      });
  }, [activeHouseholdId]);

  const isForced = env.forcePremium;
  const isPremium =
    isForced || (activeHousehold?.premium_active ?? false) || hasPremiumEntitlement(customerInfo);

  const value = useMemo(
    () => ({ isPremium, isForced, customerInfo, loading, refresh }),
    [isPremium, customerInfo, loading, refresh],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) {
    throw new Error('usePremium() muss innerhalb von <PremiumProvider> aufgerufen werden.');
  }
  return ctx;
}
