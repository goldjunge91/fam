import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useSession } from '@/features/auth/session-provider';
import { env } from '@/lib/env';
import { hasPremiumEntitlement, initPurchases, isPurchasesConfigured } from '@/lib/purchases';

type PremiumContextValue = {
  /** Ob der aktuelle Nutzer Zugriff auf Premium-Funktionen hat. */
  isPremium: boolean;
  /** Ob `isPremium` ueber `EXPO_PUBLIC_FORCE_PREMIUM` erzwungen ist statt aus RevenueCat zu kommen. */
  isForced: boolean;
  /** `null` ohne konfigurierten RevenueCat-API-Key oder vor dem ersten Laden. */
  customerInfo: CustomerInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

/**
 * Stellt den Premium-Status app-weit bereit, um einzelne Funktionen hinter
 * eine Paywall stellen zu koennen, bevor die eigentliche Kaufstrecke
 * (Produkte, Paywall-UI) fertig ist.
 *
 * Zwei Quellen, in dieser Reihenfolge:
 *
 * 1. `EXPO_PUBLIC_FORCE_PREMIUM=true` — schaltet Premium hart frei, egal was
 *    RevenueCat sagt. Zum Entwickeln einzelner Premium-Funktionen ohne
 *    Sandbox-Kauf pro Testlauf.
 * 2. Das RevenueCat-Entitlement `premium` (`PREMIUM_ENTITLEMENT_ID`) aus
 *    `CustomerInfo`, sobald ein API-Key konfiguriert ist (`initPurchases`).
 *
 * Ohne API-Key bleibt `customerInfo` `null` und `isPremium` haengt allein an
 * der Force-Variable — die App startet trotzdem, siehe `lib/purchases.ts`.
 *
 * Muss innerhalb von `SessionProvider` stehen: der RevenueCat-User wird an
 * die Supabase-User-ID gebunden (`Purchases.logIn`), damit Kaeufe
 * geraeteuebergreifend demselben Account zugeordnet sind statt an einer
 * anonymen RevenueCat-ID zu haengen, die bei Neuinstallation verlorenginge.
 */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
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
    refresh();

    if (!isPurchasesConfigured()) return;

    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refresh]);

  useEffect(() => {
    if (!isPurchasesConfigured()) return;
    const userId = session?.user.id;

    if (userId) {
      Purchases.logIn(userId)
        .then(({ customerInfo: info }) => setCustomerInfo(info))
        .catch((err) => console.warn('[Premium] RevenueCat logIn fehlgeschlagen:', err));
    } else {
      Purchases.logOut()
        .then((info) => setCustomerInfo(info))
        .catch((err) => console.warn('[Premium] RevenueCat logOut fehlgeschlagen:', err));
    }
  }, [session?.user.id]);

  const isForced = env.forcePremium;
  const isPremium = isForced || hasPremiumEntitlement(customerInfo);

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
