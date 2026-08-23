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

/** Kombiniert Dev-Override, Haushaltsspiegel und Live-Entitlement zum Premium-Status. */
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

    // Premium ist an den aktiven Haushalt statt die Person gebunden.
    if (activeHouseholdId) {
      Purchases.logIn(activeHouseholdId)
        .then(({ customerInfo: info }) => setCustomerInfo(info))
        .catch((err) => console.warn('[Premium] RevenueCat logIn fehlgeschlagen:', err));
      return;
    }

    // RevenueCat wirft beim Abmelden eines bereits anonymen Nutzers.
    Purchases.isAnonymous()
      .then((isAnonymous) => {
        if (isAnonymous) return;
        return Purchases.logOut().then((info) => setCustomerInfo(info));
      })
      .catch((err) => console.warn('[Premium] RevenueCat logOut fehlgeschlagen:', err));
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
