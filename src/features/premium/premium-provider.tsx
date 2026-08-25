import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { env } from '@/lib/env';
import {
  hasPremiumEntitlement,
  initPurchases,
  isPurchasesConfigured,
  resetPurchasesIdentity,
  setPurchasesAttributes,
  setPurchasesEmail,
  syncPurchasesIdentity,
} from '@/lib/purchases';

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
 * 3. Das RevenueCat-Entitlement `Premium` (`PREMIUM_ENTITLEMENT_ID`) aus dem
 *    live geladenen `CustomerInfo` — greift sofort nach dem eigenen Kauf,
 *    noch bevor der Webhook durchgelaufen ist und die DB-Zeile aktualisiert
 *    hat.
 *
 * Modell B (User-Centric): Der RevenueCat-Kunde wird an die Supabase `user.id`
 * gebunden (`Purchases.logIn`), nicht an die `household_id`. Der aktive Haushalt
 * wird als Subscriber Attribute `household_id` uebertragen.
 */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { activeHouseholdId, activeHousehold } = useActiveHousehold();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id;
  const userEmail = session?.user.email;

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

  // RevenueCat-Identität mit Supabase-User synchronisieren
  useEffect(() => {
    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }

    if (userId) {
      syncPurchasesIdentity(userId, {
        household_id: activeHouseholdId ?? null,
        $posthogUserId: userId,
      })
        .then((info) => {
          if (info) setCustomerInfo(info);
          if (userEmail) {
            setPurchasesEmail(userEmail);
          }
        })
        .finally(() => setLoading(false));
    } else {
      resetPurchasesIdentity()
        .then((info) => {
          if (info) setCustomerInfo(info);
        })
        .finally(() => setLoading(false));
    }
  }, [userId, userEmail, activeHouseholdId]);

  // Haushaltswechsel an RevenueCat Subscriber Attributes melden
  useEffect(() => {
    if (!isPurchasesConfigured() || !userId) return;

    setPurchasesAttributes({
      household_id: activeHouseholdId ?? null,
      $posthogUserId: userId,
    });
  }, [activeHouseholdId, userId]);

  const isForced = env.forcePremium;
  const isPremium =
    isForced || (activeHousehold?.premium_active ?? false) || hasPremiumEntitlement(customerInfo);

  const value = useMemo(
    () => ({ isPremium, isForced, customerInfo, loading, refresh }),
    [isPremium, customerInfo, loading, refresh],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

const DEFAULT_PREMIUM_CONTEXT: PremiumContextValue = {
  isPremium: false,
  isForced: false,
  customerInfo: null,
  loading: false,
  refresh: async () => {},
};

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  return ctx ?? DEFAULT_PREMIUM_CONTEXT;
}
