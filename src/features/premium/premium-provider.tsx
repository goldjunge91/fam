import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useForcePremiumOverrideStore } from '@/features/premium/force-premium-override';
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
  /**
   * Ob `isPremium` erzwungen ist statt aus RevenueCat/der DB zu kommen — entweder ueber
   * `EXPO_PUBLIC_FORCE_PREMIUM` (Build-Zeit) oder den Dev-Tools-Override (Laufzeit, siehe
   * `force-premium-override.ts`), z. B. um Premium in einem bereits kompilierten TestFlight-Build umzuschalten.
   */
  isForced: boolean;
  /** `null` ohne konfigurierten RevenueCat-API-Key oder vor dem ersten Laden. */
  customerInfo: CustomerInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

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

  const forcePremiumOverride = useForcePremiumOverrideStore((state) => state.override);
  const isForced = forcePremiumOverride ?? env.forcePremium;
  const isPremium =
    isForced || (activeHousehold?.premium_active ?? false) || hasPremiumEntitlement(customerInfo);

  const value = useMemo(
    () => ({ isPremium, isForced, customerInfo, loading, refresh }),
    [isPremium, isForced, customerInfo, loading, refresh],
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
